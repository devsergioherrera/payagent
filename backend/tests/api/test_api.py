import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from payagent.adapters.postgres import get_pool
from payagent.api import deps
from payagent.api.main import app
from payagent.app.process_invoice import ProcessedInvoice
from payagent.config import settings
from payagent.domain.decision import Outcome

pytestmark = pytest.mark.db

PASSWORD = "test-password"


class FakePipeline:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str | None]] = []

    def run(self, stored, invoice_id=None):
        self.calls.append((stored.doc.filename, invoice_id))
        return ProcessedInvoice(invoice_id=invoice_id, outcome=Outcome.PAY, explanation="ok")


class FakeNotifier:
    def reply_to_sender(self, origin, body): ...
    def notify_escalation(self, subject, body): ...


@pytest.fixture
def pipeline() -> FakePipeline:
    return FakePipeline()


@pytest.fixture
def anon(monkeypatch, pipeline, tmp_path) -> Iterator[TestClient]:
    monkeypatch.setattr(settings, "admin_password", PASSWORD)
    monkeypatch.setattr(settings, "session_secret", "test-secret")
    from payagent.adapters.upload.storage import FileStorage

    app.dependency_overrides[deps.get_pipeline] = lambda: pipeline
    app.dependency_overrides[deps.get_notifier] = lambda: FakeNotifier()
    app.dependency_overrides[deps.get_storage] = lambda: FileStorage(tmp_path)
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(anon: TestClient) -> TestClient:
    assert anon.post("/auth/login", json={"password": PASSWORD}).status_code == 204
    return anon


@pytest.fixture
def cleanup() -> Iterator[dict[str, list[str]]]:
    ids: dict[str, list[str]] = {"invoice": [], "rule": []}
    yield ids
    with get_pool().connection() as conn:
        for inv in ids["invoice"]:
            conn.execute("delete from approval where decision_id in (select id from decision where invoice_id = %s)", (inv,))
            conn.execute("delete from decision_rule_hit where decision_id in (select id from decision where invoice_id = %s)", (inv,))
            conn.execute("delete from decision where invoice_id = %s", (inv,))
            conn.execute("delete from operation where invoice_id = %s", (inv,))
            conn.execute("delete from invoice where id = %s", (inv,))
        for rule in ids["rule"]:
            conn.execute("delete from decision_rule_hit where rule_id = %s", (rule,))
            conn.execute("delete from rule_condition where rule_id = %s", (rule,))
            conn.execute("delete from rule where id = %s", (rule,))


def _decided_invoice(cleanup, status="PENDING_HUMAN", outcome="ESCALATE") -> str:
    inv, rule = str(uuid.uuid4()), str(uuid.uuid4())
    with get_pool().connection() as conn:
        conn.execute(
            "insert into invoice (id, file_sha256, source, source_ref, status, vendor_name_raw, invoice_number, amount,"
            " currency, amount_usd) values (%s, %s, 'UPLOAD', 'test', 'DECIDED', 'test-vendor', 'test-N1', 1234.5, 'USD', 1234.5)",
            (inv, uuid.uuid4().hex),
        )
        conn.execute(
            "insert into rule (id, name, natural_language, effect, origin, proposed_by, approved_by, active)"
            " values (%s, 'test-regla', 'x', 'ESCALATE', 'HUMAN', 'test', 'test', false)",
            (rule,),
        )
        dec = conn.execute(
            "insert into decision (invoice_id, outcome, status, explanation, explained_by)"
            " values (%s, %s, %s, 'because', 'TEMPLATE') returning id",
            (inv, outcome, status),
        ).fetchone()[0]
        conn.execute(
            "insert into decision_rule_hit (decision_id, rule_id, rule_name, effect, result, observed, threshold)"
            " values (%s, %s, 'test-regla', 'ESCALATE', 'FIRED', '{\"amount_usd\": 1234.5}', '{\"amount_usd\": 1000}')",
            (dec, rule),
        )
    cleanup["invoice"].append(inv)
    cleanup["rule"].append(rule)
    return inv


def test_auth_required_and_login(anon: TestClient):
    assert anon.get("/summary").status_code == 401
    assert anon.post("/auth/login", json={"password": "nope"}).status_code == 401
    res = anon.post("/auth/login", json={"password": PASSWORD})
    assert res.status_code == 204
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert anon.get("/summary").status_code == 200
    anon.post("/auth/logout")
    assert anon.get("/summary").status_code == 401


def test_forged_cookie_rejected(anon: TestClient):
    anon.cookies.set("fy_session", "9999999999.forged")
    assert anon.get("/summary").status_code == 401


