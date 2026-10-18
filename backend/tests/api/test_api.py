from datetime import datetime, timezone
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
    held = _decided_invoice(cleanup, status="FINAL", outcome="HOLD")
    assert client.post(f"/invoices/{held}/resolve", json={"verdict": "APPROVED"}).status_code == 409


def test_invoices_date_filter(client: TestClient, cleanup):
    _decided_invoice(cleanup)
    today = datetime.now(timezone.utc).date().isoformat()  # received_at is stored in UTC
    base = {"q": "test-N1", "from": today, "to": today}
    res = client.get("/invoices", params=base)
    assert res.json() and res.headers["X-Total-Count"] == str(len(res.json()))
    assert client.get("/invoices", params={**base, "from": "2999-01-01", "to": "2999-01-02"}).json() == []
    assert client.get("/invoices", params={**base, "to": "2000-01-01", "from": "2000-01-01"}).json() == []


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


class FakeChat:
    def reply(self, message):
        from payagent.api.schemas import ChatReply

        return ChatReply(text=f"eco: {message}", cards=[])


def test_chat_text_goes_to_the_service(client: TestClient):
    app.dependency_overrides[deps.get_chat] = lambda: FakeChat()
    res = client.post("/chat", data={"message": " hola "})
    assert res.status_code == 200 and res.json() == {"text": "eco: hola", "cards": [], "invoice_id": None}
    assert client.post("/chat", data={"message": "  "}).status_code == 422
    assert client.post("/chat").status_code == 422


def test_chat_file_runs_the_invoice_path(client: TestClient, pipeline, cleanup):
    content = f"Factura chat test {uuid.uuid4()}".encode()
    res = client.post("/chat", data={"message": "mira"}, files={"file": ("c.txt", content, "text/plain")})
    assert res.status_code == 200, res.text
    body = res.json()
    cleanup["invoice"].append(body["invoice_id"])
    assert body["text"] == "Recibí la factura. La estoy revisando."
    assert body["cards"][0]["kind"] == "invoice" and body["cards"][0]["invoice"]["id"] == body["invoice_id"]
    assert pipeline.calls == [("c.txt", body["invoice_id"])]
    dup = client.post("/chat", files={"file": ("c.txt", content, "text/plain")}).json()
    assert dup["invoice_id"] == body["invoice_id"] and len(pipeline.calls) == 1


def test_search_and_pending_queries(client: TestClient, cleanup):
    from payagent.api.deps import get_queries

    inv = _decided_invoice(cleanup)
    q = get_queries()
    assert [r.id for r in q.search_invoices("test-N1")] == [inv]
    assert q.search_invoices("   ") == []
    assert inv in [r.id for r in q.pending_invoices(300)]
    assert q.invoice_summary(inv).id == inv
    vendor = q.vendors().items[0]
    assert [v.id for v in q.vendors_by_id([vendor.id])] == [vendor.id]
    assert len(q.search_invoices(vendor.tax_id, 3)) <= 3


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


@pytest.fixture
def directory() -> Iterator[dict]:
    """A test vendor with 3 POs; PO-A has one paid and one undecided invoice."""
    vendor, tag = str(uuid.uuid4()), uuid.uuid4().hex[:8]
    pos = [f"test-{tag}-{n}" for n in "ABC"]
    inv_paid, inv_open = str(uuid.uuid4()), str(uuid.uuid4())
    with get_pool().connection() as conn:
        conn.execute(
            "insert into vendor (id, name, tax_id, country, currency, bank_rail, bank_account, status)"
            " values (%s, %s, %s, 'MX', 'MXN', 'SPEI', 'test-acct', 'BLOCKED')",
            (vendor, f"test-Zeta {tag} S.A.", f"test-{tag}"),
        )
        for po, status, desc in zip(pos, ("OPEN", "CLOSED", "OPEN"), ("alpha servers", "beta licences", "gamma")):
            conn.execute(
                "insert into purchase_order (vendor_id, po_number, amount, currency, description, status)"
                " values (%s, %s, 1000, 'MXN', %s, %s)", (vendor, po, desc, status),
            )
        for inv, status in ((inv_paid, "DECIDED"), (inv_open, "RECEIVED")):
            conn.execute(
                "insert into invoice (id, file_sha256, source, source_ref, status, vendor_id, invoice_number, amount,"
                " currency, amount_usd, po_number) values (%s, %s, 'UPLOAD', 'test', %s, %s, %s, 4000, 'MXN', 220, %s)",
                (inv, uuid.uuid4().hex, status, vendor, f"test-{inv[:6]}", pos[0]),
            )
        conn.execute(
            "insert into decision (invoice_id, outcome, status, explanation, explained_by)"
            " values (%s, 'PAY', 'FINAL', 'ok', 'TEMPLATE')", (inv_paid,),
        )
    yield {"vendor": vendor, "tag": tag, "pos": pos, "invoices": [inv_paid, inv_open]}
    with get_pool().connection() as conn:
        conn.execute("delete from decision where invoice_id in (select id from invoice where vendor_id = %s)", (vendor,))
        conn.execute("delete from invoice where vendor_id = %s", (vendor,))
        conn.execute("delete from purchase_order where vendor_id = %s", (vendor,))
        conn.execute("delete from vendor where id = %s", (vendor,))


