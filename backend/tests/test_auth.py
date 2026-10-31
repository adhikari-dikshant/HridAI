import pytest
from conftest import make_settings
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Basic abc"},
        {"Authorization": "Bearer not-a-dev-token"},
        {"Authorization": "Bearer dev:"},
        {"Authorization": "Bearer dev:has spaces"},
    ],
)
def test_bad_credentials_are_401(client, headers):
    response = client.get("/v1/screenings", headers=headers)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_dev_token_is_accepted(client):
    response = client.get("/v1/screenings", headers={"Authorization": "Bearer dev:user-1"})

    assert response.status_code == 200


def test_health_needs_no_token(client):
    assert client.get("/healthz").status_code == 200


def test_auth_is_checked_before_validation(client):
    assert client.post("/v1/screenings", json={}).status_code == 401


def test_firebase_mode_refuses_to_start_until_implemented(tmp_path):
    settings = make_settings(tmp_path, auth_mode="firebase")

    with pytest.raises(NotImplementedError, match="AUTH_MODE=firebase"):
        with TestClient(create_app(settings)):
            pass


def test_firestore_refuses_to_start_until_implemented(tmp_path):
    settings = make_settings(tmp_path, data_backend="firestore")

    with pytest.raises(NotImplementedError, match="DATA_BACKEND=firestore"):
        with TestClient(create_app(settings)):
            pass
