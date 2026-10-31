from datetime import UTC, datetime
from enum import Enum

from google.api_core.exceptions import NotFound
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.schemas import ScreeningStatus
from app.services.repository import analysis_is_running

_LOCK_ATTEMPTS = 10


def _plain(value):
    """Firestore stores strings, so enums are written by value."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_plain(item) for item in value]
    return value


class FirestoreRepository:
    def __init__(self, project: str) -> None:
        self._db = firestore.Client(project=project)
        self._patients = self._db.collection("patients")
        self._screenings = self._db.collection("screenings")

    def _recordings(self, screening_id: str):
        return self._screenings.document(screening_id).collection("recordings")

    def create_patient(self, patient: dict) -> None:
        self._patients.document(patient["patient_id"]).set(_plain(patient))

    def get_patient(self, patient_id: str) -> dict | None:
        return self._patients.document(patient_id).get().to_dict()

    def update_patient(self, patient_id: str, fields: dict) -> None:
        try:
            self._patients.document(patient_id).update(_plain(fields))
        except NotFound:
            # The patient can be deleted while one of its screenings is finishing.
            pass

    def list_patients(self, owner_uid: str, limit: int) -> list[dict]:
        query = (
            self._patients.where(filter=FieldFilter("owner_uid", "==", owner_uid))
            .order_by("last_activity_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        return [document.to_dict() for document in query.stream()]

    def delete_patient(self, patient_id: str) -> None:
        self._patients.document(patient_id).delete()

    def create_screening(self, screening: dict) -> None:
        self._screenings.document(screening["screening_id"]).set(_plain(screening))

    def get_screening(self, screening_id: str) -> dict | None:
        return self._screenings.document(screening_id).get().to_dict()

    def update_screening(self, screening_id: str, fields: dict) -> None:
        self._screenings.document(screening_id).update(_plain(fields))

    def list_screenings(
        self, owner_uid: str, limit: int | None, patient_id: str | None = None
    ) -> list[dict]:
        query = self._screenings.where(filter=FieldFilter("owner_uid", "==", owner_uid))
        if patient_id is not None:
            query = query.where(filter=FieldFilter("patient_id", "==", patient_id))
        query = query.order_by("created_at", direction=firestore.Query.DESCENDING)
        if limit is not None:
            query = query.limit(limit)
        return [document.to_dict() for document in query.stream()]

    def delete_screening(self, screening_id: str) -> None:
        self._db.recursive_delete(self._screenings.document(screening_id))

    def try_start_analysis(self, screening_id: str, now: datetime | None = None) -> bool:
        now = now or datetime.now(UTC)
        reference = self._screenings.document(screening_id)

        @firestore.transactional
        def attempt(transaction) -> bool:
            screening = reference.get(transaction=transaction).to_dict()
            if analysis_is_running(screening, now):
                return False
            transaction.update(
                reference,
                {"status": ScreeningStatus.analyzing.value, "analysis_started_at": now},
            )
            return True

        try:
            return attempt(self._db.transaction(max_attempts=_LOCK_ATTEMPTS))
        except ValueError:
            # The commit lost every retry, so another request is taking the lock right now.
            return False

    def save_recording(self, screening_id: str, recording: dict) -> None:
        self._recordings(screening_id).document(recording["recording_id"]).set(_plain(recording))

    def list_recordings(self, screening_id: str) -> list[dict]:
        query = self._recordings(screening_id).order_by("created_at")
        return [document.to_dict() for document in query.stream()]

    def delete_recording(self, screening_id: str, recording_id: str) -> None:
        self._recordings(screening_id).document(recording_id).delete()
