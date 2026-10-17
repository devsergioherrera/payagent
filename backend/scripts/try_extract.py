"""Run the real Gemini extractor on a file: uv run python scripts/try_extract.py <file>."""
import mimetypes
import sys
import uuid
from pathlib import Path

from google import genai

from payagent.adapters.gemini.extractor import GeminiExtractor
from payagent.config import settings


class PrintingMeter:
    def record(self, operation_id, purpose, model, input_tokens, output_tokens, latency_ms):
        print(f"[meter] {purpose} {model} in={input_tokens} out={output_tokens} {latency_ms}ms")


def main(path: str) -> None:
    file = Path(path)
    content_type = mimetypes.guess_type(file.name)[0] or "text/plain"
    extractor = GeminiExtractor(genai.Client(api_key=settings.gemini_api_key), PrintingMeter())
    print(extractor.extract(file.read_bytes(), content_type, str(uuid.uuid4())))


if __name__ == "__main__":
    main(sys.argv[1])
