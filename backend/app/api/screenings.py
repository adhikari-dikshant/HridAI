from pathlib import PurePath
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, Response, UploadFile

from app.api.deps import CurrentUid, Service
from app.core.errors import ApiError
from app.core.uploads import MAX_RECORDING_BYTES
from app.schemas import (
    AcceptedRecording,
    AnalyzeResponse,
    ErrorResponse,
    Location,
    Platform,
    RejectedRecording,
    ScreeningCreate,
    ScreeningCreated,
    ScreeningDetail,
    ScreeningList,
    Source,
)
from app.services.screening_service import NewRecording

AUDIO_EXTENSIONS = {
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
}
GENERIC_CONTENT_TYPES = {None, "", "application/octet-stream"}
FILE_EXTENSIONS = {".m4a": "m4a", ".mp4": "m4a", ".wav": "wav"}

router = APIRouter(
    prefix="/v1/screenings",
    responses={
        status: {"model": ErrorResponse}
        for status in (400, 401, 404, 409, 413, 415, 500)
    },
)


def _audio_extension(upload: UploadFile) -> str:
    content_type = upload.content_type
    if content_type in AUDIO_EXTENSIONS:
        return AUDIO_EXTENSIONS[content_type]
    suffix = PurePath(upload.filename or "").suffix.lower()
    if content_type in GENERIC_CONTENT_TYPES and suffix in FILE_EXTENSIONS:
        return FILE_EXTENSIONS[suffix]
    raise ApiError("unsupported_media_type")


@router.post("", status_code=201, response_model=ScreeningCreated)
def create_screening(body: ScreeningCreate, uid: CurrentUid, service: Service):
    return service.create(uid, body)


@router.get("", response_model=ScreeningList)
def list_screenings(
    uid: CurrentUid,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    return service.list(uid, limit)


@router.get("/{screening_id}", response_model=ScreeningDetail)
def get_screening(screening_id: str, uid: CurrentUid, service: Service):
    return service.get(uid, screening_id)


@router.delete("/{screening_id}", status_code=204)
def delete_screening(screening_id: str, uid: CurrentUid, service: Service):
    service.delete(uid, screening_id)
    return Response(status_code=204)


@router.post(
    "/{screening_id}/recordings",
    response_model=RejectedRecording | AcceptedRecording,
)
def add_recording(
    screening_id: str,
    uid: CurrentUid,
    service: Service,
    file: Annotated[UploadFile, File()],
    location: Annotated[Location, Form()],
    source: Annotated[Source, Form()],
    platform: Annotated[Platform, Form()],
    duration_ms: Annotated[int, Form(ge=0)],
):
    extension = _audio_extension(file)
    data = file.file.read(MAX_RECORDING_BYTES + 1)
    if len(data) > MAX_RECORDING_BYTES:
        raise ApiError("file_too_large")
    if not data:
        raise ApiError("unsupported_audio")

    return service.add_recording(
        uid,
        screening_id,
        NewRecording(
            data=data,
            extension=extension,
            location=location,
            source=source,
            platform=platform,
            duration_ms=duration_ms,
        ),
    )


@router.post("/{screening_id}/analyze", response_model=AnalyzeResponse)
def analyze_screening(screening_id: str, uid: CurrentUid, service: Service):
    return service.analyze(uid, screening_id)
