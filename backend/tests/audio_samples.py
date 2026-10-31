import io

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

RATE = 16000


def lub_dub(bpm=72.0, seconds=15.0, systole=0.32, s2_gain=0.8, level=0.3, seed=0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    audio = np.zeros(int(seconds * RATE), dtype=np.float32)
    burst_time = np.arange(int(0.08 * RATE)) / RATE

    def burst(hz: float) -> np.ndarray:
        return np.sin(2 * np.pi * hz * burst_time) * np.hanning(burst_time.size)

    beat = 0.1
    while beat + systole + 0.1 < seconds:
        first, second = int(beat * RATE), int((beat + systole) * RATE)
        audio[first : first + burst_time.size] += burst(60)
        audio[second : second + burst_time.size] += s2_gain * burst(90)
        beat += 60 / bpm
    return (level * audio + 0.002 * rng.standard_normal(audio.size)).astype(np.float32)


def mains_hum(seconds=15.0, level=0.3) -> np.ndarray:
    t = np.arange(int(seconds * RATE)) / RATE
    return (level * sum(np.sin(2 * np.pi * 50 * k * t) / k for k in (1, 2, 3))).astype(np.float32)


def voice_like(seconds=15.0, level=0.2) -> np.ndarray:
    t = np.arange(int(seconds * RATE)) / RATE
    harmonics = sum(np.sin(2 * np.pi * 120 * k * t) / k for k in range(1, 8))
    return (level * harmonics).astype(np.float32)


def white_noise(seconds=15.0, level=0.2, seed=1) -> np.ndarray:
    return (level * np.random.default_rng(seed).standard_normal(int(seconds * RATE))).astype(
        np.float32
    )


def low_rumble(seconds=15.0, level=0.2, seed=2) -> np.ndarray:
    noise = np.random.default_rng(seed).standard_normal(int(seconds * RATE))
    sos = butter(4, [30, 300], btype="band", fs=RATE, output="sos")
    filtered = sosfiltfilt(sos, noise)
    return (level * filtered / np.abs(filtered).max()).astype(np.float32)


def wav_bytes(audio: np.ndarray, rate: int = RATE) -> bytes:
    buffer = io.BytesIO()
    wavfile.write(buffer, rate, (np.clip(audio, -1, 1) * 32767).astype(np.int16))
    return buffer.getvalue()
