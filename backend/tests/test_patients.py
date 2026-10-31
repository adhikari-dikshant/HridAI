import re
from pathlib import Path

import pytest
from helpers import (
    create_patient,
    create_screening,
    patient_body,
    ready_screening,
    screening_body,
    upload,
)

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
OTHER_USER = {"Authorization": "Bearer dev:user-b"}


def error_code(response) -> str:
    return response.json()["error"]["code"]


def stored_files(settings) -> list[Path]:
    return [path for path in Path(settings.local_data_dir).rglob("*") if path.is_file()]


def analyze(client, headers, screening_id):
    return client.post(f"/v1/screenings/{screening_id}/analyze", headers=headers)


def get_patient(client, headers, patient_id) -> dict:
    return client.get(f"/v1/patients/{patient_id}", headers=headers).json()


# POST /v1/patients


def test_create_returns_contract_shape(client, auth):
    response = client.post("/v1/patients", json=patient_body(), headers=auth)

    body = response.json()
    assert response.status_code == 201
    assert set(body) == {
        "patient_id",
        "label",
        "age_years",
        "sex",
        "height_cm",
        "weight_kg",
        "known_conditions",
        "last_screening_at",
        "created_at",
        "updated_at",
    }
    assert re.fullmatch(r"pat_[a-z2-7]{10}", body["patient_id"])
    assert body["label"] == "Papa"
    assert body["last_screening_at"] is None
    assert TIMESTAMP.match(body["created_at"])


def test_create_refuses_declined_consent(client, auth):
    body = patient_body(consent={"accepted": False, "version": "v1"})

    response = client.post("/v1/patients", json=body, headers=auth)

    assert response.status_code == 400
    assert error_code(response) == "consent_required"
    assert client.get("/v1/patients", headers=auth).json()["items"] == []


@pytest.mark.parametrize(
    "patch",
    [
        {"consent": None},
        {"label": ""},
        {"label": "   "},
        {"label": "x" * 41},
        {"age_years": 111},
        {"age_years": -1},
        {"sex": "unknown"},
        {"known_conditions": ["asthma"]},
    ],
)
def test_create_rejects_bad_input_with_400(client, auth, patch):
    response = client.post("/v1/patients", json=patient_body(**patch), headers=auth)

    assert response.status_code == 400
    assert error_code(response) == "invalid_request"


def test_create_accepts_required_fields_only(client, auth):
    body = {
        "consent": {"accepted": True, "version": "v1"},
        "label": "Camp-12",
        "age_years": 0,
        "sex": "other",
    }

    response = client.post("/v1/patients", json=body, headers=auth)

    assert response.status_code == 201
    assert response.json()["height_cm"] is None


def test_label_is_trimmed(client, auth):
    patient_id = create_patient(client, auth, label="  Dadi  ")

    assert get_patient(client, auth, patient_id)["label"] == "Dadi"


# GET and PATCH


def test_list_is_owner_only_with_latest_activity_first(client, auth):
    first = create_patient(client, auth, label="First")
    second = create_patient(client, auth, label="Second")
    create_patient(client, OTHER_USER)

    create_screening(client, auth, first)

    items = client.get("/v1/patients", headers=auth).json()["items"]
    assert [item["patient_id"] for item in items] == [first, second]


def test_list_honours_limit(client, auth):
    for _ in range(3):
        create_patient(client, auth)

    items = client.get("/v1/patients?limit=2", headers=auth).json()["items"]

    assert len(items) == 2


@pytest.mark.parametrize("limit", [0, 201])
def test_list_rejects_limit_out_of_range(client, auth, limit):
    assert client.get(f"/v1/patients?limit={limit}", headers=auth).status_code == 400


def test_patch_changes_only_sent_fields(client, auth):
    patient_id = create_patient(client, auth)

    response = client.patch(f"/v1/patients/{patient_id}", json={"age_years": 35}, headers=auth)

    body = response.json()
    assert response.status_code == 200
    assert body["age_years"] == 35
    assert body["label"] == "Papa"
    assert body["height_cm"] == 172


def test_patch_can_clear_height(client, auth):
    patient_id = create_patient(client, auth)

    body = client.patch(f"/v1/patients/{patient_id}", json={"height_cm": None}, headers=auth).json()

    assert body["height_cm"] is None


@pytest.mark.parametrize(
    "patch",
    [
        {"label": None},
        {"label": ""},
        {"age_years": None},
        {"age_years": 111},
        {"sex": None},
        {"known_conditions": None},
    ],
)
def test_patch_rejects_bad_input_with_400(client, auth, patch):
    patient_id = create_patient(client, auth)

    response = client.patch(f"/v1/patients/{patient_id}", json=patch, headers=auth)

    assert response.status_code == 400
    assert error_code(response) == "invalid_request"
    assert get_patient(client, auth, patient_id)["label"] == "Papa"


