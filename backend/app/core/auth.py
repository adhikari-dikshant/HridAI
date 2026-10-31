import re

from firebase_admin import auth as firebase_auth

from app.core.config import Settings
from app.core.errors import ApiError

_DEV_TOKEN = re.compile(r"^dev:([A-Za-z0-9_-]{1,128})$")


def verify_token(token: str | None, settings: Settings) -> str:
    """Returns the caller's uid."""
    if not token:
        raise ApiError("unauthorized")

    if settings.auth_mode == "dev":
        match = _DEV_TOKEN.match(token)
        if match is None:
            raise ApiError("unauthorized")
        return match.group(1)

    try:
        return firebase_auth.verify_id_token(token, check_revoked=False)["uid"]
    except (ValueError, firebase_auth.InvalidIdTokenError) as error:
        raise ApiError("unauthorized") from error