def test_purchase_orders_filters_and_pagination(client: TestClient, directory):
    pos, tag = directory["pos"], directory["tag"]
    page = client.get("/purchase-orders", params={"q": tag}).json()
    assert page["total"] == 3
    first = page["items"][0]
    assert first["po_number"] == pos[0]  # the one with invoice activity sorts first
    assert (first["invoices"], first["amount_usd"], first["invoiced_usd"], first["remaining_usd"]) == (2, 55.0, 220.0, -165.0)
    assert first["vendor_name"].startswith("test-Zeta") and first["last_invoice_at"]
    assert client.get("/purchase-orders", params={"q": f"test-Zeta {tag}"}).json()["total"] == 3  # vendor name
    assert client.get("/purchase-orders", params={"q": directory["tag"], "status": "CLOSED"}).json()["total"] == 1
    assert client.get("/purchase-orders", params={"q": "beta licences"}).json()["items"][0]["po_number"] == pos[1]
    by_vendor = {"vendor_id": directory["vendor"]}
    assert client.get("/purchase-orders", params=by_vendor).json()["total"] == 3
    assert client.get("/purchase-orders", params={**by_vendor, "with_balance": "true"}).json()["total"] == 1
    two = client.get("/purchase-orders", params={**by_vendor, "limit": 2}).json()
    rest = client.get("/purchase-orders", params={**by_vendor, "limit": 2, "offset": 2}).json()
    assert two["total"] == rest["total"] == 3 and len(two["items"]) == 2 and len(rest["items"]) == 1
    assert client.get("/purchase-orders", params={"vendor_id": "nope"}).json() == {"items": [], "total": 0}


def test_purchase_order_detail(client: TestClient, directory):
    res = client.get(f"/purchase-orders/{directory['pos'][0]}").json()
    assert res["po"]["invoiced_usd"] == 220.0
    assert {i["id"] for i in res["invoices"]} == set(directory["invoices"])
    assert client.get("/purchase-orders/test-missing").status_code == 404


def test_vendors_page_and_invoice_pagination(client: TestClient, directory):
    tag = directory["tag"]
    page = client.get("/vendors", params={"q": tag}).json()
    assert page["total"] == 1 and len(page["items"][0]["purchase_orders"]) == 3
    assert page["items"][0]["invoices"] == 2 and page["items"][0]["paid_usd"] == 220.0
    assert client.get("/vendors", params={"q": tag, "status": "ALLOWED"}).json()["total"] == 0
    assert client.get("/vendors", params={"q": tag, "country": "MX"}).json()["total"] == 1
    assert client.get("/vendors", params={"q": tag, "country": "CO"}).json()["total"] == 0
    res = client.get("/invoices", params={"vendor_id": directory["vendor"], "limit": 1})
    assert res.headers["x-total-count"] == "2" and len(res.json()) == 1
    rest = client.get("/invoices", params={"vendor_id": directory["vendor"], "limit": 1, "offset": 1}).json()
    assert len(rest) == 1 and rest[0]["id"] != res.json()[0]["id"]
    one = client.get(f"/vendors/{directory['vendor']}").json()
    assert one["tax_id"] == f"test-{tag}" and len(one["purchase_orders"]) == 3
    assert client.get(f"/vendors/{uuid.uuid4()}").status_code == 404
    assert client.get("/vendors/not-a-uuid").status_code == 404
