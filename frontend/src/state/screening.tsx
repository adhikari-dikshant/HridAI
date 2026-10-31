import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import type {
  AnalyzeResponse,
  CreateScreeningResponse,
  Lang,
  Location,
  Patient,
  RecordingResponse,
  Source,
  Symptom,
} from '@/api/types';
import { isChestLocation } from '@/constants/chest-locations';
import { translate, type StringKey } from '@/i18n/strings';
import { clearRecordingFiles } from '@/utils/recording-files';

const LANG_KEY = 'hridai.lang';

type Session = CreateScreeningResponse & {
  patient: Patient;
  symptoms: Symptom[];
  recordings: Partial<Record<Location, RecordingResponse>>;
  /** Latest recording on this phone per spot, for listening back. */
  localFiles: Partial<Record<Location, string>>;
  /** Failed tries in a row per spot. */
  failedTries: Partial<Record<Location, number>>;
  skipped: Location[];
};

type ScreeningState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;

  source: Source;
  setSource: (source: Source) => void;

  /** The screening being recorded right now. */
  session: Session | null;
  startSession: (created: CreateScreeningResponse, patient: Patient, symptoms: Symptom[]) => void;
  saveRecording: (recording: RecordingResponse) => void;
  saveLocalFile: (location: Location, uri: string) => void;
  /** Counts a recording the phone rejected before upload. */
  countFailure: (location: Location) => void;
  skipSpot: (location: Location) => void;
  clearLocalFiles: () => void;
  endSession: () => void;

  /** Latest analyze response, shown on the result screen. */
  result: AnalyzeResponse | null;
  setResult: (result: AnalyzeResponse | null) => void;
};

/** Analyze needs one accepted chest recording, and the neck never counts. */
export function hasAcceptedChest(session: Session) {
  return Object.values(session.recordings).some((r) => r?.accepted && isChestLocation(r.location));
}

/** The next spot to record, leaving out skipped ones and the one being left. */
export function nextSpot(session: Session, leaving?: Location) {
  return session.required_locations.find(
    (l) => l !== leaving && !session.skipped.includes(l) && !session.recordings[l]?.accepted
  );
}

const ScreeningContext = createContext<ScreeningState | null>(null);

export function ScreeningProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [source, setSource] = useState<Source>('phone_mic');
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    // Recordings from a screening the app closed on can't be reached again.
    clearRecordingFiles();
    AsyncStorage.getItem(LANG_KEY)
      .then((saved) => {
        if (saved === 'en' || saved === 'hi') setLangState(saved);
      })
      .catch(() => {});
  }, []);

  function updateSession(change: (current: Session) => Session) {
    setSession((current) => (current ? change(current) : current));
  }

  function addFailure(current: Session, location: Location) {
    const tries = (current.failedTries[location] ?? 0) + 1;
    return { ...current.failedTries, [location]: tries };
  }

  const value: ScreeningState = {
    lang,
    setLang: (next) => {
      setLangState(next);
      AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
    },
    t: (key, vars) => translate(lang, key, vars),
    source,
    setSource,
    session,
    startSession: (created, patient, symptoms) => {
      clearRecordingFiles();
      setSession({
        ...created,
        patient,
        symptoms,
        recordings: {},
        localFiles: {},
        failedTries: {},
        skipped: [],
      });
      setResult(null);
    },
    saveRecording: (recording) =>
      updateSession((current) => {
        const { location, accepted } = recording;
        return {
          ...current,
          recordings: { ...current.recordings, [location]: recording },
          failedTries: accepted
            ? { ...current.failedTries, [location]: 0 }
            : addFailure(current, location),
          skipped: accepted ? current.skipped.filter((l) => l !== location) : current.skipped,
        };
      }),
    saveLocalFile: (location, uri) =>
      updateSession((current) => ({
        ...current,
        localFiles: { ...current.localFiles, [location]: uri },
      })),
    countFailure: (location) =>
      updateSession((current) => ({ ...current, failedTries: addFailure(current, location) })),
    skipSpot: (location) =>
      updateSession((current) => ({ ...current, skipped: [...current.skipped, location] })),
    clearLocalFiles: () => {
      clearRecordingFiles();
      updateSession((current) => ({ ...current, localFiles: {} }));
    },
    endSession: () => {
      clearRecordingFiles();
      setSession(null);
      setResult(null);
    },
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