def test_empty_patch_changes_nothing_but_updated_at(client, auth):
    patient_id = create_patient(client, auth)
    before = get_patient(client, auth, patient_id)

    response = client.patch(f"/v1/patients/{patient_id}", json={}, headers=auth)

    assert response.status_code == 200
    assert response.json() | {"updated_at": ""} == before | {"updated_at": ""}


# Screenings under a patient


def test_screening_copies_patient_details_without_label(client, auth):
    patient_id = create_patient(client, auth, known_conditions=["diabetes"])
    screening_id = create_screening(client, auth, patient_id)

    body = client.get(f"/v1/screenings/{screening_id}", headers=auth).json()

    assert body["patient_id"] == patient_id
    assert body["patient"] == {
        "age_years": 34,
        "sex": "male",
        "height_cm": 172.0,
        "weight_kg": 70.0,
        "symptoms": ["breathlessness"],
        "known_conditions": ["diabetes"],
    }


def test_editing_a_patient_keeps_old_screening_snapshot(client, auth):
    patient_id = create_patient(client, auth)
    screening_id = create_screening(client, auth, patient_id)

    client.patch(f"/v1/patients/{patient_id}", json={"age_years": 60}, headers=auth)

    body = client.get(f"/v1/screenings/{screening_id}", headers=auth).json()
    assert body["patient"]["age_years"] == 34


def test_screening_for_missing_patient_is_404(client, auth):
    body = screening_body("pat_missing000")

    response = client.post("/v1/screenings", json=body, headers=auth)

    assert response.status_code == 404
    assert error_code(response) == "patient_not_found"


def test_screening_for_other_users_patient_is_404(client, auth):
    patient_id = create_patient(client, auth)

    response = client.post("/v1/screenings", json=screening_body(patient_id), headers=OTHER_USER)

    assert response.status_code == 404
    assert error_code(response) == "patient_not_found"


def test_screening_list_filters_by_patient(client, auth):
    mine = create_patient(client, auth)
    screening_id = create_screening(client, auth, mine)
    create_screening(client, auth)

    items = client.get(f"/v1/screenings?patient_id={mine}", headers=auth).json()["items"]

    assert [item["screening_id"] for item in items] == [screening_id]
    assert items[0]["patient_id"] == mine


def test_screening_list_for_other_users_patient_is_404(client, auth):
    patient_id = create_patient(client, auth)

    response = client.get(f"/v1/screenings?patient_id={patient_id}", headers=OTHER_USER)

    assert response.status_code == 404
    assert error_code(response) == "patient_not_found"


# last_screening_at


def test_last_screening_is_set_by_analyze(client, auth):
    patient_id = create_patient(client, auth)
    screening_id = ready_screening(client, auth, patient_id)
    assert get_patient(client, auth, patient_id)["last_screening_at"] is None

    completed_at = analyze(client, auth, screening_id).json()["completed_at"]

    assert get_patient(client, auth, patient_id)["last_screening_at"] == completed_at


def test_deleting_the_last_screening_clears_the_date(client, auth):
    patient_id = create_patient(client, auth)
    screening_id = ready_screening(client, auth, patient_id)
    analyze(client, auth, screening_id)

    client.delete(f"/v1/screenings/{screening_id}", headers=auth)

    assert get_patient(client, auth, patient_id)["last_screening_at"] is None


def test_chest_retake_clears_the_date_until_analyzed_again(client, auth):
    patient_id = create_patient(client, auth)
    screening_id = ready_screening(client, auth, patient_id)
    analyze(client, auth, screening_id)

    upload(client, auth, screening_id, "AV")

    assert get_patient(client, auth, patient_id)["last_screening_at"] is None


# DELETE and ownership


def test_delete_removes_patient_screenings_and_audio(client, auth, settings):
    patient_id = create_patient(client, auth)
    screening_id = ready_screening(client, auth, patient_id)
    other_patient_screening = ready_screening(client, auth)
    kept_files = len(stored_files(settings)) - 2

    response = client.delete(f"/v1/patients/{patient_id}", headers=auth)

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/v1/patients/{patient_id}", headers=auth).status_code == 404
    assert client.get(f"/v1/screenings/{screening_id}", headers=auth).status_code == 404
    assert client.get(f"/v1/screenings/{other_patient_screening}", headers=auth).status_code == 200
    assert len(stored_files(settings)) == kept_files


@pytest.mark.parametrize(
    ("method", "kwargs"),
    [("get", {}), ("delete", {}), ("patch", {"json": {"age_years": 40}})],
)
def test_other_users_patient_is_404(client, auth, method, kwargs):
    patient_id = create_patient(client, auth)

    response = getattr(client, method)(
        f"/v1/patients/{patient_id}", headers=OTHER_USER, **kwargs
    )

    assert response.status_code == 404
    assert error_code(response) == "patient_not_found"
    assert get_patient(client, auth, patient_id)["age_years"] == 34


def test_missing_patient_is_404(client, auth):
    response = client.get("/v1/patients/pat_missing000", headers=auth)

    assert response.status_code == 404
    assert error_code(response) == "patient_not_found"
