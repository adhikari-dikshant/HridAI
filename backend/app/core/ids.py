import secrets

_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"


def new_id(prefix: str) -> str:
    return f"{prefix}_{''.join(secrets.choice(_ALPHABET) for _ in range(10))}"
