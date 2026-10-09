"""Every environment variable and filesystem path the backend reads, in one place."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # repo root: backend/app/core/config.py -> ../../../

DATA_CSV = Path(os.environ.get("DATA_CSV", ROOT / "data" / "mock_logistics_data.csv"))

# App user: owns the schema, runs migrations and every query the backend writes itself.
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://spaceship:spaceship@localhost:5432/spaceship")
# Read-only login (created by migration 0003): SELECT on `orders` only. Runs all SQL written by the LLM or saved in widgets.
ANALYTICS_RO_PASSWORD = os.environ.get("ANALYTICS_RO_PASSWORD", "analytics_ro")
DATABASE_URL_READONLY = os.environ.get(
    "DATABASE_URL_READONLY", f"postgresql+psycopg://analytics_ro:{ANALYTICS_RO_PASSWORD}@localhost:5432/spaceship"
)
DIST = ROOT / "frontend" / "dist"

# Accounts created by `python -m app.modules.auth.seed`; one whose email or password is empty is skipped.
ACCOUNTS = [
    ("admin", os.environ.get("ADMIN_EMAIL", ""), os.environ.get("ADMIN_PASSWORD", "")),
    ("visitor", os.environ.get("VISITOR_EMAIL", ""), os.environ.get("VISITOR_PASSWORD", "")),
]
SESSION_SECRET = os.environ.get("SESSION_SECRET", "")  # no default: the app refuses to start without a real one (core/security.py)
SESSION_HOURS = int(os.environ.get("SESSION_HOURS", "8"))  # how long a login lasts

# Rate limits (core/ratelimit.py). Logins: attempts per IP per minute, and wrong passwords per email per 15 minutes before it
# is locked for the rest of the window. AI: requests per user per minute / hour and how many may run at once. Dashboards:
# saves per hour and opens per minute (opening runs the widgets' SQL).
SCRYPT_LOG_N = int(os.environ.get("SCRYPT_LOG_N", "15"))  # password hash cost, as a power of two (tests lower it to stay fast)
LOGIN_IP_PER_MINUTE = int(os.environ.get("LOGIN_IP_PER_MINUTE", "20"))
LOGIN_MAX_FAILURES = int(os.environ.get("LOGIN_MAX_FAILURES", "5"))
AI_PER_MINUTE = int(os.environ.get("AI_PER_MINUTE", "10"))
AI_PER_HOUR = int(os.environ.get("AI_PER_HOUR", "100"))
AI_CONCURRENT = int(os.environ.get("AI_CONCURRENT", "2"))
DASH_SAVES_PER_HOUR = int(os.environ.get("DASH_SAVES_PER_HOUR", "20"))
DASH_OPENS_PER_MINUTE = int(os.environ.get("DASH_OPENS_PER_MINUTE", "60"))
SECURE_COOKIES = os.environ.get("SECURE_COOKIES") == "1"
# Browser origins besides the server's own host that may write (core/web.py). The defaults are the Vite dev server, whose proxy
# rewrites Host; in production the app serves the page itself, so nothing else is needed.
ALLOWED_ORIGINS = tuple(o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip())
ENABLE_DOCS = os.environ.get("ENABLE_DOCS") == "1"  # /docs, /redoc and /openapi.json (the whole API map) are off unless asked for

# Fernet key that encrypts what the backoffice stores (the AI key). Without it the key can only come from OPENAI_API_KEY.
SETTINGS_KEY = os.environ.get("SETTINGS_KEY", "")

OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "")  # any OpenAI-compatible API, e.g. https://openrouter.ai/api/v1; empty = OpenAI
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-luna")
OPENAI_MODEL_SUBAGENT = os.environ.get("OPENAI_MODEL_SUBAGENT", "")  # empty = subagents use OPENAI_MODEL

# Jev (TypeSafe) routes each Copilot request to the tools/subagents it needs. No key = no routing: everything is loaded.
TYPESAFE_API_KEY = os.environ.get("TYPESAFE_API_KEY", "")
JEV_THRESHOLD = float(os.environ.get("JEV_THRESHOLD", "0.6"))
JEV_TIMEOUT_MS = int(os.environ.get("JEV_TIMEOUT_MS", "1000"))
# Guardrails (also Jev): confidence needed to block, and a lower one for "off topic" so an ambiguous dashboard question still goes through.
GUARD_THRESHOLD = float(os.environ.get("GUARD_THRESHOLD", "0.7"))
GUARD_OFFTOPIC_THRESHOLD = float(os.environ.get("GUARD_OFFTOPIC_THRESHOLD", "0.6"))
