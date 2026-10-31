import type { UploadRecordingInput, UploadReportInput } from './client';
import type {
  AnalyzeResponse,
  CreateScreeningRequest,
  CreateScreeningResponse,
  Label,
  RecordingResponse,
  ReportResponse,
  ScreeningDetail,
  ScreeningListItem,
} from './types';

// In-memory stand-in for the backend, used when EXPO_PUBLIC_API_BASE_URL is not set.
// Results alternate between "normal" and "needs_checkup" so both result screens can be seen.

type MockScreening = ScreeningDetail & { recordings: RecordingResponse[] };

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

export const mockApi = {
  async createScreening(body: CreateScreeningRequest): Promise<CreateScreeningResponse> {
    await delay(400);
    const screening_id = `scr_mock${++counter}`;
    const created_at = new Date().toISOString();
    screenings.set(screening_id, {
      screening_id,
      created_at,
      status: 'awaiting_recordings',
      patient: body.patient,
      recordings: [],
    });
    return {
      screening_id,
      status: 'awaiting_recordings',
      required_locations: ['MV', 'AV'],
      optional_locations: ['PV', 'TV'],
      created_at,
    };
  },

  async uploadRecording(id: string, input: UploadRecordingInput): Promise<RecordingResponse> {
    await delay(1200);
    const screening = get(id);
    const duration_s = input.durationMs / 1000;
    const accepted = duration_s >= 8;
    const response: RecordingResponse = accepted
      ? {
          recording_id: `rec_${Date.now()}`,
          location: input.location,
          accepted: true,
          quality: { score: 0.82, duration_s, heart_rate_bpm: 78, issues: [] },
          screening_status: 'ready',
        }
      : {
          recording_id: `rec_${Date.now()}`,
          location: input.location,
          accepted: false,
          quality: { score: 0.2, duration_s, heart_rate_bpm: null, issues: ['too_short'] },
          message_en: 'Recording was too short. Hold still for the full 15 seconds.',
          message_hi: 'रिकॉर्डिंग बहुत छोटी थी। पूरे 15 सेकंड तक स्थिर रहें।',
          screening_status: screening.status,
        };

    screening.recordings = [
      ...screening.recordings.filter((r) => r.location !== input.location),
      response,
    ];
    if (accepted) screening.status = 'ready';
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
    const accepted = screening.recordings.filter((r) => r.accepted);
    if (accepted.length === 0) throw new Error('Record at least one spot first.');

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
          location: r.location,
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

    Object.assign(screening, { ...response, status: 'completed' });
    return response;
  },

  async getScreening(id: string): Promise<ScreeningDetail> {
    await delay(300);
    return get(id);
  },

  async listScreenings(): Promise<ScreeningListItem[]> {
    await delay(300);
    return [...screenings.values()].reverse().map((s) => ({
      screening_id: s.screening_id,
      created_at: s.created_at,
      status: s.status,
      label: s.result?.label ?? null,
    }));
  },

  async deleteScreening(id: string): Promise<void> {
    await delay(300);
    screenings.delete(id);
  },
};
