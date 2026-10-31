// Copy of the shared API v1 types from the team context doc (section 8).
// Any change here must be agreed with the backend first.

export type Lang = 'en' | 'hi';
export type Location = 'MV' | 'AV' | 'PV' | 'TV';
export type Label = 'normal' | 'needs_checkup' | 'unclear';
export type Sex = 'male' | 'female' | 'other';
export type Source = 'phone_mic' | 'stethoscope_mic';
export type Symptom =
  | 'chest_pain'
  | 'breathlessness'
  | 'palpitations'
  | 'fatigue'
  | 'fainting'
  | 'swelling';
export type KnownCondition = 'hypertension' | 'diabetes' | 'known_heart_disease' | 'other';
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

export interface Patient {
  age_years: number;
  sex: Sex;
  height_cm?: number;
  weight_kg?: number;
  symptoms?: Symptom[];
  known_conditions?: KnownCondition[];
}

export interface CreateScreeningRequest {
  language: Lang;
  consent: { accepted: true; version: string };
  patient: Patient;
}

export interface CreateScreeningResponse {
  screening_id: string;
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

export interface AnalyzeResponse {
  screening_id: string;
  status: 'completed' | 'failed';
  result: {
    label: Label;
    confidence: number;
    abnormal_probability: number;
    heart_rate_bpm: number | null;
    per_location: {
      location: Location;
      abnormal_probability: number;
      quality_score: number;
      heatmap_url: string | null;
    }[];
    used_patient_data: boolean;
    model_version: string;
  };
  explanation: Record<Lang, string>;
  report_summaries: { report_id: string; summary_en: string; summary_hi: string }[];
  disclaimer: Record<Lang, string>;
  completed_at: string;
}

export interface ScreeningListItem {
  screening_id: string;
  created_at: string;
  status: ScreeningStatus;
  label: Label | null;
}

/**
 * GET /v1/screenings/{id}. The doc only says it includes the analyze response when
 * completed; this assumes those fields sit at the top level. Confirm with backend.
 */
export type ScreeningDetail = {
  screening_id: string;
  created_at: string;
  status: ScreeningStatus;
  patient: Patient;
} & Partial<Omit<AnalyzeResponse, 'screening_id' | 'status'>>;

export interface ApiErrorBody {
  code: string;
  message_en: string;
  message_hi: string;
}
