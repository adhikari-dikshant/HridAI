from datetime import UTC, datetime

from app.core.errors import ApiError
from app.core.ids import new_id
from app.schemas import Patient, PatientCreate, PatientList, PatientUpdate
from app.services.screening_service import ScreeningService, owned_patient


class PatientService:
    def __init__(self, screenings: ScreeningService) -> None:
        self.screenings = screenings
        self.repository = screenings.repository

    def create(self, owner_uid: str, request: PatientCreate) -> Patient:
        if not request.consent.accepted:
            raise ApiError("consent_required")

        now = datetime.now(UTC)
        patient = {
            "patient_id": new_id("pat"),
            "owner_uid": owner_uid,
            **request.model_dump(mode="json", exclude={"consent"}),
            "consent": {
                "accepted": True,
                "version": request.consent.version,
                "accepted_at": now,
            },
            "last_screening_at": None,
            "last_activity_at": now,
            "created_at": now,
            "updated_at": now,
        }
        self.repository.create_patient(patient)
        return Patient.model_validate(patient)

    def get(self, owner_uid: str, patient_id: str) -> Patient:
        return Patient.model_validate(owned_patient(self.repository, owner_uid, patient_id))

    def list(self, owner_uid: str, limit: int) -> PatientList:
        return PatientList(
            items=[
                Patient.model_validate(patient)
                for patient in self.repository.list_patients(owner_uid, limit)
            ]
        )

    def update(self, owner_uid: str, patient_id: str, request: PatientUpdate) -> Patient:
        owned_patient(self.repository, owner_uid, patient_id)
        changes = request.model_dump(mode="json", exclude_unset=True)
        self.repository.update_patient(patient_id, changes | {"updated_at": datetime.now(UTC)})
        return self.get(owner_uid, patient_id)

    def delete(self, owner_uid: str, patient_id: str) -> None:
        owned_patient(self.repository, owner_uid, patient_id)
        for screening in self.repository.list_screenings(owner_uid, None, patient_id):
            self.screenings.delete(owner_uid, screening["screening_id"])
        self.repository.delete_patient(patient_id)
