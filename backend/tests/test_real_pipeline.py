import json
from pathlib import Path

import numpy as np
import pytest
from audio_samples import lub_dub, wav_bytes
from conftest import make_settings
from fastapi.testclient import TestClient
from helpers import create_screening, upload

from app.core.audio_config import AUDIO
from app.main import create_app
from app.services.features import model_input
from app.services.model import OnnxClassifier, load_meta

MODELS = Path(__file__).parents[1] / "models"
AUDIO_WAV = wav_bytes(lub_dub())


class FixedSession:
    """Stands in for ONNX Runtime so the API can be tested without the model file."""

    def __init__(self, logit: float) -> None:
        self.logit = logit
        self.inputs = []

    def run(self, _, feed):
        self.inputs.append(feed["log_mel"])
        return [np.array([self.logit], dtype=np.float32)]


def write_model(tmp_path, **overrides) -> Path:
    meta = {
        "model_version": "test-model",
        "output": "logit",
        "threshold": 0.02,
        "sample_rate": AUDIO.sample_rate,
        "n_mels": AUDIO.n_mels,
        "n_fft": AUDIO.n_fft,
        "hop_length": AUDIO.hop_length,
        "f_min": AUDIO.f_min,
        "f_max": AUDIO.f_max,
    }
    path = tmp_path / "model.onnx"
    (tmp_path / "model_meta.json").write_text(json.dumps(meta | overrides))
    return path


@pytest.fixture
def real_client(tmp_path, ffmpeg, monkeypatch):
    session = FixedSession(logit=2.0)
    monkeypatch.setattr("app.services.model.open_session", lambda path: session)
    settings = make_settings(
        tmp_path,
        mock_inference=False,
        mock_quality=False,
        ffmpeg_path=ffmpeg,
        model_path=str(write_model(tmp_path)),
    )
    with TestClient(create_app(settings)) as client:
        client.session = session
        yield client


def test_health_reports_the_real_model(real_client):
    assert real_client.get("/healthz").json() == {
        "status": "ok",
        "model_version": "test-model",
        "mock": False,
    }


def test_full_flow_uses_the_model_on_real_audio(real_client, auth):
    screening_id = create_screening(real_client, auth)
    for location in ("MV", "AV"):
        body = upload(real_client, auth, screening_id, location, content=AUDIO_WAV).json()
        assert body["accepted"] is True

    response = real_client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    result = response.json()["result"]
    assert response.status_code == 200
    assert result["label"] == "needs_checkup"
    assert result["abnormal_probability"] == pytest.approx(0.88, abs=0.01)
    assert result["model_version"] == "test-model"
    assert result["heart_rate_bpm"] == pytest.approx(72, abs=5)
    assert [item["location"] for item in result["per_location"]] == ["MV", "AV"]
    assert real_client.session.inputs[0].shape[:3] == (1, 1, AUDIO.n_mels)


def test_neck_recording_never_reaches_the_model(real_client, auth):
    screening_id = create_screening(real_client, auth)
    upload(real_client, auth, screening_id, "MV", content=AUDIO_WAV)
    upload(real_client, auth, screening_id, "NK", content=AUDIO_WAV)

    real_client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    assert len(real_client.session.inputs) == 1


def test_converted_audio_is_stored_and_replaced(real_client, auth, tmp_path):
    screening_id = create_screening(real_client, auth)
    upload(real_client, auth, screening_id, "MV", content=AUDIO_WAV)
    upload(real_client, auth, screening_id, "MV", content=AUDIO_WAV)

    names = [p.name for p in (tmp_path / "local_data").rglob("*") if p.is_file()]

    assert len(names) == 2
    assert sum(name.endswith("_4k.wav") for name in names) == 1


def test_unreadable_upload_is_415(real_client, auth):
    screening_id = create_screening(real_client, auth)

    response = upload(real_client, auth, screening_id, content=b"not audio")

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_audio"


def test_noisy_upload_is_rejected_with_bilingual_message(real_client, auth):
    screening_id = create_screening(real_client, auth)
    noise = np.random.default_rng(0).standard_normal(15 * 16000) * 0.6
    noisy = wav_bytes(((lub_dub() + noise) / 3).astype(np.float32))

    body = upload(real_client, auth, screening_id, content=noisy).json()

    assert body["accepted"] is False
    assert body["quality"]["issues"] == ["too_noisy"]
    assert "Too much background noise" in body["message_en"]


def test_model_settings_that_disagree_with_audio_config_stop_startup(tmp_path):
    path = write_model(tmp_path, sample_rate=2000)

    with pytest.raises(ValueError, match="sample_rate"):
        load_meta(path)


def test_probability_comes_from_the_logit(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.model.open_session", lambda path: FixedSession(0.0))
    classifier = OnnxClassifier(write_model(tmp_path), blobs=None)

    assert classifier.probability(np.zeros(AUDIO.sample_rate, dtype=np.float32)) == 0.5


def test_real_quality_needs_real_inference_settings(tmp_path):
    with pytest.raises(ValueError, match="MOCK_QUALITY"):
        make_settings(tmp_path, mock_inference=False, mock_quality=True)


@pytest.mark.skipif(not (MODELS / "model.onnx").exists(), reason="Model file is not in the repo")
def test_trained_model_matches_colab_on_the_golden_recording():
    golden = np.load(MODELS / "golden.npz")
    classifier = OnnxClassifier(MODELS / "model.onnx", blobs=None)

    logit = classifier.logit(model_input(golden["audio"]))

    assert logit == pytest.approx(float(golden["logit"]), abs=1e-3)
