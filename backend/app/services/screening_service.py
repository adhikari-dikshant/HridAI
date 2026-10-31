from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.errors import ApiError
from app.core.ids import new_id
from app.core.messages import DISCLAIMER, ISSUE_MESSAGES
from app.schemas import (
    AcceptedRecording,
    AnalyzeResponse,
    Location,
    Platform,
    RecordingSummary,
    RejectedRecording,
    ScreeningCreate,
    ScreeningCreated,
    ScreeningDetail,
    ScreeningList,
    ScreeningListItem,
    ScreeningStatus,
    Source,
)
from app.services.model import Classifier
from app.services.quality import QualityChecker
from app.services.repository import Repository, analysis_is_running
from app.services.result import build_result
from app.services.storage import BlobStore
from app.services.templates import Explainer

REQUIRED_LOCATIONS = [Location.MV, Location.AV]
OPTIONAL_LOCATIONS = [Location.PV, Location.TV]


@dataclass(frozen=True)
class NewRecording:
    data: bytes
    extension: str
    location: Location
    source: Source
    platform: Platform
    duration_ms: int


class ScreeningService:
    def __init__(
        self,
        repository: Repository,
        blobs: BlobStore,
        quality: QualityChecker,
        classifier: Classifier,
        explainer: Explainer,
    ) -> None:
        self.repository = repository
        self.blobs = blobs
        self.quality = quality
        self.classifier = classifier
        self.explainer = explainer

    def create(self, owner_uid: str, request: ScreeningCreate) -> ScreeningCreated:
        if not request.consent.accepted:
            raise ApiError("consent_required")

        now = datetime.now(UTC)
        screening = {
            "screening_id": new_id("scr"),
            "owner_uid": owner_uid,
            "created_at": now,
            "updated_at": now,
            "status": ScreeningStatus.awaiting_recordings,
            "language": request.language,
            "consent": {
                "accepted": True,
                "version": request.consent.version,
                "accepted_at": now,
            },
            "patient": request.patient.model_dump(mode="json"),
            "result": None,
            "explanation": None,
            "completed_at": None,
            "analysis_started_at": None,
        }
        self.repository.create_screening(screening)
        return ScreeningCreated(
            screening_id=screening["screening_id"],
            status=screening["status"],
            required_locations=REQUIRED_LOCATIONS,
            optional_locations=OPTIONAL_LOCATIONS,
            created_at=now,
        )

    def add_recording(
        self, owner_uid: str, screening_id: str, upload: NewRecording
    ) -> AcceptedRecording | RejectedRecording:
        self._owned(owner_uid, screening_id, refuse_while_analyzing=True)

        quality = self.quality.check(upload.data, upload.location, upload.duration_ms)
        accepted = not quality.issues
        recording_id = new_id("rec")
        storage_path = None
        if accepted:
            # Rejected audio is not kept: consent covers storing data to give a result.
            storage_path = f"screenings/{screening_id}/recordings/{recording_id}.{upload.extension}"
            self.blobs.put(storage_path, upload.data)

        self._remove_location(screening_id, upload.location)
        self.repository.save_recording(
            screening_id,
            {
                "recording_id": recording_id,
                "location": upload.location,
                "source": upload.source,
                "platform": upload.platform,
                "storage_path": storage_path,
                "duration_s": quality.duration_s,
                "accepted": accepted,
                "quality": quality.model_dump(mode="json"),
                "created_at": datetime.now(UTC),
            },
        )

        status = self._status_after_upload(screening_id)
        self.repository.update_screening(
            screening_id,
            {
                "status": status,
                "updated_at": datetime.now(UTC),
                "result": None,
                "explanation": None,
                "completed_at": None,
            },
        )

        fields = {
            "recording_id": recording_id,
            "location": upload.location,
            "accepted": accepted,
            "quality": quality,
            "screening_status": status,
        }
        if accepted:
            return AcceptedRecording(**fields)
        message_en, message_hi = ISSUE_MESSAGES[quality.issues[0]]
        return RejectedRecording(**fields, message_en=message_en, message_hi=message_hi)

    def analyze(self, owner_uid: str, screening_id: str) -> AnalyzeResponse:
        screening = self._owned(owner_uid, screening_id)
        if screening["status"] == ScreeningStatus.completed:
            return self._analysis(screening)

        recordings = [r for r in self.repository.list_recordings(screening_id) if r["accepted"]]
        if not recordings:
            raise ApiError("no_accepted_recordings")
        if not self.repository.try_start_analysis(screening_id):
            raise ApiError("analysis_in_progress")

        try:
            scores = self.classifier.predict(recordings)
            result = build_result(
                scores,
                [recording["quality"]["heart_rate_bpm"] for recording in recordings],
                self.classifier.threshold,
                self.classifier.model_version,
            )
            explanation = self.explainer.explain(result["label"], screening["patient"]["symptoms"])
        except Exception:
            self.repository.update_screening(
                screening_id,
                {
                    "status": ScreeningStatus.failed,
                    "analysis_started_at": None,
                    "updated_at": datetime.now(UTC),
                },
            )
            raise

        now = datetime.now(UTC)
        self.repository.update_screening(
            screening_id,
            {
                "status": ScreeningStatus.completed,
                "result": result,
                "explanation": explanation,
                "model_version": result["model_version"],
                "completed_at": now,
                "analysis_started_at": None,
                "updated_at": now,
            },
        )
        return self._analysis(self.repository.get_screening(screening_id))

    def get(self, owner_uid: str, screening_id: str) -> ScreeningDetail:
        screening = self._owned(owner_uid, screening_id)
        completed = screening["status"] == ScreeningStatus.completed
        return ScreeningDetail(
            screening_id=screening_id,
            status=screening["status"],
            language=screening["language"],
            created_at=screening["created_at"],
            patient=screening["patient"],
            recordings=[
                RecordingSummary.model_validate(recording)
                for recording in self.repository.list_recordings(screening_id)
            ],
            analysis=self._analysis(screening) if completed else None,
        )

    def list(self, owner_uid: str, limit: int) -> ScreeningList:
        return ScreeningList(
            items=[
                ScreeningListItem(
                    screening_id=screening["screening_id"],
                    created_at=screening["created_at"],
                    status=screening["status"],
                    label=screening["result"]["label"] if screening["result"] else None,
                )
                for screening in self.repository.list_screenings(owner_uid, limit)
            ]
        )

    def delete(self, owner_uid: str, screening_id: str) -> None:
        self._owned(owner_uid, screening_id)
        self.blobs.delete_prefix(f"screenings/{screening_id}")
        self.repository.delete_screening(screening_id)

    def _owned(
        self, owner_uid: str, screening_id: str, refuse_while_analyzing: bool = False
    ) -> dict:
        screening = self.repository.get_screening(screening_id)
        if screening is None or screening["owner_uid"] != owner_uid:
            raise ApiError("screening_not_found")
        if refuse_while_analyzing and analysis_is_running(screening, datetime.now(UTC)):
            raise ApiError("analysis_in_progress")
        return screening

    def _remove_location(self, screening_id: str, location: Location) -> None:
        for recording in self.repository.list_recordings(screening_id):
            if recording["location"] == location:
                if recording["storage_path"]:
                    self.blobs.delete(recording["storage_path"])
                self.repository.delete_recording(screening_id, recording["recording_id"])

    def _status_after_upload(self, screening_id: str) -> ScreeningStatus:
        recordings = self.repository.list_recordings(screening_id)
        if any(recording["accepted"] for recording in recordings):
            return ScreeningStatus.ready
        return ScreeningStatus.awaiting_recordings

    def _analysis(self, screening: dict) -> AnalyzeResponse:
        return AnalyzeResponse(
            screening_id=screening["screening_id"],
            status=screening["status"],
            result=screening["result"],
            explanation=screening["explanation"],
            report_summaries=[],
            disclaimer=DISCLAIMER,
            completed_at=screening["completed_at"],
        )
