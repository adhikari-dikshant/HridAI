// Copy of the shared API v1 types from the team context doc (section 8).
// Any change here must be agreed with the backend first.

export type Lang = 'en' | 'hi';
export type ChestLocation = 'MV' | 'AV' | 'PV' | 'TV';
export type Location = ChestLocation | 'NK';
export type Label = 'normal' | 'needs_checkup' | 'unclear';
export type Sex = 'male' | 'female' | 'other';
export type Source = 'phone_mic' | 'stethoscope_mic';
export type Platform = 'ios' | 'android';
export type Symptom =
  | 'chest_pain'
  | 'breathlessness'
  | 'palpitations'
  | 'fatigue'
  | 'fainting'
  | 'swelling';
export type KnownCondition = 'hypertension' | 'diabetes' | 'known_heart_disease' | 'other';
export type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obese';
export type ScreeningStatus =
  | 'awaiting_recordings'
  | 'ready'
  | 'analyzing'
  | 'completed'
  | 'failed';

export type QualityIssue =
  | 'too_short'
  | 'too_quiet'
  | 'clipping'
  | 'too_noisy'
  | 'no_heartbeat_detected'
  | 'heart_rate_out_of_range';

export interface Consent {
  accepted: true;
  version: string;
}

/** Fields of a profile. `label` is a nickname or code, never a full name. */
export interface PatientDetails {
  label: string;
  age_years: number;
  sex: Sex;
  height_cm?: number | null;
  weight_kg?: number | null;
  known_conditions?: KnownCondition[];
}

export interface CreatePatientRequest extends PatientDetails {
  consent: Consent;
}

/** Send only what changed. Only height and weight can be cleared with null. */
export type UpdatePatientRequest = Partial<PatientDetails>;

export interface Patient {
  patient_id: string;
  label: string;
  age_years: number;
  sex: Sex;
  height_cm: number | null;
  weight_kg: number | null;
  known_conditions: KnownCondition[];
  last_screening_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The patient's details when a screening was made. Never holds the label. */
export interface PatientSnapshot {
  age_years: number;
  sex: Sex;
  height_cm: number | null;
  weight_kg: number | null;
  symptoms: Symptom[];
  known_conditions: KnownCondition[];
}

export interface CreateScreeningRequest {
  language: Lang;
  consent: Consent;
  patient_id: string;
  symptoms?: Symptom[];
}

export interface CreateScreeningResponse {
  screening_id: string;
  patient_id: string;
  status: ScreeningStatus;
  required_locations: Location[];
  optional_locations: Location[];
  created_at: string;
}

export interface Quality {
  score: number;
  duration_s: number;
  heart_rate_bpm: number | null;
  issues: QualityIssue[];
}

export interface RecordingResponse {
  recording_id: string;
  location: Location;
  accepted: boolean;
  quality: Quality;
  message_en?: string;
  message_hi?: string;
  screening_status: ScreeningStatus;
}

/** POST /v1/screenings/{id}/reports (stretch). Upload before analyze. */
export interface ReportResponse {
  report_id: string;
  summary_en: string;
  summary_hi: string;
}

/** Extra information beside the result. It never changes the result. */
export interface HealthSummary {
  /** Null when height or weight is missing or looks mistyped. */
  bmi: number | null;
  /** Null for anyone under 18, who gets the number only. */
  bmi_category: BmiCategory | null;
  symptoms: Symptom[];
  known_conditions: KnownCondition[];
  suggestions: Record<Lang, string[]>;
}

export interface AnalyzeResponse {
  screening_id: string;
  status: 'completed' | 'failed';
  result: {
    label: Label;
    confidence: number;
    abnormal_probability: number;
    heart_rate_bpm: number | null;
    per_location: {
      location: ChestLocation;
      abnormal_probability: number;
      quality_score: number;
      heatmap_url: string | null;
    }[];
    used_patient_data: boolean;
    model_version: string;
  };
  explanation: Record<Lang, string>;
  report_summaries: { report_id: string; summary_en: string; summary_hi: string }[];
  health_summary: HealthSummary;
  disclaimer: Record<Lang, string>;
  completed_at: string;
}

export interface ScreeningListItem {
  screening_id: string;
  patient_id: string;
  created_at: string;
  status: ScreeningStatus;
  label: Label | null;
}

export interface RecordingSummary {
  recording_id: string;
  location: Location;
  source: Source;
  platform: Platform;
  accepted: boolean;
  quality: Quality;
  created_at: string;
}

/** GET /v1/screenings/{id}. `analysis` is null until the screening is completed. */
export interface ScreeningDetail {
  screening_id: string;
  patient_id: string;
  status: ScreeningStatus;
  language: Lang;
  created_at: string;
  patient: PatientSnapshot;
  recordings: RecordingSummary[];
  analysis: AnalyzeResponse | null;
}

export interface ApiErrorBody {
  code: string;
  message_en: string;
  message_hi: string;
}
