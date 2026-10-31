import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

import { mockApi } from './mock';
import type {
  AnalyzeResponse,
  ApiErrorBody,
  CreatePatientRequest,
  CreateScreeningRequest,
  CreateScreeningResponse,
  Lang,
  Location,
  Patient,
  RecordingResponse,
  ReportResponse,
  ScreeningDetail,
  ScreeningListItem,
  Source,
  UpdatePatientRequest,
} from './types';

import { getLoginToken } from '@/auth/phone-auth';
import { translate } from '@/i18n/strings';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
// Local backend with AUTH_MODE=dev only. Never set this in a production build.
const DEV_UID = process.env.EXPO_PUBLIC_DEV_UID;
const ANALYZE_TIMEOUT_MS = 45_000;

/** Without a backend URL the app runs against an in-memory mock. */
export const isMockApi = !BASE_URL;
/** The mock and dev login don't use the phone login. */
export const requiresLogin = !isMockApi && !DEV_UID;
/** Off until the backend has report upload. Turning it on brings the step back. */
export const reportsEnabled = false;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null
  ) {
    super(body?.message_en ?? `Request failed (${status})`);
  }
}

async function getAuthToken(): Promise<string | null> {
  if (DEV_UID) return `dev:${DEV_UID}`;
  return requiresLogin ? getLoginToken() : null;
}

/** The backend's own message when there is one, otherwise what most likely went wrong. */
export function errorMessage(error: unknown, lang: Lang) {
  if (error instanceof ApiError && error.body) {
    return lang === 'hi' ? error.body.message_hi : error.body.message_en;
  }
  if ((error as Error | null)?.name === 'AbortError') return translate(lang, 'error.timeout');
  if (error instanceof TypeError) return translate(lang, 'error.offline');
  return translate(lang, 'genericError');
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const token = await getAuthToken();
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const res = await fetch(`${BASE_URL}/v1${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (res.status === 204) return undefined as T;

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, body?.error ?? null);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Uploads a file from the phone. Expo's fetch can't send React Native's { uri } file parts. */
async function uploadFile<T>(
  path: string,
  uri: string,
  mimeType: string,
  parameters?: Record<string, string>
): Promise<T> {
  const token = await getAuthToken();
  const { status, body } = await new File(uri).upload(`${BASE_URL}/v1${path}`, {
    uploadType: UploadType.MULTIPART,
    // Android otherwise names the field after the file.
    fieldName: 'file',
    mimeType,
    parameters,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Not JSON, so there is no backend message to show.
  }
  if (status < 200 || status >= 300) throw new ApiError(status, parsed?.error ?? null);
  return parsed as T;
}

function json(body: unknown, method = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export type UploadRecordingInput = {
  uri: string;
  location: Location;
  source: Source;
  durationMs: number;
};

export type UploadReportInput = {
  uri: string;
  name: string;
  /** image/jpeg, image/png or application/pdf. */
  mimeType: string;
};

const realApi = {
  listPatients: () => request<{ items: Patient[] }>('/patients?limit=100').then((r) => r.items),

  getPatient: (patientId: string) => request<Patient>(`/patients/${patientId}`),

  createPatient: (body: CreatePatientRequest) => request<Patient>('/patients', json(body)),

  updatePatient: (patientId: string, body: UpdatePatientRequest) =>
    request<Patient>(`/patients/${patientId}`, json(body, 'PATCH')),

  deletePatient: (patientId: string) =>
    request<void>(`/patients/${patientId}`, { method: 'DELETE' }),

  createScreening: (body: CreateScreeningRequest) =>
    request<CreateScreeningResponse>('/screenings', json(body)),

  uploadRecording: (screeningId: string, input: UploadRecordingInput) =>
    uploadFile<RecordingResponse>(`/screenings/${screeningId}/recordings`, input.uri, 'audio/wav', {
      location: input.location,
      source: input.source,
      duration_ms: String(Math.round(input.durationMs)),
      platform: Platform.OS,
    }),

  uploadReport: (screeningId: string, input: UploadReportInput) =>
    uploadFile<ReportResponse>(`/screenings/${screeningId}/reports`, input.uri, input.mimeType),

  analyze: (screeningId: string) =>
    request<AnalyzeResponse>(
      `/screenings/${screeningId}/analyze`,
      { method: 'POST' },
      ANALYZE_TIMEOUT_MS
    ),

  getScreening: (screeningId: string) => request<ScreeningDetail>(`/screenings/${screeningId}`),

  listScreenings: (patientId?: string) =>
    request<{ items: ScreeningListItem[] }>(
      `/screenings?limit=20${patientId ? `&patient_id=${patientId}` : ''}`
    ).then((r) => r.items),

  deleteScreening: (screeningId: string) =>
    request<void>(`/screenings/${screeningId}`, { method: 'DELETE' }),
};

export const api: typeof realApi = isMockApi ? mockApi : realApi;
