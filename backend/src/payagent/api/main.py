from fastapi import Depends, FastAPI

from payagent.api.deps import require_session
from payagent.api.routers import auth, chat, dashboard, invoices, policy, proposals, purchase_orders, rules, transcribe

app = FastAPI(title="payagent")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
for module in (invoices, rules, policy, proposals, dashboard, chat, purchase_orders, transcribe):
    app.include_router(module.router, dependencies=[Depends(require_session)])
