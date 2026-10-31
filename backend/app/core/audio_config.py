from dataclasses import dataclass


@dataclass(frozen=True)
class AudioConfig:
    """Shared by training and inference. Values follow CardioPHON's config_4k.yaml."""

    sample_rate: int = 4000
    trim_seconds: float = 1.0
    n_fft: int = 512
    hop_length: int = 160
    n_mels: int = 64
    f_min: float = 60.0
    f_max: float = 2000.0
    log_offset: float = 1.1920929e-07
    norm_mean: float = -4.1357055
    norm_std: float = 2.863227


AUDIO = AudioConfig()
