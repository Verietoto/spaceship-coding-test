# One image: React build served by FastAPI.
FROM node:22-alpine AS web
WORKDIR /web
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/app ./app
COPY backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY --from=web /web/dist /app/frontend/dist
RUN useradd --create-home app && chown -R app /app/backend
USER app
ENV SECURE_COOKIES=1 PORT=8000
EXPOSE 8000
# Migrate, load the orders once (idempotent), then serve.
CMD ["sh", "-c", ".venv/bin/alembic upgrade head && .venv/bin/python -m app.modules.analytics.seed && exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
