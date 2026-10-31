from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import verify_token
from app.core.config import Settings
from app.services.model import MockClassifier
from app.services.quality import MockQuality
from app.services.repository import InMemoryRepository
from app.services.screening_service import ScreeningService
from app.services.storage import LocalBlobStore
from app.services.templates import TemplateExplainer

_bearer = HTTPBearer(auto_error=False)


def build_service(settings: Settings) -> ScreeningService:
    not_built = {
        "AUTH_MODE=firebase": settings.auth_mode == "firebase",
        "DATA_BACKEND=firestore": settings.data_backend == "firestore",
        "MOCK_INFERENCE=false": not settings.mock_inference,
        "MOCK_QUALITY=false": not settings.mock_quality,
    }
    missing = [name for name, requested in not_built.items() if requested]
    if missing:
        raise NotImplementedError(f"Not built yet: {', '.join(missing)}")

    return ScreeningService(
        repository=InMemoryRepository(),
        blobs=LocalBlobStore(settings.local_data_dir),
        quality=MockQuality(),
        classifier=MockClassifier(settings.mock_scenario),
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


CurrentUid = Annotated[str, Depends(get_current_uid)]
Service = Annotated[ScreeningService, Depends(get_service)]
