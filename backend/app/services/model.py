import json
import math
from itertools import cycle
from pathlib import Path
from threading import BoundedSemaphore
from typing import Protocol

import numpy as np
import onnxruntime as ort

from app.core.audio_config import AUDIO
from app.services.decode import from_wav
from app.services.features import model_input
from app.services.result import LocationScore
from app.services.storage import BlobStore

MOCK_MODEL_VERSION = "mock-0.0"
MOCK_THRESHOLD = 0.35
_MAX_PARALLEL_INFERENCES = 2

# Scenario -> (probability at the first location, at later locations, quality override).
_SCENARIOS = {
    "normal": (0.18, 0.12, None),
    "needs_checkup": (0.81, 0.44, None),
    "unclear": (0.2, 0.2, 0.3),
}


class Classifier(Protocol):
    model_version: str
    threshold: float

    def predict(self, recordings: list[dict]) -> list[LocationScore]: ...


class MockClassifier:
    model_version = MOCK_MODEL_VERSION
    threshold = MOCK_THRESHOLD

    def __init__(self, scenario: str) -> None:
        self._scenarios = cycle(_SCENARIOS) if scenario == "cycle" else cycle([scenario])

    def predict(self, recordings: list[dict]) -> list[LocationScore]:
        first, later, quality_override = _SCENARIOS[next(self._scenarios)]
        return [
            LocationScore(
                location=recording["location"],
                abnormal_probability=later if index else first,
                quality_score=quality_override or recording["quality"]["score"],
            )
            for index, recording in enumerate(recordings)
        ]


def load_meta(model_path: str | Path) -> dict:
    """Reads model_meta.json and refuses a model trained with other audio settings."""
    meta = json.loads(Path(model_path).with_name("model_meta.json").read_text(encoding="utf-8"))
    expected = {
        "output": "logit",
        "sample_rate": AUDIO.sample_rate,
        "n_mels": AUDIO.n_mels,
        "n_fft": AUDIO.n_fft,
        "hop_length": AUDIO.hop_length,
        "f_min": AUDIO.f_min,
        "f_max": AUDIO.f_max,
    }
    for name, value in expected.items():
        if meta.get(name) != value:
            raise ValueError(f"Model {name} is {meta.get(name)}, backend expects {value}")
    return meta


def open_session(model_path: str | Path) -> ort.InferenceSession:
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    return ort.InferenceSession(
        str(model_path), options, providers=["CPUExecutionProvider"]
    )


class OnnxClassifier:
    def __init__(self, model_path: str | Path, blobs: BlobStore) -> None:
        meta = load_meta(model_path)
        self.model_version = meta["model_version"]
        self.threshold = float(meta["threshold"])
        self._blobs = blobs
        self._session = open_session(model_path)
        self._slots = BoundedSemaphore(_MAX_PARALLEL_INFERENCES)

    def logit(self, features: np.ndarray) -> float:
        with self._slots:
            return float(self._session.run(None, {"log_mel": features})[0][0])

    def probability(self, audio: np.ndarray) -> float:
        logit = self.logit(model_input(audio))
        return 1 / (1 + math.exp(-logit))

    def predict(self, recordings: list[dict]) -> list[LocationScore]:
        return [
            LocationScore(
                location=recording["location"],
                abnormal_probability=self.probability(
                    from_wav(self._blobs.get(recording["converted_path"]))
                ),
                quality_score=recording["quality"]["score"],
            )
            for recording in recordings
        ]
