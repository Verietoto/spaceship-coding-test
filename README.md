# Spaceship: AI-Powered Logistics Analytics Dashboard

An operations and procurement dashboard for seeing delivery health, finding the cause of problems, and acting on them. You can filter the data with regular controls or in **natural language (Indonesian/English)** through the Copilot, and you can ask the AI to **build a dashboard for you** from a single sentence. Every number is computed with SQL and can be inspected: the AI never makes numbers up.

The data is a CSV of 400 orders (Jan–Dec 2025) that is **not included in the repo**: put it at `data/mock_logistics_data.csv` (or set `DATA_CSV`). The CSV is read once to fill the `orders` table in Postgres; after that every query reads the database.

**In this README**

1. [Running with Docker](#1-running-with-docker): frontend and backend together, plus development mode
2. [Tech stack and why](#2-tech-stack-and-why)
3. [Agent concept](#3-agent-concept)
4. [Reference](#4-reference): features, code architecture, filters, how numbers are computed, tests, deploy, limitations

---

## 1. Running with Docker

### How it works

The frontend (React) and backend (FastAPI) are **built into a single image** and run in **one container**: FastAPI serves the API at `/api/*` and the built React files at `/`. So there is no separate frontend container, no CORS, and only one port.

```
docker compose up
 ├─ db   postgres:17-alpine   data in the `pgdata` volume
 └─ app  image built from the Dockerfile
          ├─ stage 1 (node:22)       pnpm build  →  frontend/dist
          └─ stage 2 (python:3.12)   FastAPI (API + frontend files) on port 8000 → mapped to 8010
             on start: alembic upgrade head → seed 400 orders → uvicorn
```

### Steps (the first run takes a few minutes to build the image)

Prerequisite: Docker with Compose v2 (Docker Desktop, or Docker Engine + the compose plugin).

**1. Put the data in place.** The order CSV is not in the repo. Copy `mock_logistics_data.csv` into the `data/` folder at the repo root (that folder is mounted read-only into the container, so the file never ends up in the image). Without it the container stops on start with `order data not found`.

**2. Create `.env` at the repo root** (next to `docker-compose.yml`, not `backend/.env`). There are no default secrets; `docker compose` refuses to run without the first three:

```bash
cat > .env <<EOF
POSTGRES_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(16))")
ANALYTICS_RO_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(16))")
SESSION_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-to-a-strong-password
# Optional: without this the whole dashboard still works, only the AI features are off
# OPENAI_API_KEY=sk-...
EOF
```

The database passwords end up inside connection URLs, so use letters and digits only (like the `token_hex` output above), not symbols such as `@` or `/`.

**3. Build and run:**

```bash
docker compose up --build -d
```

On start the container runs the migrations (`alembic upgrade head`), loads the 400 orders from `data/mock_logistics_data.csv` into the database (only when the table is empty, so it is safe to repeat), and then starts the server.

**4. Create the login accounts (once).** Accounts are **not** created automatically on start, so without this step the login is rejected:

```bash
docker compose exec app .venv/bin/python -m app.modules.auth.seed
# seeded: admin
```

This creates the accounts from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (and `VISITOR_EMAIL`/`VISITOR_PASSWORD` if set in `.env`). It is safe to repeat.

**5. Open http://localhost:8010** and log in with the admin account. Change the port with `APP_PORT=8080` in `.env`.

**6. (Optional) Turn on the AI.** Put `OPENAI_API_KEY` in `.env`, then run `docker compose up -d` (the container is recreated with the new value). Or log in as admin and fill it in under **Backoffice > AI** (provider, key, model) with no restart. Without a key the AI answers "AI is not configured" and everything else keeps working. For faster and cheaper routing and guardrails, also set `TYPESAFE_API_KEY` (see [Agent concept](#3-agent-concept)).

### Everyday commands

| Need | Command |
|---|---|
| Follow the app logs | `docker compose logs -f app` |
| Stop (data is kept) | `docker compose down` |
| Stop **and delete the data** (DB volume) | `docker compose down -v` (then repeat step 4) |
| Rebuild after changing code | `docker compose up --build -d` |
| Open a database shell | `docker compose exec db psql -U spaceship -d spaceship` |
| Check the server is up | `curl -I http://localhost:8010/` |

### Development mode (hot reload)

To change code with automatic reload, run the database in Docker and the backend/frontend directly on your machine. Extra prerequisites: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22 + pnpm.

```bash
# 1. Postgres only (a superuser, so the migration can create the analytics_ro role)
docker run -d --name spaceship-db -p 5432:5432 \
  -e POSTGRES_USER=spaceship -e POSTGRES_PASSWORD=dev-pass -e POSTGRES_DB=spaceship \
  -v spaceship-dbdata:/var/lib/postgresql/data postgres:17-alpine
docker exec spaceship-db createdb -U spaceship spaceship_test    # separate database for pytest

# 2. Backend (port 8010); first put data/mock_logistics_data.csv in place (it is not in the repo)
cp backend/.env.example backend/.env
#    set: DATABASE_URL=postgresql+psycopg://spaceship:dev-pass@localhost:5432/spaceship
#         DATABASE_URL_READONLY=postgresql+psycopg://analytics_ro:<ANALYTICS_RO_PASSWORD>@localhost:5432/spaceship
#         TEST_DATABASE_URL / TEST_DATABASE_URL_READONLY: the same, pointing at the spaceship_test database
#         ANALYTICS_RO_PASSWORD, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD (+ OPENAI_API_KEY if needed)
cd backend && uv sync
uv run --env-file .env alembic upgrade head
uv run --env-file .env python -m app.modules.analytics.seed     # 400 orders, idempotent
uv run --env-file .env python -m app.modules.auth.seed          # admin/visitor accounts
uv run --env-file .env uvicorn app.main:app --port 8010 --reload

# 3. Frontend (port 5173; Vite proxies /api to 8010)
cd frontend && pnpm install && pnpm dev
```

Open http://localhost:5173. If port 5432 is already used by another Postgres, use `-p 5433:5432` and adjust the URLs in `backend/.env`.

Schema changes: edit the module's `models.py`, run `uv run --env-file .env alembic revision --autogenerate -m "..."`, review the file in `migrations/versions/`, then run `alembic upgrade head`.

### Environment variables

For Docker only three are required (`POSTGRES_PASSWORD`, `ANALYTICS_RO_PASSWORD`, `SESSION_SECRET`); `docker-compose.yml` builds the `DATABASE_URL*` values itself. The full table (also valid for `backend/.env` in development mode):

| Env | Purpose |
|---|---|
| `DATABASE_URL` | Postgres for the app (schema owner, runs the migrations) |
| `DATABASE_URL_READONLY` | The `analytics_ro` login, for SQL written by the LLM or saved in widgets |
| `ANALYTICS_RO_PASSWORD` | The password migration `0003` sets for `analytics_ro` |
| `TEST_DATABASE_URL`, `TEST_DATABASE_URL_READONLY` | Dedicated test database (required for `pytest`) |
| `OPENAI_API_KEY` | AI key (OpenAI, or OpenRouter when `OPENAI_BASE_URL` is set). As a fallback, **Backoffice > AI** can override provider, key and model without a restart |
| `OPENAI_MODEL` | Default `gpt-6-luna` (a low-cost model for tool calling) |
| `OPENAI_MODEL_SUBAGENT` | A different model for subagents (optional; empty = same as `OPENAI_MODEL`) |
| `TYPESAFE_API_KEY` | Jev (TypeSafe) key for routing. Empty = no routing, all tools are loaded |
| `JEV_THRESHOLD`, `JEV_TIMEOUT_MS` | Confidence threshold (default 0.6) and time limit (default 1000 ms) before routing is ignored |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`, `VISITOR_EMAIL` / `VISITOR_PASSWORD` | The two login accounts, created with `uv run --env-file .env python -m app.modules.auth.seed` (roles `admin` and `visitor`) |
| `SETTINGS_KEY` | Optional. A Fernet key that encrypts the AI API key saved through the Backoffice (without it the key can only come from `OPENAI_API_KEY`). Create one with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Do not change it after a key has been saved, or that key must be re-entered |
| `SESSION_SECRET` | **Required**, random, at least 32 characters (no default; the app refuses to start if it is empty, short, or still `change-me…`). The HMAC key for the session cookie |
| `SESSION_HOURS` | How long a login lasts (default 8 hours). Logout revokes the token itself, not just the cookie |
| `SECURE_COOKIES` | `1` behind HTTPS (the default in the Docker image) |
| `LOGIN_IP_PER_MINUTE`, `LOGIN_MAX_FAILURES` | Login limits: attempts per IP per minute (20), and wrong passwords per email before a 15-minute lockout (5). Over the limit = HTTP 429 + `Retry-After` |
| `AI_PER_MINUTE`, `AI_PER_HOUR`, `AI_CONCURRENT` | Per-user quota for AI endpoints (10/minute, 100/hour) and how many requests may run at once (2) |
| `DASH_SAVES_PER_HOUR`, `DASH_OPENS_PER_MINUTE` | Dashboard saves per hour (20) and dashboard opens per minute (60), per user |
| `SCRYPT_LOG_N` | Password hash cost (default 15 = N 2^15, r 8, p 3; the cost is stored with the hash, and old hashes are upgraded automatically at login) |
| `ENABLE_DOCS` | `1` turns on `/docs` and `/openapi.json` (off by default) |
| `DATA_CSV` | Location of the CSV for the seed (default `data/mock_logistics_data.csv`; this file is not in the repo). Only read while the `orders` table is empty |

---

## 2. Tech stack and why

The guiding principles: **few moving parts**, **numbers computed in one place (SQL)**, and **the AI may only act through paths that can be inspected**. That is why there is one database for everything, one service for frontend and backend, and almost no extra libraries in the frontend.

### Backend

| Technology | Used for | Why it was chosen |
|---|---|---|
| **Python 3.12 + [uv](https://docs.astral.sh/uv/)** | Language and package manager | The richest LLM and data ecosystem. `uv` gives a fast, reproducible lockfile (`uv sync --frozen` in Docker). |
| **FastAPI + Pydantic** | HTTP API | Request/response schemas are validated automatically and act as the contract; supports streaming (agent progress is sent as NDJSON). Routers are deliberately thin, with no SQL. |
| **PostgreSQL 17** | The only database | Derived columns (`month`, `lead_days`, `age_days`) as *generated columns*; `percentile_cont` for P90; JSONB for saved dashboards/widgets; full-text search for the knowledge base; **roles and `statement_timeout`** to confine AI-written SQL. |
| **SQLAlchemy 2 + Alembic + psycopg 3** | App tables and migrations | The ORM is used only for app tables (dashboards, presets, users, …); analytic numbers stay hand-built, validated SQL so the query shown is the query that ran. Alembic gives a versioned schema history (including creating the read-only role). |
| **deepagents + langchain-openai** | Agents: coordinator and subagents | A ready-made coordinator + subagent pattern with tool calling; a subagent only sees the coordinator's instructions, not the chat history. The API is OpenAI-compatible, so the provider can be OpenAI or OpenRouter (just change `OPENAI_BASE_URL`). |
| **Jev ([TypeSafe](https://pypi.org/project/langchain-typesafe/))** | Routing, guardrails, language detection | A decision model that answers typed questions with probabilities in tens to hundreds of ms, much faster and cheaper than the main LLM. Optional: if unavailable the system falls back to safe behavior (all tools loaded). |
| **cryptography (Fernet)** | Encrypting the API key in the Backoffice | An AI key saved through the UI is encrypted in the database and never returned by the API. |
| **Signed session cookie (HMAC) + scrypt** | Login | No extra auth dependency; passwords are hashed with standard `scrypt`, and the cost is stored with the hash so it can be raised later. |
| **pytest + httpx** | Tests | The AI model is replaced by a fake one, so the whole suite runs without an API key. |

### Frontend

| Technology | Used for | Why it was chosen |
|---|---|---|
| **React 19 + TypeScript** | UI | Small reusable components, and types that keep the shape of API data intact all the way to the screen. |
| **Vite** | Dev server and build | Instant reload in development (proxying `/api` to the backend) and a fast build for FastAPI to serve. |
| **recharts** | Charts (bar, line, area, pie, scatter, radar, funnel, treemap, sankey) | Declarative charts for most of the 15 types the agent can create. Heatmaps and tables are drawn with HTML/CSS, and so are the bar charts on the Overview page, to keep them light and easy to give tooltips. |
| **Home-grown i18n (`src/i18n/`)** | ID/EN | Every text holds all languages side by side (`{ id, en }`); a missing language **fails the build**, and numbers/money/dates go through `Intl`. |
| **Plain CSS + CSS variables** | Styling and theme | Light/dark themes only need different variables; no CSS framework. |
| **vitest + oxlint** | Tests and lint | Fast; oxlint runs the React, hooks and accessibility rules. |
| **pnpm** | Packages | Fast installs and a strict lockfile (`--frozen-lockfile` in Docker). |

The frontend has only three *runtime* dependencies (`react`, `react-dom`, `recharts`). There is no routing, state, UI-kit or Markdown library: state uses React context, and the Markdown renderer (with safe links) is written in-house. The result is a small bundle and a narrow supply-chain attack surface.

### Infrastructure

| Technology | Why |
|---|---|
| **Docker multi-stage + Compose** | One image holds the built frontend and the backend; one command runs the database and the app. The container runs as a non-root user, and migrations plus seed run automatically on start. |
| **Frontend served by FastAPI** | One origin: no CORS, a simple session cookie, and deploying is just one container + Postgres. |

---

## 3. Agent concept

**The core idea:** the language model is not given access to the data, only to **a small set of tools** that the server validates. It decides *what needs to be done*; numbers always come from **read-only SQL**, and every answer carries the formula and the query that produced it. So the AI can help without being able to invent numbers or damage data.

### The big picture

```
User message
   ├─► Input guard (Jev)   on-topic? prompt injection? sensitive data?   ─► refused without calling the LLM
   ├─► Language (Jev)      Indonesian / English
   └─► Router (Jev)        which tools and subagents are needed?
                │
                ▼
        COORDINATOR  (main LLM, deepagents)
        tools: get_view · set_filters · open_section · remember · search_kb · task
                │  task(...)  (a subagent only sees the instructions, not the chat history)
                ├─► analyst      get_view · get_kpis · get_facets · run_sql           numeric questions
                ├─► charter      get_view · get_facets · run_sql · make_chart         charts
                ├─► forecaster   get_view · forecast_demand                           demand forecasts
                └─► builder      get_view · get_facets · run_sql · create_dashboard   dashboard drafts
                              │
                              ▼
        db/readonly.py ─► PostgreSQL, `analytics_ro` login (SELECT only, 5 s timeout)
```

### Five principles

1. **The LLM acts only through tools.** Tools validate all input on the server (filter values are checked against the data, SQL is wrapped and capped). The only tool that "writes" is `create_dashboard`, and its result is only a **draft in memory**: saving is still the user's button.
2. **Numbers come from SQL, and can be inspected.** Every answer has a **"How the AI calculated this"** panel: the active filters, the number of rows, and a formula with numbers ("55 delayed ÷ 400 orders = 13.8%"). The SQL itself is in the API payload for auditing.
3. **Layered, not dependent on a single guard.** AI SQL runs as a separate login that may only `SELECT` from the `orders` table, one statement, with row and time limits. The Jev guards (input and tool) are only an extra layer on top.
4. **Fail safe.** If Jev is unsure, slow, or its key is empty, **all tools are loaded**: routing makes a request cheaper, never makes it fail. Without an AI API key the whole dashboard still works.
5. **Specialized subagents with narrow context.** Each subagent loads only the tools and prompt for its job, which is cheaper and means fewer wrong tool choices.

### Who does what

| Agent | Job | Example request |
|---|---|---|
| **coordinator** | Understands the request, changes filters/sections, remembers user notes, searches the knowledge base, delegates | "Show Q4 for UPS", "remember that I handle client CL-1004" |
| **analyst** | Numeric questions (standard KPIs or its own SQL) | "What is FedEx's delay rate in EU?" |
| **charter** | Builds charts | "Heatmap of delay rate by carrier × region" |
| **forecaster** | Order or unit forecasts for 1–6 months, with inventory recommendations | "Forecast units for the PAPER category for the next 3 months" |
| **builder** | Drafts a dashboard (KPIs + charts + filters), testing each widget's SQL before handing it over | "Carrier performance dashboard with period and region filters" |

### Example flow: "heatmap of delay rate by carrier × region"

1. Input guard: the topic is the dashboard, so it passes. Jev picks the `chart` intent → only `charter` is loaded.
2. The coordinator delegates to **charter** through `task` with a short instruction.
3. Charter reads the active filters (`get_view`), writes the SQL `SELECT carrier, region, delay_rate …` and calls `make_chart(type="heatmap", x="carrier", series="region", y=["delay_rate"])`.
4. The server runs the SQL through `analytics_ro` and checks that the columns `carrier`, `region`, `delay_rate` exist and `delay_rate` is numeric. If not, charter receives the error and fixes it.
5. The chart comes back in the response together with the formula and the SQL; the UI draws the heatmap and adds "How the AI calculated this". While this runs, the UI shows an agent timeline (`route` → `agent` → `tool` → `done`).

### Builder: ask first, then build

1. **Clarify** (`/api/builder/clarify`): Jev judges whether the request is specific enough. If so, it is built right away without an LLM. If vague, one LLM call writes a single question with 2–4 options **taken from the real data** (carriers, regions, periods); the user may also type their own answer. At most 3 questions, and one of them asks for the chart type unless it was already named.
2. **Build** (`/api/builder/stream`): the builder agent tests each widget's SQL, then calls `create_dashboard`. Widgets that fail (bad SQL, mismatched columns) are reported back to the agent to fix.
3. **Draft**: try it out with its filters, change it by prompt ("turn the pie into a bar", "three charts in one row"), then save it in the sidebar or discard it.

### Charts the agent can create

| Type | Good for | SQL result shape |
|---|---|---|
| `bar`, `hbar` | Comparing categories; rankings or long labels | `x` category, `y` number |
| `stacked_bar`, `area` | Parts of a whole; accumulating trends | like bar/line |
| `line`, `combo` | Trends; two measures with different units (bars + a line on the right axis) | `x`, `y` (bars), `y_line` (lines) |
| `histogram` | Distributions | `x` bin label, `y` count |
| `pie` | Shares (max. 6 slices, the rest "Other") | `x`, `y` |
| `heatmap` | Two dimensions at once (carrier × region) | `x` rows, `series` columns, `y` value |
| `scatter` | Relation between two measures (optional color and bubble size) | `x`, `y` numbers; `series`, `size` |
| `funnel`, `treemap`, `radar`, `sankey` | Ordered stages; parts of a whole; comparing several measures; flows | see `agents/builder.py` |
| `table` | The numbers as they are | free |

`series` allows the long format (one row per `x` and series), so more than 4 series is fine (max. 8). `target` draws a goal line, and on a KPI it becomes a progress bar.

### Extending it

- **New subagent:** one file in `backend/app/modules/ai/agents/` (`NAME`, `INTENT`, `DESCRIPTION`, `TOOLS`, `prompt`) and one line in `REGISTRY` in `agents/router.py`; the routing questions are built automatically from the registry.
- **New chart type:** add it to `ChartType` (`dashboards/schemas.py`), add one component in `frontend/src/components/charts/`, and add its SQL guidance to the builder and charter prompts.
- **Business knowledge:** team documents (SLAs, business rules) are added by an admin in the **Backoffice**; the agent finds them with full-text search and answers as if it already knew.

### Technical details of the agents

- **Jev routing:** a decision model that answers typed questions (needs the analyst? a chart? the builder? a view change? the main intent?) with probabilities, in tens to hundreds of ms. Only the selected tools and subagents are loaded into the LLM. If Jev is unsure (below `JEV_THRESHOLD`), slow, failing, or its key is empty, **everything is loaded**: routing never makes a request fail. The decision is part of the response (`route`).
- **Limits:** no shell, no file access (deepagents' built-in file tools are turned off and every file operation is refused), no general-purpose subagent. All SQL goes through `db/readonly.py`. The only tool that "writes" is `create_dashboard`, which only creates a draft in memory; saving is still the user's button.
- **Calculation trace:** every query tool is recorded per request, so "How the AI calculated this" stays complete even though the coordinator only receives the subagent's final text.
- **Adding a subagent:** one file like `agents/analyst.py` (`NAME`, `INTENT`, `DESCRIPTION`, `TOOLS`, `prompt`) and one line in `agents/router.py: REGISTRY`. The routing questions are built automatically from the registry.
- `/api/explain` and `/api/summary` remain a single LLM call (no tools needed).
- **Live progress:** `POST /api/copilot/stream` sends one JSON object per line (NDJSON) while the agent works: `route` (Jev's choice), `guard` (a refusal), `agent` (the subagent dispatched), `tool` / `tool_done` (name, a few safe arguments, row count; never SQL or data), `agent_done`, then `done` with the same response as `/api/copilot` (which still exists, without progress). The Copilot panel shows it as an animated timeline and folds it under the answer. Behind a proxy, turn off buffering for this path (`X-Accel-Buffering: no` is already sent).
- **Builder that asks:** `POST /api/builder/clarify` decides whether the request is clear enough. Jev is the quick gate (two questions: does it name a measure? is it specific?); a specific request is `ready` straight away without an LLM; a vague one triggers one LLM call that writes a single question with 2–4 options from the real data (the user may also type their own answer), at most 3 rounds, and off-topic requests are refused. There is no server-side state: the client resends the prompt and all answers. `POST /api/builder/stream` builds it while sending progress (NDJSON: Builder agent, tool, widget titles, result) and then `done` with the draft; the older `/api/builder` still exists.
- **"How the AI calculated this" shows formulas, not SQL.** The backend sends the numbers behind each metric (`calc.terms`, from the same `stats()` as the page) and the UI arranges them into a formula with numbers that can be checked ("55 delayed ÷ 400 orders = 13.8%"). For queries written by the agent, the formula is only a definition without numbers (the agent writes it before seeing the result, so numbers from it are not trusted). The SQL stays in the API payload for auditing and is not displayed.
- **Chart types from the agent:** 15 types (see the table above). The list has a single source, `ChartType` in `dashboards/schemas.py`; a widget spec carries `x`, `y`, and optionally `series` (long format: rows of `x, series, value`, pivoted by the frontend; up to 8 series), `y_line` (combo lines), `size` (bubbles), `target` (a line/goal; on a KPI a progress bar, with `better`: `high`/`low`). After the SQL runs, the columns it names must exist in the result and the `y` values must be numeric; otherwise the agent receives an error and fixes it (the same path as failing SQL), instead of an empty chart. A pie with more than 6 slices shows the 5 biggest + "Other". To add a type: add it to `ChartType`, add one component in `frontend/src/components/charts/`, and add one guidance line to the `agents/builder.py` and `agents/charter.py` prompts.
- **Dashboard layout from the agent:** a widget may carry `span` (1–12 columns of the 12-column grid: 12 a full row, 6 half, 4 a third, 3 a quarter); widgets fill a row left to right in list order, so "three charts in one row" = three consecutive charts with `span: 4`. Without `span`, a KPI takes 4 and a chart 12 (a whole row). A chart is at least 4 and a KPI at least 2 (tidied silently). A dashboard holds at most 24 widgets; beyond that the agent is told (nothing is dropped silently) and is asked to say what it sacrificed. Layout can be requested in the first prompt, or changed through "Change this dashboard" on a draft or a saved dashboard. Width is measured from the dashboard container: ≤ 900 px a span below 6 becomes 6, ≤ 620 px everything is a single column.
- **Dashboards with filters from the agent:** `create_dashboard` accepts `filters` (period, arrival date, all the choice filters, and number ranges with `min`/`max`, each with a default when the request names a scope). A widget follows the filters by placing the `{{WHERE}}` marker in its WHERE clause; when rendered, the marker is replaced by a clause from the same filter generator as the main dashboard (values are validated against the data, and the result still goes through the read-only login). `GET /api/dashboards/{id}` opens the dashboard at its defaults; with `custom=true` the query string becomes the whole truth (empty = all), and only the filters the dashboard declared can narrow it. The agent gets an error if a filter is unknown, a default is invalid, or no widget uses `{{WHERE}}`.
- **Dashboard glossary** (`agents/glossary.py`): the meaning of every card, chart and section (formula, suggested target, what a change/comparison means). It is in the coordinator's prompt, so "what does P90 mean?" is answered straight away without a tool (Jev intent `explain`); if the user also asks for the value, the coordinator delegates to the analyst. Change it together with the UI texts and `analytics/metrics.py`.

### Reply language (Jev)
Jev's third step, in parallel with the input guard and routing, reads the language of the **message** (`ai/language.py`): Indonesian (including a mix with English technical terms), English, or another language. The agent only answers in Indonesian or English: an Indonesian message is answered in Indonesian, an English message in English, **any other language is answered in English** (that message gets a short reminder appended, because models tend to mirror the user's language). If Jev is unsure (below `JEV_THRESHOLD`), fails, or the message is a single Latin word or code ("UPS"), the language of the UI toggle is used. This also applies to guard refusal messages and Builder questions and titles. The result is recorded in `route.language`. UI labels and buttons still follow the language toggle.

### Guardrails (Jev)
Two Jev checks around the Copilot (`modules/ai/guard.py`), all of them typed questions with probabilities:
- **Input**, in parallel with routing: only dashboard topics (data, filters, charts, reports, the knowledge base, user notes) or **its creator** are answered. `off_topic` (code, general knowledge, foreign political figures, etc.), `prompt_injection` and `sensitive_data` are refused with a fixed message **without calling the LLM**. The `GUARD_OFFTOPIC_THRESHOLD` is lower than `GUARD_THRESHOLD` so that ambiguous dashboard questions still pass. Answers about the creator come from a KB document (e.g. titled "About the dashboard's creator") filled in by an admin; no content means "no information yet".
- **Tool**: before `run_sql`, `make_chart`, `create_dashboard`, does the query match the request? If Jev is sure it does not, the query is not run and the agent is told why.
- **Only a second layer.** The read-only login, single statement, row cap, timeout and filter-value validation do not depend on Jev, and the agent's prompt carries the same scope rules. Without a key, on timeout or on error, the check is **skipped** (`skipped`) and the request goes ahead: the guard can refuse, but never makes a request fail.
- Anything blocked or flagged is recorded in `guard_events` (for a future admin page); the response carries `guard` and the UI shows a "Checked by guardrails" badge.

### Backoffice
The **Backoffice** menu (admin only; the server rejects other accounts with 403) has two tabs:
- **Knowledge documents**: add, edit and delete team documents.
- **AI**: provider (OpenAI or OpenRouter, with preset fixed URLs), API key, model and subagent model. Applies to the next AI request with no restart. Settings in the database override `.env` per field; `.env` remains the fallback. The key is write-only: stored encrypted (Fernet, `SETTINGS_KEY`), never returned by the API or logged, and the UI only shows the last four characters. The **Test connection** button tries the values being entered before they are saved. The Jev (TypeSafe) key stays in `.env`. The settings cache lives in process memory (5-second TTL, cleared on save).

### Knowledge
- **About me** (`user_facts`): personal notes per account, e.g. "I handle client CL-1004". Managed in the Knowledge section (all accounts) or through chat ("remember that …", the `remember` tool). They go into every agent's prompt as context, not as instructions.
- **Team documents** (`kb_docs`): SLA contracts, business rules, KPI definitions. Managed in the **Backoffice** (`admin` only, in the UI and the API); the Copilot still reads them for every account. Searched with Postgres full-text search (the `search_kb` tool, only loaded when Jev picks the `knowledge` intent or `needs_kb`), and the answer is delivered as if the Copilot already knew it (without mentioning "knowledge base" or the document title).

---

## 4. Reference

### Features

| Area | What it has |
|---|---|
| 7 sections | Overview (6 KPIs: total orders, delivered, delayed, on-time rate, average delivery time, value at risk, each with a comparison; delay trend; lead-time histogram; value tooltip on bar hover), Delivery performance (carrier ranking, carrier × region heatmap, warehouses by region), Clients, Risk & exceptions (ordered by business impact), Demand forecast (orders or units, by category, inventory recommendation), Data quality, Reports |
| Filters | Period (all data, presets for year/half/quarter/month from the years in the data, or a custom date range), region, warehouse, carrier, client, product category, status, promo, origin city, destination city, SKU: **pick several values** or **everything except** certain values, with the order count per option; number ranges (order value, quantity, lead time, order age) and arrival date. Comparison in one strip above the KPI cards: previous period, **any other period you choose** (e.g. H2 vs H1, Q3 vs Q1), or all data. Filters live in the URL (shareable), can be saved as presets, and "Export PDF" prints the active view |
| AI: Command bar + Copilot | Sets filters and opens sections from a sentence, answers with numbers from queries, creates dynamic charts (15 types: bar, horizontal, stacked, area, line, combo, histogram, pie, table, heatmap, scatter, funnel, treemap, radar, sankey), a "What I changed" list, an **AI** tag on filters, **Undo** |
| AI: transparency | Every numeric answer has "How the AI calculated this": the filters, rows counted, the formula, and the **SQL that actually ran** |
| AI: Builder | One sentence → plan + dashboard draft (KPIs + charts + filters you can try before saving) → saved in the sidebar; drafts and saved dashboards can be changed by prompt (the AI's proposal is reviewed first, then "Save changes" or "Discard") |
| AI: explanations | Per problem order, per data-quality issue, and a report summary from the active filters |
| Reports | CSV export matching the filters, print/save as PDF, report schedules (stored; email delivery is still simulated) |
| Global | ID/EN, light/dark, admin and visitor logins |

### Code architecture

```
Browser (React + Vite, recharts)
   │  /api/* (session cookie)
   ▼
FastAPI  app/main.py: each feature module contributes one router
   ├─► modules/analytics ──► PostgreSQL `orders` (app user)
   ├─► modules/ai ─► Jev (routing) ─► coordinator agent ─► subagents analyst · charter · builder (deepagents + OpenAI)
   │        └─► db/readonly.py ──► PostgreSQL `orders` (`analytics_ro` login: SELECT only, read-only, 5 s timeout)
   ├─► modules/dashboards ──► PostgreSQL `dashboards` (widgets are re-rendered through db/readonly.py)
   ├─► modules/schedules ──► PostgreSQL `schedules`
   └─► modules/auth (simulated login)
```

One service: FastAPI serves the API and the built React app. `docker compose up` runs Postgres + the app.

#### Backend (`backend/app/`)

| Path | Role |
|---|---|
| `main.py` | `create_app()`: mounts the routers from the `MODULES` list, serves `frontend/dist` |
| `core/` | `config.py` (all env + paths), `security.py` (session cookie), `errors.py` (AI errors → HTTP 503/502) |
| `db/` | `engine.py` (app engine + session, `query()`), `readonly.py` (runs SQL from the LLM), `base.py` (ORM base model) |
| `modules/<feature>/` | One module per feature: `router.py` (thin, no SQL), `schemas.py` (Pydantic), logic (`service.py` / domain files), `models.py` + `repository.py` when it stores data |
| `modules/analytics/` | `filters.py` (validated filters), `metrics.py` (every number in SQL), `sections.py`, `forecast.py`, `seed.py` (CSV → `orders`) |
| `modules/ai/` | `llm.py`, `copilot.py`, `builder.py`, `reports.py`, `agents/` (the agent team, see the Agent concept section) |
| `migrations/` | Alembic: `0001` orders (derived columns `month`, `lead_days`, `age_days` as generated columns), `0002` dashboards + schedules (JSONB), `0003` the `analytics_ro` role |

Dependency rule: `core ← db ← analytics ← ai → dashboards`. A module does not import another module's `router.py`/`repository.py`, and `analytics` imports no other module. Adding a feature = a new folder in `modules/` + one line in `MODULES`.

#### Frontend (`frontend/src/`)

| Path | Role |
|---|---|
| `App.tsx` | Shell: sidebar, top bar, filter bar, content + Copilot |
| `app/` | `AppProvider` + `useApp` (filters, undo, section, language, theme, session), `useApi`, `useTheme` |
| `lib/` | API client, shared types, periods, delta |
| `components/` | Shared UI with no feature logic (Card, KpiCard, CalcTrace, FilterBar, DynamicChart, LanguageSwitch, ThemeToggle, …) |
| `features/<feature>/` | One folder per section + `ai/` and `builder/`. A feature does not import another feature |
| `i18n/` | **All UI text**, one file per page/component, every text holding all languages: `title: { id: 'Ringkasan', en: 'Overview' }`. `format.ts` formats numbers/money/dates with `Intl` for the active language |

Components hold no UI text. They call `useMessages(overview)` and then `t('title')`. A missing language or a mistyped key fails the build. To add a language: add it to `Lang` in `i18n/index.ts`, and the compiler points at every text still untranslated. The Light/Dark theme is stored in the browser and initially follows the OS setting.

### Filters

One filter shape is used in the UI, URL, API, Copilot, schedules and presets (`Filters` in `analytics/filters.py`):
- **Period** (order date): `start`/`end` (ISO, inclusive).
- **Choice filters**: a list of values per dimension, empty = all, and `exclude` (the dimensions whose list means "everything except"). The dimensions are `region`, `warehouse`, `carrier`, `client`, `category` (product category), `status` (delivered, delayed, in_transit, exception, canceled), `promo` (`1` promo, `0` regular), `origin` (origin city), `destination` (destination city), `sku`. Each is one column of `orders`; adding a dimension = one line in `DIM_COLS`.
- **Number ranges** (lower and/or upper bound, inclusive): `value` (order value in USD), `quantity`, `lead` (lead time, days), `age` (order age, days), as `value_min`/`value_max` and so on; in JSON: `"ranges": {"value": [10, 50]}`.
- **Arrival date**: `arrived_start`/`arrived_end` (the `delivery_date` column).
- Orders that have not arrived have no lead time or arrival date, so a bound on either one filters them out.
- **The status filter changes the base of the KPI calculation**: with status = delayed, Delivered is 0% and Delay rate is 100%. The calculation is correct; the UI adds a note in the filter title, and the formulas are not changed.

```
GET /api/overview?start=2025-10-01&end=2025-12-31&carrier=UPS&carrier=FedEx&exclude=region&region=EU&category=PAPER&value_min=50&lead_max=7
```

- Parameters are repeated (not comma-separated) because values can contain commas. The old form `?period=Q4&carrier=UPS` is still accepted.
- Every value is checked against the data, dates are parsed, and numbers must be finite (lower bound ≤ upper bound) before reaching SQL; an unknown value → 422. Choice values also have their quotes escaped.
- `GET /api/facets` returns every option with its order count under **the other filters** (its own dimension's filter is ignored), plus the data's date range and the real bounds of each number range (for placeholders).
- **UI:** five main controls (period, region, warehouse, carrier, client) stay in the bar; the "More filters (n)" button opens a panel for the other 11 filters, and every active filter shows as a removable chip. A link that carries advanced filters opens the panel automatically.
- "Another period" comparison: `compare=custom&compare_start=…&compare_end=…` (API) or `?compare=custom&cmp_start=…&cmp_end=…` (page URL); the other filters apply the same to both periods. An incomplete or reversed range counts as not chosen yet.
- "Previous period" comparison: a whole number of calendar months (month, quarter, half, year) shifts back by that many months; any other range shifts back by its own length in days; empty when it falls before the data.
- Presets (`/api/presets`) are shared with all users while the login is still simulated.

### How numbers are computed, and SQL safety

**Numbers are computed in one place, in SQL.** The dashboard, the Copilot and the reports use the same definitions (`modules/analytics/metrics.py`), so the "How this is calculated" panel shows the query that really produced the number on screen, not illustrative text. Definitions:

- **Stuck**: `in_transit` and older than 30 days (as of 30 Dec 2025).
- **Open problem orders**: exception + stuck.
- **Value at risk**: the value of delayed + exception + stuck orders.
- **Lead time**: days from order to arrival, only for orders that have an arrival date. P90 uses linear interpolation (`percentile_cont`).
- **Forecast** (`analytics/forecast.py`): for **orders** (row count) or **units** (`SUM(quantity)`) per month, for all products, one category, or one SKU; the period filter is ignored (it needs the whole series), while the carrier, region, warehouse and client filters are used.
  - **The method is chosen by backtest:** three simple methods compete: a 3-month moving average, simple exponential smoothing (alpha is searched), and a linear trend (OLS, never negative). Each predicts one month ahead for each of the last 6 months, then is compared with what actually happened. The one with the lowest **WAPE** (Σ|error| ÷ Σ actual) is used; on a tie, the simpler one. WAPE was chosen because MAPE blows up in quiet months with numbers this small. "Same as last month" is only a baseline.
  - **Forecast page:** a line chart (actual, dashed forecast, 80% range band) with a method picker; the best method is selected first and marked, but the user can see the other methods' forecasts (the API sends the forecast, range and inventory for each method). The method table shows WAPE and MAE for all three.
  - **80% range:** the spread of the chosen method's backtest errors, widening in proportion to √months, lower bound 0.
  - **SKU:** almost every SKU has just 1 order a year, so it is not forecast on its own: its category's forecast is multiplied by the SKU's share of that category (`basis` carries the share), and the answer says this is a rough estimate.
  - **Inventory recommendation** (units only): `Σ forecast + z × error × √months`, with z = 0.84 / 1.28 / 1.64 for a service level of 80 / 90 / 95% (default 90%). The data has no stock on hand or supplier lead time, so the result is "units that should be available over the horizon", not an order quantity.
  - **Copilot:** the `forecaster` subagent calls `forecast_demand` (chosen by Jev through the `forecast` intent); a carrier, region, warehouse or client the user mentions is used only for that forecast and does not change the dashboard. The line chart (actual, forecast, lower and upper bound) and the formula with numbers come with "How the AI calculated this".

**The AI may not make up numbers.** The model can only read data through `run_sql`/`make_chart`, and every answer returns the SQL that ran together with its formula. Changing the dashboard is done through the `set_filters` tool, validated by the server (filters stack for different dimensions and replace for the same dimension; a warehouse automatically selects its region).

**SQL from the LLM (and dashboard widgets) is guarded in layers** (`db/readonly.py`, migration `0003`):

1. It runs as a separate login, `analytics_ro`: only `SELECT` on `orders` (it cannot read `dashboards`/`schedules`), not a superuser, read-only transaction.
2. It is wrapped as `SELECT * FROM (...) LIMIT %(row_cap)s`, so anything other than a SELECT query becomes a syntax error. The row cap is sent as a parameter, so Postgres rejects more than one statement.
3. Every query runs on a new connection with `SET LOCAL statement_timeout` of 5 seconds, so a `set_config(...)` in one query cannot loosen the next query.

Tested in `backend/tests/db/test_readonly.py`: `DROP`, `COPY ... PROGRAM`, `pg_read_file`, escaping the subquery wrapper, reading `dashboards`, `pg_sleep`, and more.

### Tests

```bash
cd backend && uv run --env-file .env pytest        # migrates + seeds TEST_DATABASE_URL automatically; needs data/mock_logistics_data.csv on your machine
cd frontend && pnpm build && pnpm lint && pnpm test   # tsc + vite, oxlint (react, hooks, a11y), vitest
```

- `tests/analytics/` pins the numbers to the findings of the design document (delay 13.8%, P90 6 days, 26 stuck, 37 problem orders, top-5 clients 47.1%, MAPE 28% vs 34%, etc).
- `tests/db/` tests the guard on LLM SQL against Postgres attack vectors.
- `tests/ai/` tests filter stacking and the Copilot tool loop with a fake model (no API key).
- `frontend/tests/` (vitest, kept apart from the code) tests the agent step logic (`agentSteps`), the Markdown renderer (including safe links and unique keys), the drawn formulas, the chart data helpers and the Copilot width limits. `.oxlintrc.json` turns on the React, hooks and accessibility rules for `pnpm lint`.
- `tests/dashboards/`, `tests/schedules/`, `tests/auth/` test the Builder (dangerous widgets are refused), saved dashboards, schedules and login.

### Deploy

```bash
docker compose up --build -d                  # Postgres + app, data in the `pgdata` volume
# or the image only, with a managed Postgres:
docker build -t spaceship-dashboard .
docker run -p 8000:8000 -v "$(pwd)/data:/app/data:ro" -e DATABASE_URL=... -e DATABASE_URL_READONLY=... -e ANALYTICS_RO_PASSWORD=... \
  -e OPENAI_API_KEY=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e SESSION_SECRET=... spaceship-dashboard
```

The container runs `alembic upgrade head` and the seed on start. The CSV is not inside the image: mount the `data/` folder that holds the CSV (`-v`/`volumes`) for the first start; for a database that is already filled, the CSV is not needed. The `DATABASE_URL` user needs the `CREATEROLE` privilege once, for migration `0003`.

### Current limitations

- The data is a single CSV file (400 orders, Jan–Dec 2025, not stored in the repo) loaded once by the seed; there is no routine import from a source system. The KPI targets and the 7-day SLA are still suggestions.
- Two fixed accounts (admin and visitor) from `.env`; there is no sign-up, password change or 2FA. Stored rows (dashboards, presets) belong to their creator; a visitor can only change and delete their own, an admin everything. Report schedules are admin-only.
- Report schedules are only stored; email is not sent yet (it needs cron + an email provider).
- The forecast comes from 12 months of data with no seasonality: read it as a range. The method chosen most often is the moving average, because the series is nearly flat after the January spike. A SKU forecast is just a share of its category. Without stock and supplier lead-time data, the inventory recommendation is the amount that needs to be available, not an order quantity.
- Rate limits are kept in process memory (one process); if the app runs as several processes or replicas, move them to Redis. Behind a reverse proxy, run uvicorn with `--proxy-headers` so the per-IP limit reads the real client address.
- Login accounts are not created automatically when the container starts; run `auth.seed` once (see the Docker section). The "another period" comparison is not stored in presets (a preset restores it as "previous period").
