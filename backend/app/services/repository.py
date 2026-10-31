from copy import deepcopy
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Protocol

from app.schemas import ScreeningStatus

ANALYSIS_LEASE = timedelta(seconds=90)


def analysis_is_running(screening: dict, now: datetime) -> bool:
    started_at = screening.get("analysis_started_at")
    return (
        screening["status"] == ScreeningStatus.analyzing
        and started_at is not None
        and now - started_at < ANALYSIS_LEASE
    )


class Repository(Protocol):
    def create_screening(self, screening: dict) -> None: ...

    def get_screening(self, screening_id: str) -> dict | None: ...

    def update_screening(self, screening_id: str, fields: dict) -> None: ...

    def list_screenings(self, owner_uid: str, limit: int) -> list[dict]: ...

    def delete_screening(self, screening_id: str) -> None: ...

    def try_start_analysis(self, screening_id: str, now: datetime | None = None) -> bool: ...

    def save_recording(self, screening_id: str, recording: dict) -> None: ...

    def list_recordings(self, screening_id: str) -> list[dict]: ...

    def delete_recording(self, screening_id: str, recording_id: str) -> None: ...


class InMemoryRepository:
    def __init__(self) -> None:
        self._screenings: dict[str, dict] = {}
        self._recordings: dict[str, dict[str, dict]] = {}
        self._lock = Lock()

    def create_screening(self, screening: dict) -> None:
        with self._lock:
            self._screenings[screening["screening_id"]] = deepcopy(screening)
            self._recordings[screening["screening_id"]] = {}

    def get_screening(self, screening_id: str) -> dict | None:
        with self._lock:
            return deepcopy(self._screenings.get(screening_id))

    def update_screening(self, screening_id: str, fields: dict) -> None:
        with self._lock:
            self._screenings[screening_id].update(deepcopy(fields))

    def list_screenings(self, owner_uid: str, limit: int) -> list[dict]:
        with self._lock:
            owned = [s for s in self._screenings.values() if s["owner_uid"] == owner_uid]
            owned.sort(key=lambda screening: screening["created_at"], reverse=True)
            return deepcopy(owned[:limit])

    def delete_screening(self, screening_id: str) -> None:
        with self._lock:
            self._screenings.pop(screening_id, None)
            self._recordings.pop(screening_id, None)

    def try_start_analysis(self, screening_id: str, now: datetime | None = None) -> bool:
        now = now or datetime.now(UTC)
        with self._lock:
            screening = self._screenings[screening_id]
            if analysis_is_running(screening, now):
                return False
            screening["status"] = ScreeningStatus.analyzing
            screening["analysis_started_at"] = now
            return True

    def save_recording(self, screening_id: str, recording: dict) -> None:
        with self._lock:
            self._recordings[screening_id][recording["recording_id"]] = deepcopy(recording)

    def list_recordings(self, screening_id: str) -> list[dict]:
        with self._lock:
            return deepcopy(list(self._recordings[screening_id].values()))

    def delete_recording(self, screening_id: str, recording_id: str) -> None:
        with self._lock:
            self._recordings[screening_id].pop(recording_id, None)
