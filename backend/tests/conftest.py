"""Shared fixtures. Tests run against TEST_DATABASE_URL (migrated + seeded once per session), never DATABASE_URL.

Run with: uv run --env-file .env pytest
"""
import os
from collections.abc import Iterator
from pathlib import Path

import pytest

if not os.environ.get("TEST_DATABASE_URL"):
    pytest.exit("Set TEST_DATABASE_URL (and TEST_DATABASE_URL_READONLY), e.g. via `uv run --env-file .env pytest`", 2)
# Before any app import: app.core.config reads these at import time.
os.environ["SETTINGS_KEY"] = "kzJ2gYb9n0mQw3rT5uV7xA1cD4eF6hI8jK0lM2oP4qs="  # a Fernet key made for the tests
os.environ["SCRYPT_LOG_N"] = "10"  # cheap password hashes: the suite logs in hundreds of times
os.environ["SESSION_SECRET"] = "pytest-only-session-secret-0123456789-abcdef"  # the app refuses to start without one
os.environ.update(ADMIN_EMAIL="admin@test.local", ADMIN_PASSWORD="admin-test-pw", VISITOR_EMAIL="visitor@test.local", VISITOR_PASSWORD="visitor-test-pw")
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["DATABASE_URL_READONLY"] = os.environ.get("TEST_DATABASE_URL_READONLY", "")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db.engine import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.analytics.seed import seed  # noqa: E402
from app.modules.auth.seed import seed_users  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1]


def pytest_sessionstart(session: pytest.Session) -> None:
    """Before collection: some test modules build Filters at import, which reads valid values from `orders`."""
    cfg = Config(BACKEND / "alembic.ini", attributes={"configure_logger": False})
    command.upgrade(cfg, "head")
    seed()
    seed_users()


@pytest.fixture(autouse=True)
def fresh_rate_limits() -> None:
    from app.core.ratelimit import limiter

    from app.core import aiconfig

    aiconfig.invalidate()  # a test never sees the AI settings another one saved
    limiter.reset()  # every test starts with empty counters, so the many logins of a run never trip a limit


@pytest.fixture(autouse=True)
def no_jev(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests never call Jev: routing falls back to "load everything" and the guardrails are skipped, unless a test passes a fake."""
    monkeypatch.setattr("app.modules.ai.agents.router.TYPESAFE_API_KEY", "")
    monkeypatch.setattr("app.modules.ai.guard.TYPESAFE_API_KEY", "")


@pytest.fixture(autouse=True)
def clean_app_tables() -> Iterator[None]:
    yield
    with engine.begin() as con:
        con.execute(text("TRUNCATE dashboards, schedules, filter_presets, user_facts, kb_docs, guard_events, app_settings RESTART IDENTITY"))


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Logged in as the admin."""
    c = TestClient(app)
    assert c.post("/api/login", json={"email": "admin@test.local", "password": "admin-test-pw"}).status_code == 200
    yield c


@pytest.fixture
def visitor() -> Iterator[TestClient]:
    c = TestClient(app)
    assert c.post("/api/login", json={"email": "visitor@test.local", "password": "visitor-test-pw"}).status_code == 200
    yield c


# ---------- a scripted chat model for the agents (no API key, no network)

from langchain_core.language_models.chat_models import BaseChatModel  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402
from langchain_core.outputs import ChatGeneration, ChatResult  # noqa: E402
from pydantic import Field  # noqa: E402


class FakeChat(BaseChatModel):
    """Replies with the scripted messages in order ("done" when the script runs out) and records the tool names each call saw."""

    script: list = Field(default_factory=list)
    seen: list = Field(default_factory=list)

    @property
    def _llm_type(self) -> str:
        return "fake"

    def bind_tools(self, tools, **kwargs):  # noqa: ANN001, ANN003, ANN201
        self.seen.append(sorted(getattr(t, "name", None) or t.get("name") or t["function"]["name"] for t in tools))
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):  # noqa: ANN001, ANN003, ANN202
        msg = self.script.pop(0) if self.script else AIMessage(content="done")
        return ChatResult(generations=[ChatGeneration(message=msg)])


def call(name: str, args: dict, id: str = "c") -> AIMessage:
    """A model turn that calls one tool."""
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": id}])


@pytest.fixture
def fake_model(monkeypatch: pytest.MonkeyPatch):  # noqa: ANN201
    """`make(script)` -> FakeChat that every agent in the next request runs on."""
    from app.modules.ai import llm
    from app.modules.ai.agents.profile import restrict

    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setattr("app.modules.ai.agents.router.TYPESAFE_API_KEY", "")  # no key: routing falls back to "load everything"
    restrict("fake")  # the same restrictions the real provider gets

    def make(script: list) -> FakeChat:
        model = FakeChat(script=list(script))
        monkeypatch.setattr(llm, "chat_model", lambda name=None: model)
        return model

    return make
