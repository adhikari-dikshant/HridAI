from pathlib import Path

import numpy as np
import pytest

from app.core.audio_config import AUDIO
from app.services.features import log_mel, model_input

GOLDEN = Path(__file__).parent / "fixtures" / "audio" / "log_mel_golden.npz"


def test_log_mel_matches_the_library_cardiophon_trained_with():
    golden = np.load(GOLDEN)

    features = log_mel(golden["audio"])

    assert features.shape == golden["log_mel"].shape
    assert np.abs(features - golden["log_mel"]).max() < 1e-2


def test_log_mel_is_float32_with_mels_first():
    features = log_mel(np.zeros(AUDIO.sample_rate * 5, dtype=np.float32))

    assert features.dtype == np.float32
    assert features.shape[0] == AUDIO.n_mels


def test_log_mel_frames_follow_the_hop():
    samples = AUDIO.sample_rate * 13

    assert log_mel(np.zeros(samples, dtype=np.float32)).shape[1] == samples // AUDIO.hop_length + 1


def test_model_input_adds_batch_and_channel():
    assert model_input(np.zeros(4000, dtype=np.float32)).shape[:3] == (1, 1, AUDIO.n_mels)


def test_silence_gives_finite_features():
    assert np.isfinite(log_mel(np.zeros(4000, dtype=np.float32))).all()


@pytest.mark.parametrize("bad", [np.zeros((2, 4000)), np.zeros(10)])
def test_bad_audio_shape_is_refused(bad):
    with pytest.raises(ValueError):
        log_mel(bad)
