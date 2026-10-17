from fastapi import FastAPI

app = FastAPI(title="payagent")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
