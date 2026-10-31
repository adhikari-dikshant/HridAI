from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, StringConstraints


class Lang(StrEnum):
    en = "en"
    hi = "hi"


class Location(StrEnum):
    MV = "MV"
    AV = "AV"
    PV = "PV"
    TV = "TV"
    NK = "NK"


ChestLocation = Literal[Location.MV, Location.AV, Location.PV, Location.TV]


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


class BmiCategory(StrEnum):
    underweight = "underweight"
    healthy = "healthy"
    overweight = "overweight"
    obese = "obese"


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


PatientLabel = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
AgeYears = Annotated[int, Field(ge=0, le=110)]
HeightCm = Annotated[float, Field(gt=0, le=250)]
WeightKg = Annotated[float, Field(gt=0, le=300)]


class PatientDetails(BaseModel):
    label: PatientLabel
    age_years: AgeYears
    sex: Sex
    height_cm: HeightCm | None = None
    weight_kg: WeightKg | None = None
    known_conditions: list[KnownCondition] = []


class PatientCreate(PatientDetails):
    consent: Consent


class PatientUpdate(BaseModel):
    # A field left out stays as it is. Only height and weight can be cleared with null.
    label: PatientLabel = None
    age_years: AgeYears = None
    sex: Sex = None
    height_cm: HeightCm | None = None
    weight_kg: WeightKg | None = None
    known_conditions: list[KnownCondition] = None


class Patient(PatientDetails):
    patient_id: str
    last_screening_at: UtcTimestamp | None
    created_at: UtcTimestamp
    updated_at: UtcTimestamp


class PatientList(BaseModel):
    items: list[Patient]


class PatientSnapshot(BaseModel):
    """The patient's details when a screening was made. Never holds the label."""

    age_years: int
    sex: Sex
    height_cm: float | None
    weight_kg: float | None
    symptoms: list[Symptom]
    known_conditions: list[KnownCondition]


class ScreeningCreate(BaseModel):
    language: Lang
    consent: Consent
    patient_id: str
    symptoms: list[Symptom] = []


class ScreeningCreated(BaseModel):
    screening_id: str
    patient_id: str
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
    location: ChestLocation
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


class HealthSummary(BaseModel):
    bmi: float | None
    bmi_category: BmiCategory | None
    symptoms: list[Symptom]
    known_conditions: list[KnownCondition]
    suggestions: dict[Lang, list[str]]


class AnalyzeResponse(BaseModel):
    screening_id: str
    status: ScreeningStatus
    result: ScreeningResult
    explanation: dict[Lang, str]
    report_summaries: list[ReportSummary]
    health_summary: HealthSummary
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
    patient_id: str
    status: ScreeningStatus
    language: Lang
    created_at: UtcTimestamp
    patient: PatientSnapshot
    recordings: list[RecordingSummary]
    analysis: AnalyzeResponse | None


class ScreeningListItem(BaseModel):
    screening_id: str
    patient_id: str
    created_at: UtcTimestamp
    status: ScreeningStatus
    label: Label | None


class ScreeningList(BaseModel):
    items: list[ScreeningListItem]
