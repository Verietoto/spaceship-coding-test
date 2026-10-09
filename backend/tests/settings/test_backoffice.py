"""Backoffice: the AI provider, key and model saved by an admin, in force at once, never shown back."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core import aiconfig, config, secrets
from app.db.engine import engine
from app.main import app

KEY = "sk-test-0123456789abcdefghijklmnopqrstuvwxyz-ABCD"
BODY = {"provider": "openrouter", "model": "openai/gpt-6-luna", "subagent_model": "openai/gpt-6-mini", "api_key": KEY}


def stored(key: str) -> str | None:
    with engine.connect() as con:
        return con.execute(text("SELECT value FROM app_settings WHERE key = :k"), {"k": key}).scalar()


def test_only_admins_reach_the_backoffice(client: TestClient, visitor: TestClient) -> None:
    for call in (lambda c: c.get("/api/admin/ai"), lambda c: c.put("/api/admin/ai", json=BODY), lambda c: c.post("/api/admin/ai/test", json=BODY), lambda c: c.delete("/api/admin/ai/key")):
        assert call(visitor).status_code == 403
        assert call(TestClient(app)).status_code == 401
    assert client.get("/api/admin/ai").status_code == 200


def test_saving_changes_what_the_app_uses_without_a_restart(client: TestClient) -> None:
    assert client.put("/api/admin/ai", json=BODY).status_code == 200
    now = aiconfig.current()
    assert (now.provider, now.base_url, now.model, now.subagent_model, now.api_key) == ("openrouter", "https://openrouter.ai/api/v1", "openai/gpt-6-luna", "openai/gpt-6-mini", KEY)


def test_the_key_is_stored_encrypted_and_never_returned(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level("DEBUG"):
        saved = client.put("/api/admin/ai", json=BODY)
    raw = stored("ai.api_key")
    assert raw and KEY not in raw and secrets.decrypt(raw) == KEY
    for response in (saved, client.get("/api/admin/ai")):
        assert KEY not in response.text and response.json()["key"] == {"source": "db", "last4": KEY[-4:]}
    assert KEY not in caplog.text and "AI settings changed by" in caplog.text  # logged, but without the key


def test_leaving_the_key_blank_keeps_the_one_in_use(client: TestClient) -> None:
    client.put("/api/admin/ai", json=BODY)
    client.put("/api/admin/ai", json={**BODY, "api_key": "", "model": "other-model"})
    assert aiconfig.current().api_key == KEY and aiconfig.current().model == "other-model"


def test_removing_the_stored_key_falls_back_to_the_environment(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "env-key-9999")
    client.put("/api/admin/ai", json=BODY)
    assert aiconfig.current().api_key == KEY
    view = client.delete("/api/admin/ai/key").json()
    assert aiconfig.current().api_key == "env-key-9999" and view["key"] == {"source": "env", "last4": "9999"}


def test_the_environment_is_the_fallback_when_nothing_is_saved(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "env-key-1234")
    monkeypatch.setattr(config, "OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setattr(config, "OPENAI_MODEL", "env-model")
    cfg = aiconfig.current()
    assert (cfg.provider, cfg.model, cfg.api_key) == ("openrouter", "env-model", "env-key-1234")
    assert repr(cfg).count("env-key-1234") == 0  # the key never shows in a repr


def test_a_key_cannot_be_stored_without_the_encryption_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "SETTINGS_KEY", "")
    assert client.get("/api/admin/ai").json()["secrets_available"] is False
    assert client.put("/api/admin/ai", json=BODY).status_code == 409
    assert stored("ai.api_key") is None
    assert client.put("/api/admin/ai", json={**BODY, "api_key": ""}).status_code == 200  # provider and model need no secret


def test_a_stored_key_that_cannot_be_decrypted_is_ignored(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "env-key-5555")
    client.put("/api/admin/ai", json=BODY)
    monkeypatch.setattr(config, "SETTINGS_KEY", "Zm9yLWEtZGlmZmVyZW50LWtleS1iYXNlNjQtMzItYnl0ZXM=")  # another key
    aiconfig.invalidate()
    assert aiconfig.current().api_key == "env-key-5555"


@pytest.mark.parametrize("bad", [
    {"provider": "azure"}, {"model": ""}, {"model": "has space"}, {"model": "x" * 81}, {"model": "a;b"}, {"subagent_model": "a b"}, {"api_key": "k" * 301},
])
def test_invalid_settings_are_refused(client: TestClient, bad: dict) -> None:
    assert client.put("/api/admin/ai", json={**BODY, **bad}).status_code == 422


def test_the_url_is_a_preset_not_something_an_admin_types(client: TestClient) -> None:
    client.put("/api/admin/ai", json={**BODY, "base_url": "http://169.254.169.254/"})  # an extra field is ignored
    assert aiconfig.current().base_url == "https://openrouter.ai/api/v1"
    assert set(aiconfig.PROVIDERS) == {"openai", "openrouter"}


def test_the_connection_test_reports_ok_or_the_error_without_the_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.modules.settings.service as service

    class Fake:
        def __init__(self, fail: bool) -> None:
            self.responses = self
            self.fail = fail

        def create(self, **kw):  # noqa: ANN003, ANN201
            assert kw["model"] == "openai/gpt-6-luna"
            if self.fail:
                raise RuntimeError(f"401 bad key {KEY}")

    monkeypatch.setattr(service, "OpenAI", lambda **kw: Fake(False))
    assert client.post("/api/admin/ai/test", json=BODY).json() == {"ok": True}
    monkeypatch.setattr(service, "OpenAI", lambda **kw: Fake(True))
    bad = client.post("/api/admin/ai/test", json=BODY).json()
    assert bad["ok"] is False and KEY not in bad["error"] and "RuntimeError" in bad["error"]
    assert stored("ai.model") is None  # testing saves nothing


def test_the_ai_uses_the_saved_key_and_model(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.ai import llm

    client.put("/api/admin/ai", json=BODY)
    chat = llm.chat_model()
    assert chat.model_name == "openai/gpt-6-luna" and chat.openai_api_base == "https://openrouter.ai/api/v1"
    assert chat.openai_api_key.get_secret_value() == KEY
    assert llm.chat_model("explicit").model_name == "explicit"
    seen: dict = {}
    monkeypatch.setattr(llm, "_client", lambda key, base: seen.update(key=key, base=base) or type("C", (), {"responses": type("R", (), {"create": staticmethod(lambda **kw: seen.update(model=kw["model"]) or "r")})})())
    llm.call([], "x")
    assert seen == {"key": KEY, "base": "https://openrouter.ai/api/v1", "model": "openai/gpt-6-luna"}


def test_the_agents_get_the_subagent_model(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.ai import agents

    client.put("/api/admin/ai", json=BODY)
    main, sub = agents._models()
    assert main.model_name == "openai/gpt-6-luna" and sub.model_name == "openai/gpt-6-mini"
    client.put("/api/admin/ai", json={**BODY, "subagent_model": ""})
    assert agents._models()[1] is None


def test_without_a_key_anywhere_the_ai_says_it_is_not_configured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.errors import AINotConfigured, require_ai_key

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(AINotConfigured):
        require_ai_key()
    client.put("/api/admin/ai", json=BODY)
    require_ai_key()  # the backoffice's key is enough


def test_a_database_failure_falls_back_to_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "env-key-0000")

    def boom() -> dict:
        raise RuntimeError("db down")

    monkeypatch.setattr(aiconfig, "_load", boom)
    aiconfig.invalidate()
    assert aiconfig.current().api_key == "env-key-0000"
