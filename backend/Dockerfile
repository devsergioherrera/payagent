FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH"
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev
# api: uvicorn payagent.api.main:app --host 0.0.0.0 --port 8000
# worker: python -m payagent.worker.main
CMD ["uvicorn", "payagent.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
