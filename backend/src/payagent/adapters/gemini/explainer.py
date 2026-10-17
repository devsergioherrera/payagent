import time
from typing import Any

from google.genai import types

from payagent.adapters.gemini._call import call_with_retry, record_usage
from payagent.ports.usage import UsageMeter

SYSTEM = (
    "You explain a payment decision to a finance person, in Spanish. At most 2 short sentences, "
    "35 words in total, plain words, no markdown, no lists. Start with what happened (pagada, frenada "
    "or escalada) and the single most important reason; mention a second rule only if it matters. "
    "Write money like 'USD 12.400' or 'EUR 652.546'. Never use English or codes like PAY, HOLD, ESCALATE. "
    "Use only the facts given; never add reasons or numbers."
)


class GeminiExplainer:
    def __init__(self, client: Any, meter: UsageMeter, model: str = "gemini-3.8-flash") -> None:
        self._client = client
        self._meter = meter
        self._model = model

    def explain(self, facts_for_prompt: str, operation_id: str) -> str:
        config = types.GenerateContentConfig(system_instruction=SYSTEM, temperature=0.2)
        started = time.monotonic()
        response = call_with_retry(
            lambda: self._client.models.generate_content(
                model=self._model, contents=facts_for_prompt, config=config
            )
        )
        record_usage(self._meter, operation_id, "EXPLAIN", self._model, response, started)
        text = (response.text or "").strip()
        if not text:
            raise ValueError("Gemini returned an empty explanation")
        return text
