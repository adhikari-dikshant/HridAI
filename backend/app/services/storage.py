import shutil
from pathlib import Path
from typing import Protocol


class BlobStore(Protocol):
    def put(self, path: str, data: bytes) -> None: ...

    def delete(self, path: str) -> None: ...

    def delete_prefix(self, prefix: str) -> None: ...


class LocalBlobStore:
    def __init__(self, root: str) -> None:
        self._root = Path(root)

    def put(self, path: str, data: bytes) -> None:
        target = self._root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def delete(self, path: str) -> None:
        (self._root / path).unlink(missing_ok=True)

    def delete_prefix(self, prefix: str) -> None:
        shutil.rmtree(self._root / prefix, ignore_errors=True)
