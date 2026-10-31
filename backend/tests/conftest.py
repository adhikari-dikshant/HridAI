import imageio_ffmpeg
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def make_settings(tmp_path, **overrides) -> Settings:
    values = {
        "env": "local",
        "data_backend": "memory",
        "auth_mode": "dev",
        "mock_inference": True,
        "mock_quality": True,
        "mock_scenario": "needs_checkup",
        "local_data_dir": str(tmp_path / "local_data"),
    }
    return Settings(_env_file=None, **(values | overrides))


@pytest.fixture
def ffmpeg() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


@pytest.fixture
def settings(tmp_path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": "Bearer dev:user-a"}
