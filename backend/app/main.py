import logging
import shutil
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, patients, screenings
from app.api.deps import build_service
from app.core.config import Settings, get_settings
from app.core.errors import install_error_handlers
from app.core.logging import RequestContextMiddleware, setup_logging
from app.core.uploads import UploadLimitMiddleware
from app.services.patient_service import PatientService

logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    if shutil.which("ffmpeg") is None:
        logger.warning("ffmpeg_not_found")
    app.state.service = build_service(app.state.settings)
    app.state.patients = PatientService(app.state.service)
    yield


def _use_400_for_validation_errors(app: FastAPI) -> None:
    generate_openapi = app.openapi

    def openapi() -> dict:
        schema = generate_openapi()
        for path in schema["paths"].values():
            for operation in path.values():
                operation["responses"].pop("422", None)
        return schema

    app.openapi = openapi


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    docs_url = None if settings.env == "prod" else "/docs"

    app = FastAPI(
        title="HridAI API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=None,
    )
    app.state.settings = settings

    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(patients.router)
    app.include_router(screenings.router)
    _use_400_for_validation_errors(app)

    app.add_middleware(UploadLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    app.add_middleware(RequestContextMiddleware)
    return app


app = create_app()
