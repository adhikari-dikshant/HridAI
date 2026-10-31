import re

from app.core.config import Settings
from app.core.errors import ApiError

_DEV_TOKEN = re.compile(r"^dev:([A-Za-z0-9_-]{1,128})$")


def verify_token(token: str | None, settings: Settings) -> str:
    """Returns the caller's uid. Firebase verification arrives in B3."""
    match = _DEV_TOKEN.match(token or "") if settings.auth_mode == "dev" else None
    if match is None:
        raise ApiError("unauthorized")
    return match.group(1)
