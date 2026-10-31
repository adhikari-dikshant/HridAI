import type { UploadRecordingInput, UploadReportInput } from './client';
import type {
  AnalyzeResponse,
  ChestLocation,
  CreatePatientRequest,
  CreateScreeningRequest,
  CreateScreeningResponse,
  Label,
  Patient,
  RecordingResponse,
  ReportResponse,
  ScreeningDetail,
  ScreeningListItem,
  Source,
  UpdatePatientRequest,
} from './types';

import { isChestLocation } from '@/constants/chest-locations';

// In-memory stand-in for the backend, used when EXPO_PUBLIC_API_BASE_URL is not set.
// Results alternate between "normal" and "needs_checkup" so both result screens can be seen.
// Neck (NK) recordings follow the backend: stored and checked, but left out of status and results.

type MockRecording = RecordingResponse & { source: Source };
type MockScreening = Omit<ScreeningDetail, 'recordings'> & { recordings: MockRecording[] };

const patients = new Map<string, Patient>();
const screenings = new Map<string, MockScreening>();
let counter = 0;

const DISCLAIMER = {
  en: 'This is an AI screening tool, not a medical diagnosis. Always consult a doctor.',
  hi: 'यह एक AI स्क्रीनिंग टूल है, मेडिकल निदान नहीं। हमेशा डॉक्टर से सलाह लें।',
};

