from itertools import cycle
from typing import Protocol

from app.services.result import LocationScore

MOCK_MODEL_VERSION = "mock-0.0"
MOCK_THRESHOLD = 0.35

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
