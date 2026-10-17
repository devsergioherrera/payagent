"""Run a folder of invoices through the real pipeline: uv run python scripts/run_set.py [folder]

Folder defaults to tests/fixtures/invoices. Files go in name order. An optional expected.json
({"file name": "PAY" | "HOLD" | "ESCALATE"}) is compared with the decision; exit code 1 on any mismatch.
"""
import json
import mimetypes
import sys
from pathlib import Path

from payagent.adapters.upload.storage import FileStorage
from payagent.app.process_invoice import AlreadyProcessed, StoredDocument
from payagent.app.wiring import build_pipeline
from payagent.config import settings
from payagent.ports.invoice_source import IncomingDocument, SourceType

DEFAULT_FOLDER = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "invoices"


def main(folder: Path) -> int:
    expected: dict[str, str] = {}
    if (folder / "expected.json").is_file():
        expected = json.loads((folder / "expected.json").read_text())
    files = sorted(p for p in folder.iterdir() if p.is_file() and p.name != "expected.json" and not p.name.startswith("."))
    pipeline = build_pipeline()
    storage = FileStorage(settings.storage_dir)

    rows: list[tuple[str, str, str, str]] = []
    for path in files:
        content = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "text/plain"
        doc = IncomingDocument(SourceType.UPLOAD, f"set:{path.name}", path.name, content_type, content)
        stored = storage.save(content, path.name)
        try:
            got = pipeline.run(StoredDocument(doc, stored.sha256, stored.path)).outcome.value
        except AlreadyProcessed:
            got = "YA PROCESADA"
        except Exception as exc:
            got = f"ERROR {type(exc).__name__}"
        want = expected.get(path.name, "-")
        rows.append((path.name, want, got, "OK" if want in ("-", got) else "FAIL"))

    widths = [max(len(r[i]) for r in [("file", "expected", "got", "")] + rows) for i in range(3)]
    print(f"{'file':<{widths[0]}}  {'expected':<{widths[1]}}  {'got':<{widths[2]}}  result")
    for name, want, got, verdict in rows:
        print(f"{name:<{widths[0]}}  {want:<{widths[1]}}  {got:<{widths[2]}}  {verdict}")
    return 1 if any(r[3] == "FAIL" for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_FOLDER))
