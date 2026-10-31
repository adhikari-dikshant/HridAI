"""The same checks run on every Repository. Firestore runs when the emulator is up."""

import os
from datetime import UTC, datetime, timedelta
from threading import Barrier, Thread

import pytest

from app.core.ids import new_id
from app.schemas import Label, Location, ScreeningStatus
from app.services.repository import InMemoryRepository

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)


def make_firestore():
    if "FIRESTORE_EMULATOR_HOST" not in os.environ:
        pytest.skip("Firestore emulator is not running")
    from app.services.firestore_repository import FirestoreRepository

    return FirestoreRepository("demo-hridai")


@pytest.fixture(params=["memory", "firestore"])
def repository(request):
    return InMemoryRepository() if request.param == "memory" else make_firestore()


def patient(owner, active=NOW) -> dict:
    return {
        "patient_id": new_id("pat"),
        "owner_uid": owner,
        "label": "Papa",
        "age_years": 34,
        "known_conditions": [],
        "height_cm": None,
        "consent": {"accepted": True, "version": "v1", "accepted_at": NOW},
        "last_screening_at": None,
        "last_activity_at": active,
        "created_at": NOW,
        "updated_at": NOW,
    }


def screening(owner, patient_id="pat_1", created=NOW, status=ScreeningStatus.ready) -> dict:
    return {
        "screening_id": new_id("scr"),
        "owner_uid": owner,
        "patient_id": patient_id,
        "created_at": created,
        "status": status,
        "result": None,
        "analysis_started_at": None,
    }


def recording(location=Location.MV, created=NOW) -> dict:
    return {
        "recording_id": new_id("rec"),
        "location": location,
        "accepted": True,
        "quality": {"score": 0.8, "heart_rate_bpm": None, "issues": []},
        "created_at": created,
    }


def owner() -> str:
    return new_id("uid")


def test_patient_round_trip(repository):
    item = patient(owner())

    repository.create_patient(item)

    stored = repository.get_patient(item["patient_id"])
    assert stored["label"] == "Papa"
    assert stored["height_cm"] is None
    assert stored["known_conditions"] == []
    assert stored["consent"]["accepted_at"] == NOW


def test_missing_documents_are_none(repository):
    assert repository.get_patient("pat_missing") is None
    assert repository.get_screening("scr_missing") is None


def test_update_patient_changes_only_given_fields(repository):
    item = patient(owner())
    repository.create_patient(item)

    repository.update_patient(item["patient_id"], {"label": "Maa"})

    stored = repository.get_patient(item["patient_id"])
    assert stored["label"] == "Maa"
    assert stored["age_years"] == 34


def test_updating_a_deleted_patient_is_harmless(repository):
    repository.update_patient("pat_gone", {"label": "x"})

    assert repository.get_patient("pat_gone") is None


def test_list_patients_is_recent_first_owner_only_and_limited(repository):
    uid = owner()
    older = patient(uid, NOW)
    newer = patient(uid, NOW + timedelta(hours=1))
    other = patient(owner())
    for item in (older, newer, other):
        repository.create_patient(item)

    ids = [item["patient_id"] for item in repository.list_patients(uid, 10)]

    assert ids == [newer["patient_id"], older["patient_id"]]
    assert len(repository.list_patients(uid, 1)) == 1


def test_delete_patient(repository):
    item = patient(owner())
    repository.create_patient(item)

    repository.delete_patient(item["patient_id"])

    assert repository.get_patient(item["patient_id"]) is None


def test_enums_and_nested_results_survive_a_round_trip(repository):
    item = screening(owner())
    repository.create_screening(item)

    repository.update_screening(
        item["screening_id"],
        {
            "status": ScreeningStatus.completed,
            "result": {
                "label": Label.normal,
                "per_location": [{"location": Location.MV, "heatmap_url": None}],
            },
        },
    )

    stored = repository.get_screening(item["screening_id"])
    assert stored["status"] == ScreeningStatus.completed
    assert stored["result"]["label"] == Label.normal
    assert stored["result"]["per_location"][0]["location"] == Location.MV


def test_list_screenings_filters_and_sorts(repository):
    uid = owner()
    first = screening(uid, "pat_a", NOW)
    second = screening(uid, "pat_b", NOW + timedelta(minutes=1))
    third = screening(uid, "pat_a", NOW + timedelta(minutes=2))
    for item in (first, second, third, screening(owner(), "pat_a")):
        repository.create_screening(item)

    everything = repository.list_screenings(uid, None)
    only_a = repository.list_screenings(uid, 10, "pat_a")

    assert [s["screening_id"] for s in everything] == [
        third["screening_id"],
        second["screening_id"],
        first["screening_id"],
    ]
    assert [s["screening_id"] for s in only_a] == [third["screening_id"], first["screening_id"]]
    assert len(repository.list_screenings(uid, 2)) == 2


def test_recordings_round_trip_in_upload_order(repository):
    item = screening(owner())
    repository.create_screening(item)
    first = recording(Location.MV, NOW)
    second = recording(Location.AV, NOW + timedelta(seconds=5))
    repository.save_recording(item["screening_id"], second)
    repository.save_recording(item["screening_id"], first)

    stored = repository.list_recordings(item["screening_id"])

    assert [r["location"] for r in stored] == [Location.MV, Location.AV]
    assert stored[0]["quality"]["heart_rate_bpm"] is None


def test_delete_recording(repository):
    item = screening(owner())
    repository.create_screening(item)
    one = recording()
    repository.save_recording(item["screening_id"], one)

    repository.delete_recording(item["screening_id"], one["recording_id"])

    assert repository.list_recordings(item["screening_id"]) == []


def test_delete_screening_removes_its_recordings(repository):
    item = screening(owner())
    repository.create_screening(item)
    repository.save_recording(item["screening_id"], recording())

    repository.delete_screening(item["screening_id"])

    assert repository.get_screening(item["screening_id"]) is None
    assert repository.list_screenings(item["owner_uid"], None) == []


def test_analysis_lock_blocks_a_second_start(repository):
    item = screening(owner())
    repository.create_screening(item)

    assert repository.try_start_analysis(item["screening_id"]) is True
    assert repository.try_start_analysis(item["screening_id"]) is False
    assert repository.get_screening(item["screening_id"])["status"] == ScreeningStatus.analyzing


def test_analysis_lock_expires_after_the_lease(repository):
    item = screening(owner())
    repository.create_screening(item)
    repository.try_start_analysis(item["screening_id"], now=NOW)

    assert repository.try_start_analysis(item["screening_id"], NOW + timedelta(seconds=89)) is False
    assert repository.try_start_analysis(item["screening_id"], NOW + timedelta(seconds=91)) is True


def test_only_one_of_two_simultaneous_analyses_wins(repository):
    item = screening(owner())
    repository.create_screening(item)
    barrier = Barrier(4)
    wins = []

    def attempt():
        barrier.wait()
        wins.append(repository.try_start_analysis(item["screening_id"]))

    threads = [Thread(target=attempt) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(wins) == [False, False, False, True]
