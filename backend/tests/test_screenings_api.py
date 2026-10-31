import json
import re
from pathlib import Path

import pytest
from conftest import make_settings
from fastapi.testclient import TestClient
from helpers import create_screening, ready_screening, screening_body, upload

from app.main import create_app

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
OTHER_USER = {"Authorization": "Bearer dev:user-b"}


def error_code(response) -> str:
    return response.json()["error"]["code"]


def stored_files(settings) -> list[Path]:
    return [path for path in Path(settings.local_data_dir).rglob("*") if path.is_file()]


# POST /v1/screenings


def test_create_returns_contract_shape(client, auth):
    response = client.post("/v1/screenings", json=screening_body(), headers=auth)

    body = response.json()
    assert response.status_code == 201
    assert set(body) == {
        "screening_id",
        "status",
        "required_locations",
        "optional_locations",
        "created_at",
    }
    assert re.fullmatch(r"scr_[a-z2-7]{10}", body["screening_id"])
    assert body["status"] == "awaiting_recordings"
    assert body["required_locations"] == ["MV", "AV"]
    assert body["optional_locations"] == ["PV", "TV"]
    assert TIMESTAMP.match(body["created_at"])


def test_create_refuses_declined_consent(client, auth):
    body = screening_body(consent={"accepted": False, "version": "v1"})

    response = client.post("/v1/screenings", json=body, headers=auth)

    assert response.status_code == 400
    assert error_code(response) == "consent_required"


@pytest.mark.parametrize(
    "patch",
    [
        {"consent": None},
        {"language": "fr"},
        {"patient": {"age_years": 111, "sex": "male"}},
        {"patient": {"age_years": -1, "sex": "male"}},
        {"patient": {"age_years": 30}},
        {"patient": {"age_years": 30, "sex": "male", "symptoms": ["headache"]}},
    ],
)
def test_create_rejects_bad_input_with_400(client, auth, patch):
    response = client.post("/v1/screenings", json=screening_body(**patch), headers=auth)

    assert response.status_code == 400
    assert error_code(response) == "invalid_request"


def test_create_accepts_required_fields_only(client, auth):
    body = screening_body(patient={"age_years": 0, "sex": "other"})

    assert client.post("/v1/screenings", json=body, headers=auth).status_code == 201


# POST /v1/screenings/{id}/recordings


