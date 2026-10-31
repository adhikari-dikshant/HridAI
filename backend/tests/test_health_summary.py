import pytest
from conftest import make_settings
from fastapi.testclient import TestClient
from helpers import create_patient, ready_screening

from app.main import create_app
from app.schemas import BmiCategory, KnownCondition, Label, PatientSnapshot, Symptom
from app.services.health_summary import build_health_summary


def patient(**overrides) -> PatientSnapshot:
    details = {
        "age_years": 34,
        "sex": "male",
        "height_cm": 172,
        "weight_kg": 70,
        "symptoms": [],
        "known_conditions": [],
    }
    return PatientSnapshot.model_validate(details | overrides)


def english(summary) -> str:
    return " ".join(summary.suggestions["en"])


@pytest.mark.parametrize(
    "weight, bmi, category",
    [
        (50, 16.9, BmiCategory.underweight),
        (70, 23.7, BmiCategory.healthy),
        (80, 27.0, BmiCategory.overweight),
        (95, 32.1, BmiCategory.obese),
    ],
)
def test_adult_bmi_has_a_category(weight, bmi, category):
    summary = build_health_summary(patient(weight_kg=weight), Label.normal)

    assert summary.bmi == bmi
    assert summary.bmi_category == category


def test_category_follows_the_number_shown():
    # 74.0 kg at 172 cm is 25.01, shown as 25.0.
    summary = build_health_summary(patient(weight_kg=74), Label.normal)

    assert summary.bmi == 25.0
    assert summary.bmi_category == BmiCategory.overweight


@pytest.mark.parametrize("missing", ["height_cm", "weight_kg"])
def test_missing_height_or_weight_gives_no_bmi(missing):
    summary = build_health_summary(patient(**{missing: None}), Label.normal)

    assert summary.bmi is None
    assert summary.bmi_category is None


def test_mistyped_height_gives_no_bmi():
    summary = build_health_summary(patient(height_cm=5), Label.normal)

    assert summary.bmi is None
    assert summary.bmi_category is None


def test_child_gets_the_number_only():
    summary = build_health_summary(patient(age_years=12, weight_kg=95), Label.normal)

    assert summary.bmi == 32.1
    assert summary.bmi_category is None
    assert "weight" not in english(summary)
    assert "walk" not in english(summary)


def test_normal_with_symptoms_still_advises_a_doctor():
    summary = build_health_summary(patient(symptoms=[Symptom.fatigue]), Label.normal)

    assert "see a doctor about your symptoms" in english(summary)


def test_normal_without_symptoms_gives_habits_only():
    summary = build_health_summary(patient(), Label.normal)

    assert "doctor about" not in english(summary)
    assert summary.suggestions["en"][-1].startswith("A short daily walk")


def test_needs_checkup_comes_first():
    summary = build_health_summary(patient(symptoms=[Symptom.breathlessness]), Label.needs_checkup)

    assert summary.suggestions["en"][0] == "Take this result to a doctor for a check-up."
    assert "breathlessness gets worse" in english(summary)


def test_unclear_without_symptoms_asks_to_record_again():
    summary = build_health_summary(patient(), Label.unclear)

    assert summary.suggestions["en"][0].startswith("Record again")


@pytest.mark.parametrize("symptom", [Symptom.chest_pain, Symptom.fainting])
@pytest.mark.parametrize("label", list(Label))
def test_urgent_symptom_means_doctor_first_and_no_exercise_advice(symptom, label):
    summary = build_health_summary(patient(symptoms=[symptom], weight_kg=95), label)

    assert summary.suggestions["en"][0].startswith("Chest pain or fainting")
    assert "walk" not in english(summary)
    assert "activity" not in english(summary)


def test_known_conditions_are_returned_with_check_up_advice():
    conditions = [KnownCondition.diabetes]
    summary = build_health_summary(patient(known_conditions=conditions), Label.normal)

    assert summary.known_conditions == conditions
    assert "regular check-ups" in english(summary)


def test_every_suggestion_exists_in_both_languages():
    summary = build_health_summary(
        patient(symptoms=list(Symptom), known_conditions=[KnownCondition.other]),
        Label.needs_checkup,
    )

    assert len(summary.suggestions["en"]) == len(summary.suggestions["hi"]) > 0


def test_analyze_returns_summary_without_changing_the_result(tmp_path, auth):
    settings = make_settings(tmp_path, mock_scenario="normal")
    with TestClient(create_app(settings)) as client:
        patient_id = create_patient(client, auth, height_cm=None)
        screening_id = ready_screening(client, auth, patient_id, symptoms=["chest_pain"])
        body = client.post(f"/v1/screenings/{screening_id}/analyze", headers=auth).json()
        stored = client.get(f"/v1/screenings/{screening_id}", headers=auth).json()

    assert body["result"]["label"] == "normal"
    assert set(body["health_summary"]) == {
        "bmi",
        "bmi_category",
        "symptoms",
        "known_conditions",
        "suggestions",
    }
    assert body["health_summary"]["bmi"] is None
    assert body["health_summary"]["symptoms"] == ["chest_pain"]
    assert stored["analysis"]["health_summary"] == body["health_summary"]