def test_list_and_detail(client: TestClient, cleanup):
    inv = _decided_invoice(cleanup)
    rows = client.get("/invoices", params={"q": "test-N1"}).json()
    assert [r["id"] for r in rows] == [inv]
    assert rows[0]["headline"] == "test-regla" and rows[0]["decided_by"] == "AGENT"
    assert client.get("/invoices", params={"q": "test-N1", "status": "PENDING"}).json()[0]["id"] == inv
    assert client.get("/invoices", params={"q": "test-N1", "outcome": "PAY"}).json() == []
    detail = client.get(f"/invoices/{inv}").json()
    assert detail["hits"][0]["rule_name"] == "test-regla"
    assert detail["file_url"] == f"/api/invoices/{inv}/file"
    assert [s["label"] for s in detail["timeline"]][0] == "Factura recibida"
    assert client.get(f"/invoices/{uuid.uuid4()}").status_code == 404
    assert client.get("/invoices/not-a-uuid").status_code == 404


def test_resolve_paths(client: TestClient, cleanup):
    inv = _decided_invoice(cleanup)
    assert client.post(f"/invoices/{inv}/resolve", json={"verdict": "REJECTED"}).status_code == 422
    assert client.post(f"/invoices/{inv}/resolve", json={"verdict": "REJECTED", "note": "  "}).status_code == 422
    res = client.post(f"/invoices/{inv}/resolve", json={"verdict": "APPROVED", "note": "ok"})
    assert res.status_code == 200
    body = res.json()
    assert body["summary"]["decision_status"] == "RESOLVED" and body["summary"]["decided_by"] == "HUMAN"
    assert body["approval"]["approver"] == settings.admin_name
    assert client.post(f"/invoices/{inv}/resolve", json={"verdict": "APPROVED"}).status_code == 409
    final = _decided_invoice(cleanup, status="FINAL", outcome="PAY")
    assert client.post(f"/invoices/{final}/resolve", json={"verdict": "APPROVED"}).status_code == 409


def test_summary_vendors_costs(client: TestClient):
    s = client.get("/summary").json()
    assert set(s) >= {"paid", "held", "escalated", "pending_human", "processing", "autonomy_pct", "email_connected"}
    assert client.get("/vendors").json()
    assert "by_type" in client.get("/costs").json()


def test_rules_create_list_deactivate(client: TestClient, cleanup):
    sources = {s["name"] for s in client.get("/rule-sources").json()}
    assert "invoice" in sources
    draft = {
        "name": "test-regla-api", "natural_language": "montos altos", "effect": "ESCALATE", "overridable": True,
        "conditions": [{"source": "invoice", "column": "amount_usd", "operator": "GT", "value": 5000, "text": ""}],
    }
    res = client.post("/rules", json=draft)
    assert res.status_code == 200, res.text
    rule = res.json()
    cleanup["rule"].append(rule["id"])
    assert rule["origin"] == "HUMAN" and rule["approved_by"] == settings.admin_name and rule["times_fired"] == 0
    assert "5.000" in rule["conditions"][0]["text"]
    assert any(r["id"] == rule["id"] for r in client.get("/rules").json())
    bad = {**draft, "conditions": [{**draft["conditions"][0], "column": "nope"}]}
    assert client.post("/rules", json=bad).status_code == 422
    off = client.post(f"/rules/{rule['id']}/deactivate")
    assert off.status_code == 200 and off.json()["active"] is False
    assert client.post(f"/rules/{uuid.uuid4()}/deactivate").status_code == 404


def test_stubs_return_501(client: TestClient):
    assert client.post("/rules/draft", json={"text": "x"}).status_code == 501
    assert client.get("/proposals").status_code == 501
    assert client.post("/proposals/run").status_code == 501
    assert client.post("/chat").status_code == 501


def test_upload_returns_id_and_runs_pipeline(client: TestClient, pipeline, cleanup):
    content = f"Factura test {uuid.uuid4()}".encode()
    res = client.post("/invoices", files={"file": ("f.txt", content, "text/plain")})
    assert res.status_code == 200
    inv = res.json()["invoice_id"]
    cleanup["invoice"].append(inv)
    assert pipeline.calls == [("f.txt", inv)]  # background task ran with the pre-created id
    dup = client.post("/invoices", files={"file": ("f.txt", content, "text/plain")}).json()
    assert dup == {"invoice_id": None, "duplicate_of": inv}
    assert len(pipeline.calls) == 1
    assert client.post("/invoices").status_code == 422
    text = client.post("/invoices", data={"text": f"pegado {uuid.uuid4()}"}).json()
    cleanup["invoice"].append(text["invoice_id"])
    assert len(pipeline.calls) == 2
