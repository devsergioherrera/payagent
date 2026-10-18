from fastapi import Depends, FastAPI

from payagent.api.deps import require_session
from payagent.api.routers import auth, chat, dashboard, invoices, proposals, purchase_orders, rules

app = FastAPI(title="payagent")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
for module in (invoices, rules, proposals, dashboard, chat, purchase_orders):
    app.include_router(module.router, dependencies=[Depends(require_session)])
