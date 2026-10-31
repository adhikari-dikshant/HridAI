import { createContext, use, useState, type ReactNode } from 'react';

import type {
  AnalyzeResponse,
  CreateScreeningResponse,
  Lang,
  Location,
  RecordingResponse,
  Source,
  Symptom,
} from '@/api/types';
import { translate, type StringKey } from '@/i18n/strings';

type Session = CreateScreeningResponse & {
  symptoms: Symptom[];
  recordings: Partial<Record<Location, RecordingResponse>>;
};

type ScreeningState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;

  source: Source;
  setSource: (source: Source) => void;

  /** The screening being recorded right now. */
  session: Session | null;
  startSession: (created: CreateScreeningResponse, symptoms: Symptom[]) => void;
  saveRecording: (recording: RecordingResponse) => void;

  /** Latest analyze response, shown on the result screen. */
  result: AnalyzeResponse | null;
  setResult: (result: AnalyzeResponse | null) => void;
};

const ScreeningContext = createContext<ScreeningState | null>(null);

export function ScreeningProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const [source, setSource] = useState<Source>('phone_mic');
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const value: ScreeningState = {
    lang,
    setLang,
    t: (key, vars) => translate(lang, key, vars),
    source,
    setSource,
    session,
    startSession: (created, symptoms) => {
      setSession({ ...created, symptoms, recordings: {} });
      setResult(null);
    },
    saveRecording: (recording) =>
      setSession((current) =>
        current
          ? { ...current, recordings: { ...current.recordings, [recording.location]: recording } }
          : current
      ),
    result,
    setResult,
  };

  return <ScreeningContext value={value}>{children}</ScreeningContext>;
}

export function useScreening() {
  const context = use(ScreeningContext);
  if (!context) throw new Error('useScreening must be used inside ScreeningProvider');
  return context;
}
