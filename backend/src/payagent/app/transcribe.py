"""Voice fallback for browsers without SpeechRecognition: Gemini turns a short recording into text."""
import logging
import time
from dataclasses import dataclass
from typing import Any

from google.genai import types

from payagent.adapters.gemini._call import call_with_retry, record_usage
from payagent.ports.repositories import Operations
from payagent.ports.usage import UsageMeter

log = logging.getLogger(__name__)

MAX_BYTES = 5 * 1024 * 1024
PROMPT = "Transcribe exactly in Spanish, no extra words"


class EmptyAudio(Exception):
    pass


class AudioTooLarge(Exception):
    pass


class TranscriptionFailed(Exception):
    pass


@dataclass
class TranscribeService:
    client: Any
    meter: UsageMeter
    operations: Operations
    model: str = "gemini-3.8-flash"

    def transcribe(self, audio: bytes, mime_type: str) -> str:
        if not audio:
            raise EmptyAudio
        if len(audio) > MAX_BYTES:
            raise AudioTooLarge
        op_id = self.operations.start("CHAT")
        started = time.monotonic()
        try:
            part = types.Part.from_bytes(data=audio, mime_type=mime_type.split(";")[0] or "audio/webm")
            response = call_with_retry(
                lambda: self.client.models.generate_content(
                    model=self.model, contents=[PROMPT, part], config=types.GenerateContentConfig(temperature=0)
                )
            )
            record_usage(self.meter, op_id, "CHAT", self.model, response, started)
            text = (response.text or "").strip()
        except Exception as exc:
            log.exception("Transcription failed")
            self.operations.finish(op_id, error=str(exc)[:500])
            raise TranscriptionFailed from exc
        self.operations.finish(op_id)
        return text
