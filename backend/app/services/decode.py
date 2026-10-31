import io
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile

from app.core.audio_config import AUDIO
from app.core.errors import ApiError

DECODE_RATE = 16000
MAX_SECONDS = 35
_TIMEOUT_SECONDS = 20
_ALLOWED_FORMATS = "mov,mp4,m4a,3gp,3g2,mj2,wav"


def decode(data: bytes, ffmpeg_path: str) -> np.ndarray:
    """Decodes an upload to mono float32 audio at DECODE_RATE.

    Uses a temp file because stdin can return success with no audio for m4a files whose
    index is at the end. The upload is untrusted, so ffmpeg may read only local media files.
    """
    file_descriptor, path = tempfile.mkstemp(suffix=".upload")
    try:
        with os.fdopen(file_descriptor, "wb") as upload:
            upload.write(data)
        result = subprocess.run(
            [
                ffmpeg_path,
                "-nostdin",
                "-v",
                "error",
                "-protocol_whitelist",
                "file",
                "-format_whitelist",
                _ALLOWED_FORMATS,
                "-i",
                path,
                "-t",
                str(MAX_SECONDS),
                "-ac",
                "1",
                "-ar",
                str(DECODE_RATE),
                "-f",
                "f32le",
                "pipe:1",
            ],
            capture_output=True,
            timeout=_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as error:
        raise ApiError("unsupported_audio") from error
    finally:
        os.unlink(path)

    if result.returncode != 0 or not result.stdout:
        raise ApiError("unsupported_audio")
    return np.frombuffer(result.stdout, dtype=np.float32).copy()


def to_wav(audio: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    wavfile.write(buffer, AUDIO.sample_rate, audio.astype(np.float32))
    return buffer.getvalue()


def from_wav(data: bytes) -> np.ndarray:
    _, audio = wavfile.read(io.BytesIO(data))
    return audio
