VALID_PATIENT = {
    "consent": {"accepted": True, "version": "v1"},
    "label": "Papa",
    "age_years": 34,
    "sex": "male",
    "height_cm": 172,
    "weight_kg": 70,
    "known_conditions": [],
}

VALID_SCREENING = {
    "language": "hi",
    "consent": {"accepted": True, "version": "v1"},
    "symptoms": ["breathlessness"],
}


def patient_body(**overrides) -> dict:
    return VALID_PATIENT | overrides


def create_patient(client, headers, **overrides) -> str:
    response = client.post("/v1/patients", json=patient_body(**overrides), headers=headers)
    assert response.status_code == 201
    return response.json()["patient_id"]


def screening_body(patient_id, **overrides) -> dict:
    return VALID_SCREENING | {"patient_id": patient_id} | overrides


def create_screening(client, headers, patient_id=None, **overrides) -> str:
    patient_id = patient_id or create_patient(client, headers)
    body = screening_body(patient_id, **overrides)
    response = client.post("/v1/screenings", json=body, headers=headers)
    assert response.status_code == 201
    return response.json()["screening_id"]


def upload(
    client,
    headers,
    screening_id,
    location="MV",
    duration_ms=15000,
    content=b"fake-m4a-bytes",
    filename="heart.m4a",
    content_type="audio/m4a",
):
    return client.post(
        f"/v1/screenings/{screening_id}/recordings",
        headers=headers,
        files={"file": (filename, content, content_type)},
        data={
            "location": location,
            "source": "phone_mic",
            "duration_ms": str(duration_ms),
            "platform": "android",
        },
    )


def ready_screening(client, headers, patient_id=None, **overrides) -> str:
    screening_id = create_screening(client, headers, patient_id, **overrides)
    assert upload(client, headers, screening_id, "MV").json()["accepted"] is True
    assert upload(client, headers, screening_id, "AV").json()["accepted"] is True
    return screening_id