const EXPLANATIONS: Record<Exclude<Label, 'unclear'>, AnalyzeResponse['explanation']> = {
  normal: {
    en: 'No unusual sound was found in these recordings. If you have symptoms, please still see a doctor.',
    hi: 'इन रिकॉर्डिंग में कोई असामान्य आवाज़ नहीं मिली। अगर आपको कोई तकलीफ़ है, तो फिर भी डॉक्टर से मिलें।',
  },
  needs_checkup: {
    en: 'The recording from the left side of your chest had a sound pattern that is sometimes seen with heart murmurs. This is not a diagnosis. Please visit a doctor for a proper check-up.',
    hi: 'आपकी छाती के बाईं ओर की रिकॉर्डिंग में ऐसी आवाज़ मिली जो कभी-कभी हार्ट मर्मर में होती है। यह निदान नहीं है। कृपया सही जाँच के लिए डॉक्टर से मिलें।',
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function get(id: string) {
  const screening = screenings.get(id);
  if (!screening) throw new Error('This screening does not exist.');
  return screening;
}

function getPatient(id: string) {
  const patient = patients.get(id);
  if (!patient) throw new Error('This patient does not exist.');
  return patient;
}

function acceptedChest(screening: MockScreening) {
  return screening.recordings.filter((r) => r.accepted && isChestLocation(r.location));
}

export const mockApi = {
  async listPatients(): Promise<Patient[]> {
    await delay(300);
    const lastActivity = (p: Patient) => p.last_screening_at ?? p.created_at;
    return [...patients.values()].reverse().sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
  },

  async getPatient(id: string): Promise<Patient> {
    await delay(300);
    return getPatient(id);
  },

  async createPatient({ consent: _consent, ...details }: CreatePatientRequest): Promise<Patient> {
    await delay(300);
    const now = new Date().toISOString();
    const patient: Patient = {
      height_cm: null,
      weight_kg: null,
      known_conditions: [],
      ...details,
      patient_id: `pat_mock${++counter}`,
      last_screening_at: null,
      created_at: now,
      updated_at: now,
    };
    patients.set(patient.patient_id, patient);
    return patient;
  },

  async updatePatient(id: string, body: UpdatePatientRequest): Promise<Patient> {
    await delay(300);
    const patient = { ...getPatient(id), ...body, updated_at: new Date().toISOString() };
    patients.set(id, patient);
    return patient;
  },

  async deletePatient(id: string): Promise<void> {
    await delay(300);
    patients.delete(id);
    for (const screening of screenings.values()) {
      if (screening.patient_id === id) screenings.delete(screening.screening_id);
    }
  },

  async createScreening(body: CreateScreeningRequest): Promise<CreateScreeningResponse> {
    await delay(400);
    const patient = getPatient(body.patient_id);
    const screening_id = `scr_mock${++counter}`;
    const created_at = new Date().toISOString();
    screenings.set(screening_id, {
      screening_id,
      patient_id: patient.patient_id,
      status: 'awaiting_recordings',
      language: body.language,
      created_at,
      patient: {
        age_years: patient.age_years,
        sex: patient.sex,
        height_cm: patient.height_cm,
        weight_kg: patient.weight_kg,
        symptoms: body.symptoms ?? [],
        known_conditions: patient.known_conditions,
      },
      recordings: [],
      analysis: null,
    });
    return {
      screening_id,
      patient_id: patient.patient_id,
      status: 'awaiting_recordings',
      required_locations: ['MV', 'AV', 'NK'],
      optional_locations: ['PV', 'TV'],
      created_at,
    };
  },

  async uploadRecording(id: string, input: UploadRecordingInput): Promise<RecordingResponse> {
    await delay(1200);
    const screening = get(id);
    const duration_s = input.durationMs / 1000;
    const accepted = duration_s >= 8;
    const base = {
      recording_id: `rec_${Date.now()}`,
      location: input.location,
      screening_status: screening.status,
    };
    const response: RecordingResponse = accepted
      ? {
          ...base,
          accepted: true,
          quality: { score: 0.82, duration_s, heart_rate_bpm: 78, issues: [] },
        }
      : {
          ...base,
          accepted: false,
          quality: { score: 0.2, duration_s, heart_rate_bpm: null, issues: ['too_short'] },
          message_en: 'Recording was too short. Hold still for the full 15 seconds.',
          message_hi: 'रिकॉर्डिंग बहुत छोटी थी। पूरे 15 सेकंड तक स्थिर रहें।',
        };

    screening.recordings = [
      ...screening.recordings.filter((r) => r.location !== input.location),
      { ...response, source: input.source },
    ];
    if (isChestLocation(input.location)) {
      if (screening.status !== 'completed') {
        screening.status = acceptedChest(screening).length > 0 ? 'ready' : 'awaiting_recordings';
      }
      response.screening_status = screening.status;
    }
    return response;
  },

  async uploadReport(id: string, input: UploadReportInput): Promise<ReportResponse> {
    await delay(1500);
    get(id);
    return {
      report_id: `rep_${Date.now()}`,
      summary_en: `Sample summary of ${input.name}: ECG report noted normal sinus rhythm.`,
      summary_hi: `${input.name} का नमूना सारांश: ECG रिपोर्ट में सामान्य हृदय गति बताई गई है।`,
    };
  },

  async analyze(id: string): Promise<AnalyzeResponse> {
    await delay(2500);
    const screening = get(id);
    const accepted = acceptedChest(screening);
    if (accepted.length === 0) throw new Error('Record at least one chest spot first.');

    const label = counter % 2 === 1 ? 'normal' : 'needs_checkup';
    const abnormal = label === 'normal' ? 0.18 : 0.81;
    const response: AnalyzeResponse = {
      screening_id: id,
      status: 'completed',
      result: {
        label,
        confidence: label === 'normal' ? 1 - abnormal : abnormal,
        abnormal_probability: abnormal,
        heart_rate_bpm: 76,
        per_location: accepted.map((r, i) => ({
          location: r.location as ChestLocation,
          abnormal_probability: i === 0 ? abnormal : 0.3,
          quality_score: r.quality.score,
          heatmap_url: null,
        })),
        used_patient_data: true,
        model_version: 'mock',
      },
      explanation: EXPLANATIONS[label],
      report_summaries: [],
      disclaimer: DISCLAIMER,
      completed_at: new Date().toISOString(),
    };

    screening.status = 'completed';
    screening.analysis = response;
    const patient = getPatient(screening.patient_id);
    patients.set(patient.patient_id, { ...patient, last_screening_at: response.completed_at });
    return response;
  },

  async getScreening(id: string): Promise<ScreeningDetail> {
    await delay(300);
    const screening = get(id);
    return {
      ...screening,
      recordings: screening.recordings.map((r) => ({
        recording_id: r.recording_id,
        location: r.location,
        source: r.source,
        platform: 'android',
        accepted: r.accepted,
        quality: r.quality,
        created_at: screening.created_at,
      })),
    };
  },

  async listScreenings(patientId?: string): Promise<ScreeningListItem[]> {
    await delay(300);
    return [...screenings.values()]
      .filter((s) => !patientId || s.patient_id === patientId)
      .reverse()
      .map((s) => ({
        screening_id: s.screening_id,
        patient_id: s.patient_id,
        created_at: s.created_at,
        status: s.status,
        label: s.analysis?.result.label ?? null,
      }));
  },

  async deleteScreening(id: string): Promise<void> {
    await delay(300);
    screenings.delete(id);
  },
};
