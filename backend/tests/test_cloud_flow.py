"""Full API flow on the Firebase emulators, using real tokens. Run: pytest -m cloud"""

import json
import os
from urllib.request import Request, urlopen

import pytest
from audio_samples import lub_dub, wav_bytes
from conftest import make_settings
from fastapi.testclient import TestClient
from helpers import patient_body, screening_body, upload

from app.main import create_app

pytestmark = pytest.mark.cloud

AUTH_HOST = os.environ.get("FIREBASE_AUTH_EMULATOR_HOST", "")
AUDIO = wav_bytes(lub_dub())


def anonymous_token() -> str:
    request = Request(
        f"http://{AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
        data=json.dumps({"returnSecureToken": True}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urlopen(request) as response:
        return json.load(response)["idToken"]


@pytest.fixture
def cloud(tmp_path):
    settings = make_settings(
        tmp_path,
        env="staging",
        auth_mode="firebase",
        data_backend="firestore",
        gcp_project="demo-hridai",
        storage_bucket=os.environ["TEST_STORAGE_BUCKET"],
    )
    with TestClient(create_app(settings)) as client:
        yield client


def bearer() -> dict:
    return {"Authorization": f"Bearer {anonymous_token()}"}


def test_full_flow_with_real_tokens_and_delete_leaves_nothing(cloud):
    headers = bearer()
    patient_id = cloud.post("/v1/patients", json=patient_body(), headers=headers).json()[
        "patient_id"
    ]
    body = screening_body(patient_id)
    screening_id = cloud.post("/v1/screenings", json=body, headers=headers).json()["screening_id"]

    assert upload(cloud, headers, screening_id, "MV").json()["accepted"] is True
    assert upload(cloud, headers, screening_id, "NK").json()["accepted"] is True
    analysis = cloud.post(f"/v1/screenings/{screening_id}/analyze", headers=headers)

    detail = cloud.get(f"/v1/screenings/{screening_id}", headers=headers).json()
    history = cloud.get(f"/v1/screenings?patient_id={patient_id}", headers=headers).json()
    assert analysis.status_code == 200
    assert detail["analysis"] == analysis.json()
    assert len(detail["recordings"]) == 2
    assert [item["screening_id"] for item in history["items"]] == [screening_id]

    service = cloud.app.state.service
    stored = service.repository.list_recordings(screening_id)
    assert all(service.blobs.get(r["storage_path"]) for r in stored)

    assert cloud.delete(f"/v1/patients/{patient_id}", headers=headers).status_code == 204
    assert cloud.get(f"/v1/screenings/{screening_id}", headers=headers).status_code == 404
    assert service.repository.list_recordings(screening_id) == []
    with pytest.raises(Exception):  # noqa: B017 - the store raises its own not-found error
        service.blobs.get(stored[0]["storage_path"])


def test_another_anonymous_user_cannot_see_a_screening(cloud):
    owner = bearer()
    patient_id = cloud.post("/v1/patients", json=patient_body(), headers=owner).json()["patient_id"]
    body = screening_body(patient_id)
    screening_id = cloud.post("/v1/screenings", json=body, headers=owner).json()["screening_id"]

    response = cloud.get(f"/v1/screenings/{screening_id}", headers=bearer())

    assert response.status_code == 404


def test_forged_token_is_refused(cloud):
    response = cloud.get("/v1/screenings", headers={"Authorization": "Bearer forged"})

    assert response.status_code == 401
