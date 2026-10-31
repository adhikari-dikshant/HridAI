import { Platform } from 'react-native';

import { mockApi } from './mock';
import type {
  AnalyzeResponse,
  ApiErrorBody,
  CreateScreeningRequest,
  CreateScreeningResponse,
  Location,
  RecordingResponse,
  ReportResponse,
  ScreeningDetail,
  ScreeningListItem,
  Source,
} from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const ANALYZE_TIMEOUT_MS = 45_000;

/** Without a backend URL the app runs against an in-memory mock. */
export const isMockApi = !BASE_URL;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null
  ) {
    super(body?.message_en ?? `Request failed (${status})`);
  }
}

// TODO: return the Firebase ID token once anonymous auth is added.
async function getAuthToken(): Promise<string | null> {
  return null;
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

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
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
  createScreening: (body: CreateScreeningRequest) =>
    request<CreateScreeningResponse>('/screenings', json(body)),

  uploadRecording: (screeningId: string, input: UploadRecordingInput) => {
    const form = new FormData();
    // React Native's FormData takes a { uri, name, type } file descriptor.
    form.append('file', {
      uri: input.uri,
      name: `${input.location}.wav`,
      type: 'audio/wav',
    } as unknown as Blob);
    form.append('location', input.location);
    form.append('source', input.source);
    form.append('duration_ms', String(Math.round(input.durationMs)));
    form.append('platform', Platform.OS);

    return request<RecordingResponse>(`/screenings/${screeningId}/recordings`, {
      method: 'POST',
      body: form,
    });
  },

  uploadReport: (screeningId: string, input: UploadReportInput) => {
    const form = new FormData();
    form.append('file', {
      uri: input.uri,
      name: input.name,
      type: input.mimeType,
    } as unknown as Blob);

    return request<ReportResponse>(`/screenings/${screeningId}/reports`, {
      method: 'POST',
      body: form,
    });
  },

  analyze: (screeningId: string) =>
    request<AnalyzeResponse>(
      `/screenings/${screeningId}/analyze`,
      { method: 'POST' },
      ANALYZE_TIMEOUT_MS
    ),

  getScreening: (screeningId: string) => request<ScreeningDetail>(`/screenings/${screeningId}`),

  listScreenings: () =>
    request<{ items: ScreeningListItem[] }>('/screenings?limit=20').then((r) => r.items),

  deleteScreening: (screeningId: string) =>
    request<void>(`/screenings/${screeningId}`, { method: 'DELETE' }),
};

export const api: typeof realApi = isMockApi ? mockApi : realApi;
