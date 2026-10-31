from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer


class Lang(StrEnum):
    en = "en"
    hi = "hi"


class Location(StrEnum):
    MV = "MV"
    AV = "AV"
    PV = "PV"
    TV = "TV"


class Sex(StrEnum):
    male = "male"
    female = "female"
    other = "other"


class Symptom(StrEnum):
    chest_pain = "chest_pain"
    breathlessness = "breathlessness"
    palpitations = "palpitations"
    fatigue = "fatigue"
    fainting = "fainting"
    swelling = "swelling"


class KnownCondition(StrEnum):
    hypertension = "hypertension"
    diabetes = "diabetes"
    known_heart_disease = "known_heart_disease"
    other = "other"


class Label(StrEnum):
    normal = "normal"
    needs_checkup = "needs_checkup"
    unclear = "unclear"


class QualityIssue(StrEnum):
    too_short = "too_short"
    too_quiet = "too_quiet"
    clipping = "clipping"
    too_noisy = "too_noisy"
    no_heartbeat_detected = "no_heartbeat_detected"
    heart_rate_out_of_range = "heart_rate_out_of_range"


class ScreeningStatus(StrEnum):
    awaiting_recordings = "awaiting_recordings"
    ready = "ready"
    analyzing = "analyzing"
    completed = "completed"
    failed = "failed"


class Source(StrEnum):
    phone_mic = "phone_mic"
    stethoscope_mic = "stethoscope_mic"


class Platform(StrEnum):
    ios = "ios"
    android = "android"


UtcTimestamp = Annotated[
    datetime,
    PlainSerializer(lambda value: value.strftime("%Y-%m-%dT%H:%M:%SZ"), return_type=str),
]


class ErrorDetail(BaseModel):
    code: str
    message_en: str
    message_hi: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class Consent(BaseModel):
    accepted: bool
    version: str = Field(min_length=1, max_length=20)


class Patient(BaseModel):
    age_years: int = Field(ge=0, le=110)
    sex: Sex
    height_cm: float | None = Field(default=None, gt=0, le=250)
    weight_kg: float | None = Field(default=None, gt=0, le=300)
    symptoms: list[Symptom] = []
    known_conditions: list[KnownCondition] = []


class ScreeningCreate(BaseModel):
    language: Lang
    consent: Consent
    patient: Patient


class ScreeningCreated(BaseModel):
    screening_id: str
    status: ScreeningStatus
    required_locations: list[Location]
    optional_locations: list[Location]
    created_at: UtcTimestamp


class Quality(BaseModel):
    score: float
    duration_s: float
    heart_rate_bpm: int | None
    issues: list[QualityIssue]


class AcceptedRecording(BaseModel):
    recording_id: str
    location: Location
    accepted: bool
    quality: Quality
    screening_status: ScreeningStatus


class RejectedRecording(AcceptedRecording):
    message_en: str
    message_hi: str


class LocationResult(BaseModel):
    location: Location
    abnormal_probability: float
    quality_score: float
    heatmap_url: str | None


class ScreeningResult(BaseModel):
    label: Label
    confidence: float
    abnormal_probability: float
    heart_rate_bpm: int | None
    per_location: list[LocationResult]
    used_patient_data: bool
    model_version: str


class ReportSummary(BaseModel):
    report_id: str
    summary_en: str
    summary_hi: str


class AnalyzeResponse(BaseModel):
    screening_id: str
    status: ScreeningStatus
    result: ScreeningResult
    explanation: dict[Lang, str]
    report_summaries: list[ReportSummary]
    disclaimer: dict[Lang, str]
    completed_at: UtcTimestamp


class RecordingSummary(BaseModel):
    recording_id: str
    location: Location
    source: Source
    platform: Platform
    accepted: bool
    quality: Quality
    created_at: UtcTimestamp


class ScreeningDetail(BaseModel):
    screening_id: str
    status: ScreeningStatus
    language: Lang
    created_at: UtcTimestamp
    patient: Patient
    recordings: list[RecordingSummary]
    analysis: AnalyzeResponse | None


class ScreeningListItem(BaseModel):
    screening_id: str
    created_at: UtcTimestamp
    status: ScreeningStatus
    label: Label | None


class ScreeningList(BaseModel):
    items: list[ScreeningListItem]
