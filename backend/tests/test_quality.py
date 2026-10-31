import numpy as np
import pytest
from audio_samples import RATE, low_rumble, lub_dub, mains_hum, voice_like, wav_bytes, white_noise

from app.schemas import Location, QualityIssue
from app.services.decode import DECODE_RATE
from app.services.quality import MIN_ACCEPTED_SCORE, RealQuality, assess


def assess_samples(audio: np.ndarray, location=Location.MV):
    assert RATE == DECODE_RATE
    return assess(audio, location)


@pytest.mark.parametrize("bpm", [48, 60, 72, 90, 120, 150])
def test_clean_heartbeat_passes_with_the_right_rate(bpm):
    quality = assess_samples(lub_dub(bpm=bpm))

    assert quality.issues == []
    assert quality.heart_rate_bpm == pytest.approx(bpm, abs=5)
    assert quality.score >= MIN_ACCEPTED_SCORE


@pytest.mark.parametrize("s2_gain", [0.6, 1.0, 1.4])
def test_strong_second_sound_does_not_double_the_rate(s2_gain):
    quality = assess_samples(lub_dub(bpm=66, s2_gain=s2_gain))

    assert quality.heart_rate_bpm == pytest.approx(66, abs=5)


def test_short_recording_is_too_short():
    assert assess_samples(lub_dub(seconds=9)).issues == [QualityIssue.too_short]


def test_saturated_recording_is_clipping():
    assert assess_samples(np.clip(lub_dub(level=30), -1, 1)).issues == [QualityIssue.clipping]


def test_faint_recording_is_too_quiet():
    assert assess_samples(lub_dub(level=0.0005)).issues == [QualityIssue.too_quiet]


def test_silence_is_too_quiet():
    assert assess_samples(np.zeros(15 * RATE, dtype=np.float32)).issues == [QualityIssue.too_quiet]


@pytest.mark.parametrize(
    "noise",
    [mains_hum(), voice_like(), 3 * white_noise(), 3 * low_rumble()],
    ids=["fan-hum", "voice", "white-noise", "rumble"],
)
def test_noise_over_the_heartbeat_is_rejected(noise):
    assert assess_samples((lub_dub() + noise) / 3).issues == [QualityIssue.too_noisy]


def test_noise_alone_does_not_pass():
    assert assess_samples(white_noise()).issues != []


def test_very_slow_rate_is_out_of_range():
    quality = assess_samples(lub_dub(bpm=34, seconds=25))

    assert quality.issues == [QualityIssue.heart_rate_out_of_range]


def test_evenly_spaced_sounds_are_not_read_as_a_rate_above_range():
    quality = assess_samples(lub_dub(bpm=95, systole=0.316, s2_gain=1.0))

    assert quality.issues == []
    assert quality.heart_rate_bpm == pytest.approx(95, abs=5)


def test_flat_tone_has_no_heartbeat():
    t = np.arange(15 * RATE) / RATE
    amplitude = 0.3 * np.exp(-((t - 7.5) ** 2) / 2)
    tone = (amplitude * np.sin(2 * np.pi * 90 * t)).astype(np.float32)

    assert assess_samples(tone).issues == [QualityIssue.no_heartbeat_detected]


def test_neck_is_more_forgiving_than_chest():
    noisy = (lub_dub() + 2 * white_noise()) / 3

    assert assess_samples(noisy, Location.MV).issues == [QualityIssue.too_noisy]
    assert assess_samples(noisy, Location.NK).issues == []


def test_real_quality_returns_model_ready_audio(ffmpeg):
    checked = RealQuality(ffmpeg).check(wav_bytes(lub_dub()), Location.MV, 15000)

    assert checked.quality.issues == []
    assert np.abs(checked.audio).max() == pytest.approx(1.0)


def test_rejected_recording_returns_no_audio(ffmpeg):
    checked = RealQuality(ffmpeg).check(wav_bytes(lub_dub(seconds=9)), Location.MV, 9000)

    assert checked.audio is None


def test_real_quality_ignores_the_duration_the_client_claims(ffmpeg):
    checked = RealQuality(ffmpeg).check(wav_bytes(lub_dub(seconds=9)), Location.MV, 15000)

    assert checked.quality.issues == [QualityIssue.too_short]
