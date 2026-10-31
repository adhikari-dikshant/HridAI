from math import gcd

import numpy as np
from scipy.signal import resample_poly

from app.core.audio_config import AUDIO


def preprocess(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Resamples, trims handling noise and peak-normalizes mono audio."""
    audio = np.asarray(audio, dtype=np.float32)
    if sample_rate != AUDIO.sample_rate:
        divisor = gcd(sample_rate, AUDIO.sample_rate)
        audio = resample_poly(audio, AUDIO.sample_rate // divisor, sample_rate // divisor)

    trim = int(AUDIO.trim_seconds * AUDIO.sample_rate)
    if audio.size <= 2 * trim:
        raise ValueError("Recording is too short to trim")
    audio = audio[trim:-trim]

    peak = np.abs(audio).max()
    return (audio / peak if peak > 0 else audio).astype(np.float32)
