import shutil
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import verify_token
from app.core.config import Settings
from app.services.model import MockClassifier, OnnxClassifier
from app.services.patient_service import PatientService
from app.services.quality import MockQuality, RealQuality
from app.services.repository import InMemoryRepository
from app.services.screening_service import ScreeningService
from app.services.storage import LocalBlobStore
from app.services.templates import TemplateExplainer

_bearer = HTTPBearer(auto_error=False)


def build_service(settings: Settings) -> ScreeningService:
    not_built = {
        "AUTH_MODE=firebase": settings.auth_mode == "firebase",
        "DATA_BACKEND=firestore": settings.data_backend == "firestore",
    }
    missing = [name for name, requested in not_built.items() if requested]
    if missing:
        raise NotImplementedError(f"Not built yet: {', '.join(missing)}")

    if not settings.mock_quality and shutil.which(settings.ffmpeg_path) is None:
        raise RuntimeError(f"ffmpeg not found: {settings.ffmpeg_path}")

    blobs = LocalBlobStore(settings.local_data_dir)
    classifier = (
        MockClassifier(settings.mock_scenario)
        if settings.mock_inference
        else OnnxClassifier(settings.model_path, blobs)
    )
    return ScreeningService(
        repository=InMemoryRepository(),
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
