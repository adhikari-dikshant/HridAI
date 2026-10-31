from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_defaults_run_locally_without_credentials(monkeypatch):
    for name in ("ENV", "AUTH_MODE", "DATA_BACKEND", "MOCK_INFERENCE", "MOCK_QUALITY"):
        monkeypatch.delenv(name, raising=False)

    settings = Settings(_env_file=None)

    assert settings.env == "local"
    assert settings.auth_mode == "dev"
    assert settings.data_backend == "memory"
    assert settings.mock_inference is True


@pytest.mark.parametrize(
    "unsafe",
    [
        {"auth_mode": "dev"},
        {"data_backend": "memory"},
        {"mock_inference": True},
        {"mock_quality": True},
    ],
)
def test_prod_refuses_each_unsafe_setting(unsafe):
    safe = {
        "auth_mode": "firebase",
        "data_backend": "firestore",
        "mock_inference": False,
        "mock_quality": False,
    }

    with pytest.raises(ValidationError, match="ENV=prod"):
        Settings(_env_file=None, env="prod", **(safe | unsafe))


def test_prod_accepts_safe_settings():
    settings = Settings(
        _env_file=None,
        env="prod",
        auth_mode="firebase",
        data_backend="firestore",
        mock_inference=False,
        mock_quality=False,
    )

    assert settings.env == "prod"


def test_staging_may_use_dev_auth_and_mocks():
    assert Settings(_env_file=None, env="staging").auth_mode == "dev"


def test_env_example_loads_as_local_mock_setup():
    example = Path(__file__).parents[1] / ".env.example"

    settings = Settings(_env_file=example)

    assert settings.env == "local"
    assert settings.data_backend == "memory"
    assert settings.mock_scenario == "cycle"
    assert settings.local_data_dir == "local_data"


def test_cors_origins_are_split():
    settings = Settings(_env_file=None, cors_origins="https://a.test, https://b.test")

    assert settings.cors_origin_list == ["https://a.test", "https://b.test"]


def test_empty_cors_origins_means_none():
    assert Settings(_env_file=None, cors_origins="").cors_origin_list == []
