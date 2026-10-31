VALID_SCREENING = {
    "language": "hi",
    "consent": {"accepted": True, "version": "v1"},
    "patient": {
        "age_years": 34,
        "sex": "male",
        "height_cm": 172,
        "weight_kg": 70,
        "symptoms": ["breathlessness"],
        "known_conditions": [],
    },
}


def screening_body(**overrides) -> dict:
    return VALID_SCREENING | overrides


def create_screening(client, headers, **overrides) -> str:
    response = client.post("/v1/screenings", json=screening_body(**overrides), headers=headers)
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


def ready_screening(client, headers, **overrides) -> str:
    screening_id = create_screening(client, headers, **overrides)
    assert upload(client, headers, screening_id, "MV").json()["accepted"] is True
    assert upload(client, headers, screening_id, "AV").json()["accepted"] is True
    return screening_id
