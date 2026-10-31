from dataclasses import dataclass
from typing import Protocol

import numpy as np
from scipy.signal import butter, find_peaks, hilbert, sosfiltfilt, welch

from app.core.audio_config import AUDIO
from app.schemas import Location, Quality, QualityIssue
from app.services.audio import preprocess
from app.services.decode import DECODE_RATE, decode
from app.services.result import MIN_QUALITY as MIN_ACCEPTED_SCORE

MIN_DURATION_MS = 8000

_MIN_SECONDS = MIN_DURATION_MS / 1000
_CLIP_LEVEL = 0.99
_MAX_CLIPPED_SHARE = 0.01
_MIN_RMS = 1e-3
_MIN_BPM = 40
_MAX_BPM = 180
_SEARCH_MIN_BPM = 30
_SEARCH_MAX_BPM = 220
_ENVELOPE_RATE = 100
_HUM_HZ = (50, 100, 150)
_HUM_WIDTH_HZ = 3
_GOOD_CONTRAST = 8.0
_GOOD_PERIODICITY = 0.6

_BAND = butter(4, [25, 400], btype="band", fs=DECODE_RATE, output="sos")
_ENVELOPE_SMOOTHING = butter(2, 20, btype="low", fs=DECODE_RATE, output="sos")

_MOCK_BPM = {
    Location.MV: 78,
    Location.AV: 74,
    Location.PV: 76,
    Location.TV: 76,
    Location.NK: 75,
}


@dataclass(frozen=True)
class Limits:
    min_contrast: float
    max_hum_share: float
    min_periodicity: float


# Chest limits are set from CirCor's real recordings, and still need tuning on phone recordings.
# Neck limits stay loose because no dataset covers the neck, and breath sounds are expected there.
CHEST_LIMITS = Limits(min_contrast=4.0, max_hum_share=0.5, min_periodicity=0.08)
NECK_LIMITS = Limits(min_contrast=1.5, max_hum_share=0.7, min_periodicity=0.05)


@dataclass(frozen=True)
class CheckedAudio:
    quality: Quality
    audio: np.ndarray | None = None


class QualityChecker(Protocol):
    def check(self, data: bytes, location: Location, duration_ms: int) -> CheckedAudio: ...


