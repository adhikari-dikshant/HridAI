import {
  requestRecordingPermissionsAsync,
  useAudioStream,
  type AudioStreamFileRecordingResult,
  type PermissionResponse,
} from 'expo-audio';
import { useRef, useState } from 'react';

const SAMPLE_RATE = 48000;
const INT16_MAX = 32767;
// Same clipping rule as the backend quality check: |x| >= 0.99 on under 1% of samples.
const CLIP_THRESHOLD = 0.99 * INT16_MAX;
const MAX_CLIPPED_RATIO = 0.01;
// Floor of the level meter, in dBFS.
const SILENCE_DB = -60;

export type HeartRecorderStatus = 'idle' | 'recording' | 'stopping' | 'done' | 'error';

export type LocalIssue = 'too_short' | 'clipping';

export type HeartRecording = AudioStreamFileRecordingResult & {
  clippedRatio: number;
  issues: LocalIssue[];
};

export type InputLevel = {
  /** RMS of the latest buffer in dBFS, clamped to SILENCE_DB. */
  db: number;
  /** 0-1, for driving a level meter. */
  value: number;
  /** The latest buffer had too many clipped samples. */
  clipping: boolean;
};

type HeartRecorderOptions = {
  durationMs?: number;
  minDurationMs?: number;
  /** Number of time slices in `levelHistory`, one per bar of the level meter. */
  historySlices?: number;
};

const SILENT_LEVEL: InputLevel = { db: SILENCE_DB, value: 0, clipping: false };

/**
 * Records raw 16-bit mono PCM from the built-in mic to a WAV file, with a live
 * input level and clipping check. Auto-stops after `durationMs`.
 */
export function useHeartRecorder({
  durationMs = 15_000,
  minDurationMs = 8_000,
  historySlices = 40,
}: HeartRecorderOptions = {}) {
  const [status, setStatus] = useState<HeartRecorderStatus>('idle');
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState<InputLevel>(SILENT_LEVEL);
  // Peak level per slice of the recording; null for slices not reached yet.
  const [levelHistory, setLevelHistory] = useState<(number | null)[]>(() =>
    emptyHistory(historySlices)
  );
  const [recording, setRecording] = useState<HeartRecording | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only true while buffers are also being written to the file.
  const activeRef = useRef(false);
  const totalsRef = useRef({ samples: 0, clipped: 0 });

  const { stream } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer) => {
      if (!activeRef.current) return;

      const stats = measure(buffer.data);
      const totals = totalsRef.current;
      totals.samples += stats.samples;
      totals.clipped += stats.clipped;

      setLevel(stats.level);

      const ms = (totals.samples / buffer.sampleRate) * 1000;
      setElapsedMs(Math.min(ms, durationMs));
      const slice = Math.min(Math.floor((ms / durationMs) * historySlices), historySlices - 1);
      setLevelHistory((history) => {
        const next = [...history];
        next[slice] = Math.max(next[slice] ?? 0, stats.level.value);
        return next;
      });
      if (ms >= durationMs) void stop();
    },
  });

  async function requestPermission() {
    const response = await requestRecordingPermissionsAsync();
    setPermission(response);
    return response.granted;
  }

  async function start() {
    if (activeRef.current || status === 'stopping') return false;

    setError(null);
    setRecording(null);
    setElapsedMs(0);
    setLevel(SILENT_LEVEL);
    setLevelHistory(emptyHistory(historySlices));
    totalsRef.current = { samples: 0, clipped: 0 };

    if (!(await requestPermission())) return false;

    try {
      await stream.start();
      await stream.startFileRecordingAsync({ format: 'wav' });
      activeRef.current = true;
      setStatus('recording');
      return true;
    } catch (e) {
      stream.stop();
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      return false;
    }
  }

  async function stop() {
    if (!activeRef.current) return null;
    activeRef.current = false;
    setStatus('stopping');

    try {
      const file = await stream.stopFileRecordingAsync();
      stream.stop();

      const { samples, clipped } = totalsRef.current;
      const clippedRatio = samples > 0 ? clipped / samples : 0;
      const issues: LocalIssue[] = [];
      if (file.duration * 1000 < minDurationMs) issues.push('too_short');
      if (clippedRatio >= MAX_CLIPPED_RATIO) issues.push('clipping');

      const result: HeartRecording = { ...file, clippedRatio, issues };
      setRecording(result);
      setLevel(SILENT_LEVEL);
      setStatus('done');
      return result;
    } catch (e) {
      stream.stop();
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      return null;
    }
  }

  /** Stops without producing a result. The partial file stays in the cache directory. */
  function cancel() {
    activeRef.current = false;
    stream.stop();
    setElapsedMs(0);
    setLevel(SILENT_LEVEL);
    setLevelHistory(emptyHistory(historySlices));
    setStatus('idle');
  }

  return {
    status,
    permission,
    elapsedMs,
    durationMs,
    level,
    levelHistory,
    recording,
    error,
    requestPermission,
    start,
    stop,
    cancel,
  };
}

function emptyHistory(slices: number): (number | null)[] {
  return Array.from({ length: slices }, () => null);
}

function measure(data: ArrayBuffer) {
  const pcm = new Int16Array(data);
  let sumSquares = 0;
  let clipped = 0;

  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i];
    sumSquares += sample * sample;
    if (Math.abs(sample) >= CLIP_THRESHOLD) clipped++;
  }

  const rms = pcm.length > 0 ? Math.sqrt(sumSquares / pcm.length) / INT16_MAX : 0;
  const db = rms > 0 ? Math.max(20 * Math.log10(rms), SILENCE_DB) : SILENCE_DB;

  return {
    samples: pcm.length,
    clipped,
    level: {
      db,
      value: 1 - db / SILENCE_DB,
      clipping: pcm.length > 0 && clipped / pcm.length >= MAX_CLIPPED_RATIO,
    },
  };
}