def test_accepted_recording_matches_contract(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(client, auth, screening_id)

    body = response.json()
    assert response.status_code == 200
    assert set(body) == {"recording_id", "location", "accepted", "quality", "screening_status"}
    assert body["recording_id"].startswith("rec_")
    assert body["accepted"] is True
    assert body["screening_status"] == "ready"
    assert set(body["quality"]) == {"score", "duration_s", "heart_rate_bpm", "issues"}
    assert body["quality"]["issues"] == []


def test_rejected_recording_is_200_with_null_bpm_and_messages(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(client, auth, screening_id, duration_ms=5000)

    body = response.json()
    assert response.status_code == 200
    assert body["accepted"] is False
    assert body["quality"]["issues"] == ["too_short"]
    assert "heart_rate_bpm" in body["quality"]
    assert body["quality"]["heart_rate_bpm"] is None
    assert body["message_en"]
    assert body["message_hi"]
    assert body["screening_status"] == "awaiting_recordings"


def test_rejected_audio_is_not_stored(client, auth, settings):
    screening_id = create_screening(client, auth)

    upload(client, auth, screening_id, duration_ms=5000)

    assert stored_files(settings) == []


def test_accepted_audio_is_stored(client, auth, settings):
    screening_id = create_screening(client, auth)

    recording_id = upload(client, auth, screening_id).json()["recording_id"]

    assert [path.name for path in stored_files(settings)] == [f"{recording_id}.m4a"]


def test_same_location_replaces_previous_recording(client, auth, settings):
    screening_id = create_screening(client, auth)
    upload(client, auth, screening_id)

    second = upload(client, auth, screening_id).json()

    recordings = client.get(f"/v1/screenings/{screening_id}", headers=auth).json()["recordings"]
    assert [item["recording_id"] for item in recordings] == [second["recording_id"]]
    assert len(stored_files(settings)) == 1


def test_bad_location_is_400(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(client, auth, screening_id, location="XX")

    assert response.status_code == 400
    assert error_code(response) == "invalid_request"


def test_missing_file_is_400(client, auth):
    screening_id = create_screening(client, auth)

    response = client.post(
        f"/v1/screenings/{screening_id}/recordings",
        headers=auth,
        data={
            "location": "MV",
            "source": "phone_mic",
            "duration_ms": "15000",
            "platform": "ios",
        },
    )

    assert response.status_code == 400


def test_wrong_file_type_is_415(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(
        client,
        auth,
        screening_id,
        filename="notes.txt",
        content_type="text/plain",
    )

    assert response.status_code == 415
    assert error_code(response) == "unsupported_media_type"


def test_generic_content_type_falls_back_to_extension(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(client, auth, screening_id, content_type="application/octet-stream")

    assert response.status_code == 200


def test_empty_file_is_415(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(client, auth, screening_id, content=b"")

    assert response.status_code == 415
    assert error_code(response) == "unsupported_audio"


def test_file_over_5_mb_is_413(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(client, auth, screening_id, content=b"x" * (5 * 1024 * 1024 + 1))

    assert response.status_code == 413
    assert error_code(response) == "file_too_large"


def test_huge_declared_body_is_refused_before_parsing(client, auth):
    screening_id = create_screening(client, auth)

    response = client.post(
        f"/v1/screenings/{screening_id}/recordings",
        headers=auth | {"Content-Length": str(50 * 1024 * 1024), "Content-Type": "multipart/x"},
        content=b"",
    )

    assert response.status_code == 413
    assert error_code(response) == "file_too_large"


def test_chunked_body_over_limit_is_413(client, auth):
    screening_id = create_screening(client, auth)

    def chunks():
        yield b'--b\r\nContent-Disposition: form-data; name="file"; filename="a.m4a"\r\n\r\n'
        for _ in range(7):
            yield b"x" * (1024 * 1024)

    response = client.post(
        f"/v1/screenings/{screening_id}/recordings",
        headers=auth | {"Content-Type": "multipart/form-data; boundary=b"},
        content=chunks(),
    )

    assert response.status_code == 413
    assert error_code(response) == "file_too_large"


# POST /v1/screenings/{id}/analyze


def test_analyze_matches_contract(client, auth):
    screening_id = ready_screening(client, auth)

    response = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    body = response.json()
    assert response.status_code == 200
    assert set(body) == {
        "screening_id",
        "status",
        "result",
        "explanation",
        "report_summaries",
        "disclaimer",
        "completed_at",
    }
    assert body["status"] == "completed"
    assert TIMESTAMP.match(body["completed_at"])
    assert body["report_summaries"] == []
    assert set(body["explanation"]) == {"en", "hi"}
    assert "not a medical diagnosis" in body["disclaimer"]["en"]
    result = body["result"]
    assert set(result) == {
        "label",
        "confidence",
        "abnormal_probability",
        "heart_rate_bpm",
        "per_location",
        "used_patient_data",
        "model_version",
    }
    assert result["label"] == "needs_checkup"
    assert result["abnormal_probability"] == 0.81
    assert result["confidence"] == 0.81
    assert result["heart_rate_bpm"] == 76
    assert result["used_patient_data"] is False
    assert [item["location"] for item in result["per_location"]] == ["MV", "AV"]
    assert result["per_location"][0]["heatmap_url"] is None
    assert set(result["per_location"][0]) == {
        "location",
        "abnormal_probability",
        "quality_score",
        "heatmap_url",
    }


def test_analyze_without_accepted_recording_is_409(client, auth):
    screening_id = create_screening(client, auth)
    upload(client, auth, screening_id, duration_ms=5000)

    response = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    assert response.status_code == 409
    assert error_code(response) == "no_accepted_recordings"


def test_analyze_ignores_rejected_recordings(client, auth):
    screening_id = create_screening(client, auth)
    upload(client, auth, screening_id, "MV")
    upload(client, auth, screening_id, "AV", duration_ms=5000)

    result = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth).json()["result"]

    assert [item["location"] for item in result["per_location"]] == ["MV"]


def test_analyze_twice_returns_stored_result(client, auth):
    screening_id = ready_screening(client, auth)
    path = f"/v1/screenings/{screening_id}/analyze"
    first = client.post(path, headers=auth).json()

    assert client.post(path, headers=auth).json() == first


def test_upload_after_completed_clears_result(client, auth):
    screening_id = ready_screening(client, auth)
    client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    body = upload(client, auth, screening_id, "PV").json()

    detail = client.get(f"/v1/screenings/{screening_id}", headers=auth).json()
    assert body["screening_status"] == "ready"
    assert detail["status"] == "ready"
    assert detail["analysis"] is None


def test_upload_while_analyzing_is_409(client, auth):
    screening_id = ready_screening(client, auth)
    service = client.app.state.service
    assert service.repository.try_start_analysis(screening_id)

    response = upload(client, auth, screening_id, "PV")

    assert response.status_code == 409
    assert error_code(response) == "analysis_in_progress"


def test_analyze_while_analyzing_is_409(client, auth):
    screening_id = ready_screening(client, auth)
    assert client.app.state.service.repository.try_start_analysis(screening_id)

    response = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    assert response.status_code == 409
    assert error_code(response) == "analysis_in_progress"


def test_failed_analysis_returns_500_then_can_retry(client, auth, monkeypatch):
    screening_id = ready_screening(client, auth)
    classifier = client.app.state.service.classifier
    working_predict = classifier.predict

    def broken_predict(recordings):
        raise RuntimeError("model crashed")

    monkeypatch.setattr(classifier, "predict", broken_predict)
    failed = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)
    status = client.get(f"/v1/screenings/{screening_id}", headers=auth).json()["status"]

    monkeypatch.setattr(classifier, "predict", working_predict)
    retried = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    assert failed.status_code == 500
    assert error_code(failed) == "internal_error"
    assert status == "failed"
    assert retried.status_code == 200


@pytest.mark.parametrize(
    ("scenario", "label", "confidence"),
    [
        ("normal", "normal", 0.82),
        ("needs_checkup", "needs_checkup", 0.81),
        ("unclear", "unclear", 0.3),
    ],
)
def test_mock_scenarios_produce_each_result(tmp_path, auth, scenario, label, confidence):
    settings = make_settings(tmp_path, mock_scenario=scenario)
    with TestClient(create_app(settings)) as client:
        screening_id = ready_screening(client, auth)
        path = f"/v1/screenings/{screening_id}/analyze"
        result = client.post(path, headers=auth).json()["result"]

    assert result["label"] == label
    assert result["confidence"] == confidence


def test_cycle_scenario_walks_every_result(tmp_path, auth):
    settings = make_settings(tmp_path, mock_scenario="cycle")
    with TestClient(create_app(settings)) as client:
        labels = []
        for _ in range(4):
            screening_id = ready_screening(client, auth)
            path = f"/v1/screenings/{screening_id}/analyze"
            labels.append(client.post(path, headers=auth).json()["result"]["label"])

    assert labels == ["normal", "needs_checkup", "unclear", "normal"]


def test_chest_pain_always_advises_a_doctor(tmp_path, auth):
    patient = {"age_years": 40, "sex": "female", "symptoms": ["chest_pain"]}
    settings = make_settings(tmp_path, mock_scenario="normal")
    with TestClient(create_app(settings)) as client:
        screening_id = ready_screening(client, auth, patient=patient)
        path = f"/v1/screenings/{screening_id}/analyze"
        explanation = client.post(path, headers=auth).json()["explanation"]

    assert "promptly" in explanation["en"]
    assert "जल्द से जल्द" in explanation["hi"]


# GET and DELETE


def test_get_returns_patient_recordings_and_analysis(client, auth):
    screening_id = ready_screening(client, auth)
    analysis = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth).json()

    body = client.get(f"/v1/screenings/{screening_id}", headers=auth).json()

    assert body["screening_id"] == screening_id
    assert body["status"] == "completed"
    assert body["patient"]["age_years"] == 34
    assert len(body["recordings"]) == 2
    assert "storage_path" not in body["recordings"][0]
    assert body["analysis"] == analysis


def test_get_before_analysis_has_null_analysis(client, auth):
    screening_id = create_screening(client, auth)

    assert client.get(f"/v1/screenings/{screening_id}", headers=auth).json()["analysis"] is None


def test_list_is_newest_first_and_owner_only(client, auth):
    first = create_screening(client, auth)
    second = create_screening(client, auth)
    create_screening(client, OTHER_USER)

    items = client.get("/v1/screenings", headers=auth).json()["items"]

    assert [item["screening_id"] for item in items] == [second, first]
    assert set(items[0]) == {"screening_id", "created_at", "status", "label"}
    assert items[0]["label"] is None


def test_list_shows_label_after_analysis(client, auth):
    screening_id = ready_screening(client, auth)
    client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth)

    items = client.get("/v1/screenings", headers=auth).json()["items"]

    assert items[0]["label"] == "needs_checkup"


def test_list_honours_limit(client, auth):
    for _ in range(3):
        create_screening(client, auth)

    items = client.get("/v1/screenings?limit=2", headers=auth).json()["items"]

    assert len(items) == 2


@pytest.mark.parametrize("limit", [0, 51])
def test_list_rejects_limit_out_of_range(client, auth, limit):
    response = client.get(f"/v1/screenings?limit={limit}", headers=auth)

    assert response.status_code == 400


def test_delete_removes_screening_and_audio(client, auth, settings):
    screening_id = ready_screening(client, auth)

    response = client.delete(f"/v1/screenings/{screening_id}", headers=auth)

    assert response.status_code == 204
    assert response.content == b""
    assert stored_files(settings) == []
    assert client.get(f"/v1/screenings/{screening_id}", headers=auth).status_code == 404


# Ownership


@pytest.mark.parametrize(
    ("method", "suffix"),
    [("get", ""), ("delete", ""), ("post", "/analyze")],
)
def test_other_users_screening_is_404(client, auth, method, suffix):
    screening_id = ready_screening(client, auth)

    response = getattr(client, method)(f"/v1/screenings/{screening_id}{suffix}", headers=OTHER_USER)

    assert response.status_code == 404
    assert error_code(response) == "screening_not_found"


def test_upload_to_other_users_screening_is_404(client, auth):
    screening_id = create_screening(client, auth)

    response = upload(client, OTHER_USER, screening_id)

    assert response.status_code == 404
    assert error_code(response) == "screening_not_found"


def test_missing_screening_is_404(client, auth):
    response = client.get("/v1/screenings/scr_missing000", headers=auth)

    assert response.status_code == 404
    assert error_code(response) == "screening_not_found"


# API description shared with the app


def test_exported_openapi_file_is_current(client):
    exported = Path(__file__).parents[1] / "docs" / "openapi.json"

    assert json.loads(exported.read_text(encoding="utf-8")) == client.get("/openapi.json").json()


def test_openapi_documents_400_and_never_422(client):
    paths = client.get("/openapi.json").json()["paths"]

    operation = paths["/v1/screenings"]["post"]
    assert "422" not in operation["responses"]
    assert "400" in operation["responses"]
