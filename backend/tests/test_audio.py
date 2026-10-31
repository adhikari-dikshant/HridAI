import numpy as np
import pytest

from app.core.audio_config import AUDIO
from app.services.audio import preprocess


def tone(seconds: float, sample_rate: int, amplitude: float = 0.25) -> np.ndarray:
    t = np.arange(int(seconds * sample_rate)) / sample_rate
    return (amplitude * np.sin(2 * np.pi * 100 * t)).astype(np.float32)


def test_preprocess_resamples_and_trims_each_side():
    result = preprocess(tone(15, 44100), 44100)

    assert result.size == pytest.approx(13 * AUDIO.sample_rate, abs=2)


def test_preprocess_keeps_target_rate_audio_length_after_trim():
    result = preprocess(tone(15, AUDIO.sample_rate), AUDIO.sample_rate)

    assert result.size == 13 * AUDIO.sample_rate


def test_preprocess_peak_normalizes():
    result = preprocess(tone(5, AUDIO.sample_rate, amplitude=0.1), AUDIO.sample_rate)

    assert np.abs(result).max() == pytest.approx(1.0)


def test_preprocess_leaves_silence_unchanged():
    silence = np.zeros(5 * AUDIO.sample_rate, dtype=np.float32)

    assert np.abs(preprocess(silence, AUDIO.sample_rate)).max() == 0


def test_preprocess_returns_float32():
    assert preprocess(tone(5, 44100), 44100).dtype == np.float32


def test_recording_too_short_to_trim_is_refused():
    with pytest.raises(ValueError):
        preprocess(tone(1.5, AUDIO.sample_rate), AUDIO.sample_rate)
