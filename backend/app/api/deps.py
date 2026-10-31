import shutil
from typing import Annotated

import firebase_admin
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import verify_token
from app.core.config import Settings
from app.services.model import MockClassifier, OnnxClassifier
from app.services.patient_service import PatientService
from app.services.quality import MockQuality, RealQuality
from app.services.repository import InMemoryRepository, Repository
from app.services.screening_service import ScreeningService
from app.services.storage import BlobStore, GCSBlobStore, LocalBlobStore
from app.services.templates import TemplateExplainer

_bearer = HTTPBearer(auto_error=False)


def _start_firebase(project: str) -> None:
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={"projectId": project})


def _build_storage(settings: Settings) -> tuple[Repository, BlobStore]:
    if settings.data_backend == "memory":
        return InMemoryRepository(), LocalBlobStore(settings.local_data_dir)

    from app.services.firestore_repository import FirestoreRepository

    return (
        FirestoreRepository(settings.gcp_project),
        GCSBlobStore(settings.storage_bucket, settings.gcp_project),
    )


def build_service(settings: Settings) -> ScreeningService:
    uses_cloud = settings.auth_mode == "firebase" or settings.data_backend == "firestore"
    if uses_cloud and not settings.gcp_project:
        raise RuntimeError("GCP_PROJECT is required for Firebase and Firestore")
    if settings.data_backend == "firestore" and not settings.storage_bucket:
        raise RuntimeError("STORAGE_BUCKET is required with DATA_BACKEND=firestore")
    if not settings.mock_quality and shutil.which(settings.ffmpeg_path) is None:
        raise RuntimeError(f"ffmpeg not found: {settings.ffmpeg_path}")

    if settings.auth_mode == "firebase":
        _start_firebase(settings.gcp_project)

    repository, blobs = _build_storage(settings)
    classifier = (
        MockClassifier(settings.mock_scenario)
        if settings.mock_inference
        else OnnxClassifier(settings.model_path, blobs)
    )
    return ScreeningService(
        repository=repository,
        blobs=blobs,
        quality=MockQuality() if settings.mock_quality else RealQuality(settings.ffmpeg_path),
        classifier=classifier,
        explainer=TemplateExplainer(),
    )


def get_current_uid(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    token = credentials.credentials if credentials else None
    return verify_token(token, request.app.state.settings)


def get_service(request: Request) -> ScreeningService:
    return request.app.state.service


def get_patient_service(request: Request) -> PatientService:
    return request.app.state.patients


CurrentUid = Annotated[str, Depends(get_current_uid)]
Service = Annotated[ScreeningService, Depends(get_service)]
Patients = Annotated[PatientService, Depends(get_patient_service)]
