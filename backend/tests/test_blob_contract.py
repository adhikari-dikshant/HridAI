"""The same checks run on every BlobStore. Cloud Storage runs when the emulator is up."""

import os

import pytest

from app.services.storage import GCSBlobStore, LocalBlobStore


@pytest.fixture(params=["local", "gcs"])
def blobs(request, tmp_path):
    if request.param == "local":
        return LocalBlobStore(str(tmp_path))
    if "STORAGE_EMULATOR_HOST" not in os.environ:
        pytest.skip("Storage emulator is not running")
    return GCSBlobStore(os.environ["TEST_STORAGE_BUCKET"], "demo-hridai")


def test_put_then_get(blobs):
    blobs.put("screenings/a/recordings/one.m4a", b"audio")

    assert blobs.get("screenings/a/recordings/one.m4a") == b"audio"


def test_deleting_a_missing_blob_is_harmless(blobs):
    blobs.delete("screenings/a/missing.m4a")


def test_delete_prefix_removes_only_that_screening(blobs):
    blobs.put("screenings/b/recordings/one.m4a", b"1")
    blobs.put("screenings/b/recordings/two.wav", b"2")
    blobs.put("screenings/bb/recordings/keep.m4a", b"3")

    blobs.delete_prefix("screenings/b")

    assert blobs.get("screenings/bb/recordings/keep.m4a") == b"3"
    with pytest.raises(Exception):  # noqa: B017 - each store raises its own not-found error
        blobs.get("screenings/b/recordings/one.m4a")


def test_delete_removes_one_blob(blobs):
    blobs.put("screenings/c/one.m4a", b"1")

    blobs.delete("screenings/c/one.m4a")

    with pytest.raises(Exception):  # noqa: B017 - each store raises its own not-found error
        blobs.get("screenings/c/one.m4a")
