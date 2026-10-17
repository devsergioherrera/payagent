"""Run the whole agent on one file: uv run python scripts/decide.py <file> [<file> ...].

Same path as an emailed invoice, minus the email: store -> extract -> rules -> decision -> explanation.
"""
import mimetypes
import sys
from pathlib import Path

from payagent.adapters.upload.storage import FileStorage
from payagent.app.process_invoice import AlreadyProcessed, StoredDocument
from payagent.app.wiring import build_pipeline
from payagent.config import settings
from payagent.ports.invoice_source import IncomingDocument, SourceType

LABEL = {"PAY": "PAGAR", "HOLD": "FRENAR", "ESCALATE": "ESCALAR"}


def main(paths: list[str]) -> None:
    pipeline = build_pipeline()
    storage = FileStorage(settings.storage_dir)
    for path in map(Path, paths):
        content = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "text/plain"
        doc = IncomingDocument(SourceType.UPLOAD, f"cli:{path.name}", path.name, content_type, content)
        stored = storage.save(content, path.name)
        try:
            result = pipeline.run(StoredDocument(doc, stored.sha256, stored.path))
        except AlreadyProcessed:
            print(f"{path.name}: ya se había decidido (mismo archivo)")
            continue
        print(f"\n{path.name} -> {LABEL[result.outcome]}")
        print(f"  {result.vendor} · {result.amount} {result.currency}")
        print(f"  {result.explanation}")
        print(f"  {settings.public_base_url}/facturas/{result.invoice_id}")


if __name__ == "__main__":
    main(sys.argv[1:])
