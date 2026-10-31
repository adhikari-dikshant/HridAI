from functools import lru_cache

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from scipy.signal import get_window

from app.core.audio_config import AUDIO

_MEL_BREAK_HZ = 1000.0
_MEL_LINEAR_SLOPE = 200.0 / 3
_MEL_BREAK = _MEL_BREAK_HZ / _MEL_LINEAR_SLOPE
_MEL_LOG_STEP = np.log(6.4) / 27


def _hz_to_mel(hz: float) -> float:
    if hz < _MEL_BREAK_HZ:
        return hz / _MEL_LINEAR_SLOPE
    return _MEL_BREAK + np.log(hz / _MEL_BREAK_HZ) / _MEL_LOG_STEP


def _mel_to_hz(mels: np.ndarray) -> np.ndarray:
    return np.where(
        mels < _MEL_BREAK,
        mels * _MEL_LINEAR_SLOPE,
        _MEL_BREAK_HZ * np.exp((mels - _MEL_BREAK) * _MEL_LOG_STEP),
    )


@lru_cache(maxsize=1)
def _mel_filterbank() -> np.ndarray:
    """Slaney-style filters, matching librosa and nnAudio defaults."""
    fft_hz = np.fft.rfftfreq(AUDIO.n_fft, 1 / AUDIO.sample_rate)
    mel_points = np.linspace(_hz_to_mel(AUDIO.f_min), _hz_to_mel(AUDIO.f_max), AUDIO.n_mels + 2)
    edges_hz = _mel_to_hz(mel_points)

    lower, center, upper = edges_hz[:-2, None], edges_hz[1:-1, None], edges_hz[2:, None]
    rising = (fft_hz - lower) / (center - lower)
    falling = (upper - fft_hz) / (upper - center)
    filters = np.maximum(0, np.minimum(rising, falling))
    return (2 / (upper - lower)) * filters


def log_mel(audio: np.ndarray) -> np.ndarray:
    """Returns normalized log-mel features shaped [n_mels, frames]."""
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim != 1 or audio.size < AUDIO.n_fft:
        raise ValueError("Expected mono audio of at least one FFT window")

    half_window = AUDIO.n_fft // 2
    padded = np.pad(audio, half_window, mode="reflect")
    frames = sliding_window_view(padded, AUDIO.n_fft)[:: AUDIO.hop_length]
    window = get_window("hann", AUDIO.n_fft, fftbins=True)
    power = np.abs(np.fft.rfft(frames * window, axis=1)) ** 2

    mel = _mel_filterbank() @ power.T
    log_values = np.log(mel + AUDIO.log_offset)
    return ((log_values - AUDIO.norm_mean) / AUDIO.norm_std).astype(np.float32)


def model_input(audio: np.ndarray) -> np.ndarray:
    """Returns the model's float32 input shaped [1, 1, n_mels, frames]."""
    return log_mel(audio)[np.newaxis, np.newaxis]