def _envelope(filtered: np.ndarray) -> np.ndarray:
    smoothed = sosfiltfilt(_ENVELOPE_SMOOTHING, np.abs(hilbert(filtered)))
    return smoothed[:: DECODE_RATE // _ENVELOPE_RATE]


def _contrast(envelope: np.ndarray) -> float:
    """How far the loudest moments stand above the gaps between beats."""
    floor = max(float(np.percentile(envelope, 30)), 1e-9)
    return float(np.percentile(envelope, 95)) / floor


def _hum_share(filtered: np.ndarray) -> float:
    hz, power = welch(filtered, fs=DECODE_RATE, nperseg=4096)
    in_band = (hz >= 25) & (hz <= 400)
    hum = np.zeros_like(hz, dtype=bool)
    for center in _HUM_HZ:
        hum |= np.abs(hz - center) <= _HUM_WIDTH_HZ
    return float(power[hum & in_band].sum() / max(power[in_band].sum(), 1e-20))


def _beat_period(envelope: np.ndarray) -> tuple[float, float]:
    """Returns (bpm, strength). Strength is 0 when no repeating beat is found."""
    centered = envelope - envelope.mean()
    energy = float(np.dot(centered, centered))
    if energy <= 0:
        return 0.0, 0.0

    spectrum = np.fft.rfft(centered, 2 * centered.size)
    correlation = np.fft.irfft(np.abs(spectrum) ** 2)[: centered.size] / energy
    shortest = int(_ENVELOPE_RATE * 60 / _SEARCH_MAX_BPM)
    longest = min(int(_ENVELOPE_RATE * 60 / _SEARCH_MIN_BPM), centered.size - 1)
    search = correlation[shortest : longest + 1]

    peaks, _ = find_peaks(search)
    if peaks.size == 0:
        return 0.0, 0.0
    best = peaks[np.argmax(search[peaks])]
    lag = shortest + best
    strength = float(search[best])

    # A rate above range usually means the S1 to S2 gap was found, not the full beat.
    if 60 * _ENVELOPE_RATE / lag > _MAX_BPM:
        full_beat = peaks[np.abs(shortest + peaks - 2 * lag) <= 0.1 * lag]
        if full_beat.size and search[full_beat].max() >= 0.5 * strength:
            lag = shortest + full_beat[np.argmax(search[full_beat])]
    return 60 * _ENVELOPE_RATE / lag, strength


def _score(contrast: float, periodicity: float) -> float:
    contrast_part = min((contrast - 1) / (_GOOD_CONTRAST - 1), 1.0)
    periodicity_part = min(periodicity / _GOOD_PERIODICITY, 1.0)
    return round(max(0.0, 0.5 * contrast_part + 0.5 * periodicity_part), 2)


def assess(audio: np.ndarray, location: Location) -> Quality:
    """Runs the quality checks on decoded audio, before any normalization."""
    limits = NECK_LIMITS if location == Location.NK else CHEST_LIMITS
    duration_s = round(audio.size / DECODE_RATE, 1)

    def result(score: float, issue: QualityIssue | None = None, bpm: int | None = None) -> Quality:
        return Quality(
            score=score,
            duration_s=duration_s,
            heart_rate_bpm=bpm,
            issues=[issue] if issue else [],
        )

    trim = int(AUDIO.trim_seconds * DECODE_RATE)
    if audio.size - 2 * trim < _MIN_SECONDS * DECODE_RATE:
        return result(0.0, QualityIssue.too_short)

    if np.mean(np.abs(audio) >= _CLIP_LEVEL) >= _MAX_CLIPPED_SHARE:
        return result(0.0, QualityIssue.clipping)

    filtered = sosfiltfilt(_BAND, audio)[trim:-trim]
    if np.sqrt(np.mean(filtered**2)) < _MIN_RMS:
        return result(0.0, QualityIssue.too_quiet)

    envelope = _envelope(filtered)
    contrast = _contrast(envelope)
    bpm, periodicity = _beat_period(envelope)
    score = _score(contrast, periodicity)

    if contrast < limits.min_contrast or _hum_share(filtered) > limits.max_hum_share:
        return result(score, QualityIssue.too_noisy)
    if periodicity < limits.min_periodicity:
        return result(score, QualityIssue.no_heartbeat_detected)
    if not _MIN_BPM <= bpm <= _MAX_BPM:
        return result(score, QualityIssue.heart_rate_out_of_range)
    return result(score, bpm=round(bpm))


class RealQuality:
    def __init__(self, ffmpeg_path: str) -> None:
        self._ffmpeg_path = ffmpeg_path

    def check(self, data: bytes, location: Location, duration_ms: int) -> CheckedAudio:
        audio = decode(data, self._ffmpeg_path)
        quality = assess(audio, location)
        if quality.issues:
            return CheckedAudio(quality)
        return CheckedAudio(quality, preprocess(audio, DECODE_RATE))


class MockQuality:
    """Accepts anything long enough."""

    def check(self, data: bytes, location: Location, duration_ms: int) -> CheckedAudio:
        duration_s = round(duration_ms / 1000, 1)
        if duration_ms < MIN_DURATION_MS:
            quality = Quality(
                score=0.21,
                duration_s=duration_s,
                heart_rate_bpm=None,
                issues=[QualityIssue.too_short],
            )
            return CheckedAudio(quality)
        quality = Quality(
            score=0.82,
            duration_s=duration_s,
            heart_rate_bpm=_MOCK_BPM[location],
            issues=[],
        )
        return CheckedAudio(quality)


__all__ = ["CheckedAudio", "MIN_ACCEPTED_SCORE", "MockQuality", "QualityChecker", "RealQuality"]
