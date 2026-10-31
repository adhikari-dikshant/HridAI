import re
from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import ERRORS
from app.core.ids import new_id
from app.core.messages import DISCLAIMER, HEADLINES, ISSUE_MESSAGES
from app.schemas import Label, QualityIssue
from app.services.repository import InMemoryRepository
from app.services.result import LocationScore, build_result
from app.services.templates import TemplateExplainer

DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def score(location="MV", probability=0.5, quality=0.8) -> LocationScore:
    return LocationScore(location, probability, quality)


def test_ids_have_prefix_and_ten_characters():
    assert re.fullmatch(r"rec_[a-z2-7]{10}", new_id("rec"))


def test_ids_are_unique():
    assert len({new_id("scr") for _ in range(1000)}) == 1000


def test_every_quality_issue_has_both_languages():
    assert set(ISSUE_MESSAGES) == set(QualityIssue)
    for message_en, message_hi in ISSUE_MESSAGES.values():
        assert message_en
        assert DEVANAGARI.search(message_hi)


def test_every_error_has_both_languages():
    for _, message_en, message_hi in ERRORS.values():
        assert message_en
        assert DEVANAGARI.search(message_hi)


def test_every_label_has_headline_and_template():
    explainer = TemplateExplainer()
    for label in Label:
        assert DEVANAGARI.search(HEADLINES[label]["hi"])
        explanation = explainer.explain(label, symptoms=[])
        assert explanation["en"]
        assert DEVANAGARI.search(explanation["hi"])


def test_disclaimer_has_both_languages():
    assert "not a medical diagnosis" in DISCLAIMER["en"]
    assert DEVANAGARI.search(DISCLAIMER["hi"])


def test_label_is_needs_checkup_at_threshold():
    result = build_result([score(probability=0.35)], [78], 0.35, "m")

    assert result["label"] == "needs_checkup"


def test_label_is_normal_below_threshold():
    result = build_result([score(probability=0.34)], [78], 0.35, "m")

    assert result["label"] == "normal"
    assert result["confidence"] == 0.66


def test_screening_probability_is_max_over_locations():
    scores = [score("MV", 0.2), score("AV", 0.7)]

    assert build_result(scores, [78], 0.35, "m")["abnormal_probability"] == 0.7


def test_unclear_when_all_quality_is_low():
    scores = [score("MV", 0.9, 0.2), score("AV", 0.9, 0.4)]

    result = build_result(scores, [78], 0.35, "m")

    assert result["label"] == "unclear"
    assert result["confidence"] == 0.3


def test_one_good_recording_avoids_unclear():
    scores = [score("MV", 0.2, 0.2), score("AV", 0.2, 0.5)]

    assert build_result(scores, [78], 0.35, "m")["label"] == "normal"


def test_heart_rate_is_mean_of_known_rates():
    assert build_result([score()], [78, 74, None], 0.35, "m")["heart_rate_bpm"] == 76


def test_heart_rate_is_null_when_unknown():
    assert build_result([score()], [None], 0.35, "m")["heart_rate_bpm"] is None


@pytest.mark.parametrize("symptom", ["chest_pain", "fainting"])
def test_urgent_symptoms_extend_every_template(symptom):
    explainer = TemplateExplainer()
    for label in Label:
        assert "promptly" in explainer.explain(label, symptoms=[symptom])["en"]


def test_other_symptoms_do_not_add_urgent_advice():
    explanation = TemplateExplainer().explain(Label.normal, symptoms=["fatigue"])

    assert "promptly" not in explanation["en"]


def make_repository() -> InMemoryRepository:
    repository = InMemoryRepository()
    repository.create_screening({"screening_id": "s", "status": "ready"})
    return repository


def test_analysis_lock_blocks_a_second_start():
    repository = make_repository()

    assert repository.try_start_analysis("s") is True
    assert repository.try_start_analysis("s") is False


def test_analysis_lock_expires_after_lease():
    repository = make_repository()
    started = datetime(2026, 11, 1, tzinfo=UTC)

    repository.try_start_analysis("s", now=started)

    assert repository.try_start_analysis("s", now=started + timedelta(seconds=89)) is False
    assert repository.try_start_analysis("s", now=started + timedelta(seconds=91)) is True


def test_repository_returns_copies():
    repository = make_repository()

    repository.get_screening("s")["status"] = "changed"

    assert repository.get_screening("s")["status"] == "ready"
