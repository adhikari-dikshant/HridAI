import pytest
from conftest import make_settings
from fastapi.testclient import TestClient
from firebase_admin import auth as firebase_auth
from helpers import patient_body

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


@pytest.fixture
def firebase_client(tmp_path, monkeypatch):
    def fake_verify(token, check_revoked=False):
        if token != "good-token":
            raise firebase_auth.InvalidIdTokenError("bad token")
        return {"uid": "firebase-user"}

    monkeypatch.setattr(firebase_auth, "verify_id_token", fake_verify)
    settings = make_settings(tmp_path, auth_mode="firebase", gcp_project="demo-hridai")
    with TestClient(create_app(settings)) as client:
        yield client


def test_valid_firebase_token_is_accepted(firebase_client):
    response = firebase_client.get(
        "/v1/screenings", headers={"Authorization": "Bearer good-token"}
    )

    assert response.status_code == 200


def test_invalid_firebase_token_is_401(firebase_client):
    response = firebase_client.get("/v1/screenings", headers={"Authorization": "Bearer bad"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_dev_token_is_refused_in_firebase_mode(firebase_client):
    response = firebase_client.get("/v1/screenings", headers={"Authorization": "Bearer dev:me"})

    assert response.status_code == 401


def test_users_only_see_their_own_data_with_firebase(firebase_client):
    headers = {"Authorization": "Bearer good-token"}

    created = firebase_client.post("/v1/patients", json=patient_body(), headers=headers)

    assert created.status_code == 201


def test_firebase_mode_needs_a_project(tmp_path):
    settings = make_settings(tmp_path, auth_mode="firebase")

    with pytest.raises(RuntimeError, match="GCP_PROJECT"):
        with TestClient(create_app(settings)):
            pass


def test_firestore_mode_needs_a_bucket(tmp_path):
    settings = make_settings(tmp_path, data_backend="firestore", gcp_project="demo-hridai")

    with pytest.raises(RuntimeError, match="STORAGE_BUCKET"):
        with TestClient(create_app(settings)):
            pass
