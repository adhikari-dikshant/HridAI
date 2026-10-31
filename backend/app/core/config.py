from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["local", "staging", "prod"] = "local"

    data_backend: Literal["memory", "firestore"] = "memory"
    auth_mode: Literal["dev", "firebase"] = "dev"
    mock_inference: bool = True
    mock_quality: bool = True
    mock_scenario: Literal["normal", "needs_checkup", "unclear", "cycle"] = "cycle"

    gcp_project: str = ""
    storage_bucket: str = ""
    local_data_dir: str = "local_data"

    gemini_model: str = ""
    gemini_timeout_s: float = 15

    model_path: str = "models/model.onnx"
    fusion_path: str = ""

    cors_origins: str = "*"

    @model_validator(mode="after")
    def refuse_unsafe_prod(self) -> "Settings":
        if self.env == "prod":
            unsafe = []
            if self.auth_mode == "dev":
                unsafe.append("AUTH_MODE=dev")
            if self.data_backend == "memory":
                unsafe.append("DATA_BACKEND=memory")
            if self.mock_inference:
                unsafe.append("MOCK_INFERENCE=true")
            if self.mock_quality:
                unsafe.append("MOCK_QUALITY=true")
            if unsafe:
                raise ValueError(f"ENV=prod refuses: {', '.join(unsafe)}")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
