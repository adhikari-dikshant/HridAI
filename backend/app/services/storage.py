import shutil
from pathlib import Path
from typing import Protocol


class BlobStore(Protocol):
    def put(self, path: str, data: bytes) -> None: ...

    def get(self, path: str) -> bytes: ...

    def delete(self, path: str) -> None: ...

    def delete_prefix(self, prefix: str) -> None: ...


class GCSBlobStore:
    def __init__(self, bucket: str, project: str) -> None:
        from google.cloud import storage

        self._client = storage.Client(project=project)
        self._bucket = self._client.bucket(bucket)

    def put(self, path: str, data: bytes) -> None:
        self._bucket.blob(path).upload_from_string(data)

    def get(self, path: str) -> bytes:
        return self._bucket.blob(path).download_as_bytes()

    def delete(self, path: str) -> None:
        from google.api_core.exceptions import NotFound

        try:
            self._bucket.blob(path).delete()
        except NotFound:
            pass

    def delete_prefix(self, prefix: str) -> None:
        for blob in self._client.list_blobs(self._bucket, prefix=f"{prefix}/"):
            self.delete(blob.name)


class LocalBlobStore:
    def __init__(self, root: str) -> None:
        self._root = Path(root)

    def put(self, path: str, data: bytes) -> None:
        target = self._root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def get(self, path: str) -> bytes:
        return (self._root / path).read_bytes()

    def delete(self, path: str) -> None:
        (self._root / path).unlink(missing_ok=True)

    def delete_prefix(self, prefix: str) -> None:
        shutil.rmtree(self._root / prefix, ignore_errors=True)
