import hashlib
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class StoredFile:
    sha256: str
    path: Path
    is_new: bool


class FileStorage:
    """Content-addressed store: the sha256 is the file name, so a repeat is detected for free."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, content: bytes, filename: str) -> StoredFile:
        sha256 = hashlib.sha256(content).hexdigest()
        path = self.root / f"{sha256}{Path(filename).suffix.lower()}"
        if path.exists():
            return StoredFile(sha256, path, is_new=False)
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_bytes(content)
        tmp.replace(path)
        return StoredFile(sha256, path, is_new=True)
