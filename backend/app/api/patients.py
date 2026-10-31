from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.deps import CurrentUid, Patients
from app.schemas import ErrorResponse, Patient, PatientCreate, PatientList, PatientUpdate

router = APIRouter(
    prefix="/v1/patients",
    responses={status: {"model": ErrorResponse} for status in (400, 401, 404, 500)},
)


@router.post("", status_code=201, response_model=Patient)
def create_patient(body: PatientCreate, uid: CurrentUid, patients: Patients):
    return patients.create(uid, body)


@router.get("", response_model=PatientList)
def list_patients(
    uid: CurrentUid,
    patients: Patients,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
):
    return patients.list(uid, limit)


@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: str, uid: CurrentUid, patients: Patients):
    return patients.get(uid, patient_id)


@router.patch("/{patient_id}", response_model=Patient)
def update_patient(patient_id: str, body: PatientUpdate, uid: CurrentUid, patients: Patients):
    return patients.update(uid, patient_id, body)


@router.delete("/{patient_id}", status_code=204)
def delete_patient(patient_id: str, uid: CurrentUid, patients: Patients):
    patients.delete(uid, patient_id)
    return Response(status_code=204)
