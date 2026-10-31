import subprocess

import numpy as np
import pytest
from audio_samples import RATE, lub_dub, wav_bytes

from app.core.errors import ApiError
from app.services.decode import DECODE_RATE, MAX_SECONDS, decode, from_wav, to_wav


def encode_m4a(ffmpeg, tmp_path, wav, *flags) -> bytes:
    source, target = tmp_path / "in.wav", tmp_path / "out.m4a"
    source.write_bytes(wav)
    subprocess.run(
        [ffmpeg, "-y", "-v", "error", "-i", source, "-c:a", "aac", *flags, target], check=True
    )
    return target.read_bytes()


def test_decodes_wav_to_mono_at_decode_rate(ffmpeg):
    audio = decode(wav_bytes(lub_dub(seconds=4)), ffmpeg)

    assert audio.dtype == np.float32
    assert audio.size == pytest.approx(4 * DECODE_RATE, rel=0.01)


def test_decodes_m4a_with_moov_at_end(ffmpeg, tmp_path):
    m4a = encode_m4a(ffmpeg, tmp_path, wav_bytes(lub_dub(seconds=4)))

    assert decode(m4a, ffmpeg).size == pytest.approx(4 * DECODE_RATE, rel=0.02)


def test_stops_decoding_past_the_limit(ffmpeg):
    audio = decode(wav_bytes(np.zeros((MAX_SECONDS + 5) * RATE, dtype=np.float32)), ffmpeg)

    assert audio.size == MAX_SECONDS * DECODE_RATE


@pytest.mark.parametrize("data", [b"not audio at all", b"\x00" * 2048])
def test_garbage_is_unsupported_audio(ffmpeg, data):
    with pytest.raises(ApiError) as error:
        decode(data, ffmpeg)

    assert error.value.code == "unsupported_audio"


def test_playlist_pointing_at_a_url_is_refused(ffmpeg):
    playlist = b"#EXTM3U\n#EXTINF:1,\nhttp://127.0.0.1:9/secret.wav\n#EXT-X-ENDLIST\n"

    with pytest.raises(ApiError):
        decode(playlist, ffmpeg)


def test_wav_round_trip_keeps_samples():
    audio = np.linspace(-1, 1, 400, dtype=np.float32)

    assert np.array_equal(from_wav(to_wav(audio)), audio)
