from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from payagent.api import deps
from payagent.api.routers import transcribe as router
from payagent.app.transcribe import MAX_BYTES, TranscribeService


class FakeModels:
    def __init__(self, fail=False):
        self.fail, self.calls = fail, []

    def generate_content(self, model, contents, config):
        self.calls.append(contents)
        if self.fail:
            raise RuntimeError("boom")
        return SimpleNamespace(text=" hola mundo ", usage_metadata=SimpleNamespace(prompt_token_count=3, candidates_token_count=2))


class Recorder:
    def __init__(self):
        self.usage, self.ops = [], []

    def record(self, *args):
        self.usage.append(args)

    def start(self, kind):
        self.ops.append(("start", kind))
        return "op"

    def finish(self, op, error=None):
        self.ops.append(("finish", error))


def make(fail=False):
    rec, models = Recorder(), FakeModels(fail)
    service = TranscribeService(client=SimpleNamespace(models=models), meter=rec, operations=rec)
    app = FastAPI()
    app.include_router(router.router)
    app.dependency_overrides[deps.get_transcriber] = lambda: service
    return TestClient(app), rec, models


def post(client, data: bytes):
    return client.post("/transcribe", files={"audio": ("a.webm", data, "audio/webm;codecs=opus")})


def test_transcribes_and_meters_as_chat():
    client, rec, models = make()
    res = post(client, b"abc")
    assert res.status_code == 200 and res.json() == {"text": "hola mundo"}
    assert rec.usage[0][1] == "CHAT" and rec.ops == [("start", "CHAT"), ("finish", None)]
    assert "Spanish" in models.calls[0][0]


def test_empty_audio_is_422_and_skips_gemini():
    client, rec, models = make()
    assert post(client, b"").status_code == 422
    assert models.calls == [] and rec.ops == []


def test_over_limit_is_413():
    client, _, models = make()
    assert post(client, b"x" * (MAX_BYTES + 1)).status_code == 413
    assert models.calls == []


def test_gemini_failure_is_502_and_closes_the_operation(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda _: None)
    client, rec, _ = make(fail=True)
    assert post(client, b"abc").status_code == 502
    assert rec.ops[-1][0] == "finish" and rec.ops[-1][1]
