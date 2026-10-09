"""The AI settings kept in the backoffice: what is stored, what is in force, saving, and testing a candidate."""
import logging

from fastapi import HTTPException
from openai import OpenAI

from ...core import aiconfig, secrets
from . import repository
from .schemas import AiIn

log = logging.getLogger(__name__)
PREFIX = "ai."


def ai_overrides() -> dict[str, str]:
    """What the backoffice saved, ready for core.aiconfig (the key decrypted; unreadable means ignored)."""
    out: dict[str, str] = {}
    for key, row in repository.get_all(PREFIX).items():
        name, value = key.removeprefix(PREFIX), row["value"]
        if name == "api_key":
            try:
                value = secrets.decrypt(value) or ""
            except secrets.SecretsUnavailable:
                value = ""
            if not value:
                log.warning("the stored AI key cannot be read (SETTINGS_KEY missing or changed): using the environment's")
                continue
        out[name] = value
    return out


def ai_view() -> dict:
    """What the form shows: the settings in force, where the key comes from, and its last four characters. Never the key."""
    cfg = aiconfig.current()
    stored = repository.get_all(PREFIX)
    from_db = bool(ai_overrides().get("api_key"))
    last = max(stored.values(), key=lambda r: r["updated_at"], default=None)
    return {
        "providers": list(aiconfig.PROVIDERS),
        "secrets_available": secrets.available(),
        "provider": cfg.provider,
        "model": cfg.model,
        "subagent_model": cfg.subagent_model,
        "key": {"source": "db" if from_db else "env" if cfg.api_key else "none", "last4": cfg.api_key[-4:] if cfg.api_key else None},
        "updated_by": last and last["updated_by"],
        "updated_at": last and last["updated_at"],
    }


def save_ai(body: AiIn, user: str) -> dict:
    values = {PREFIX + "provider": body.provider, PREFIX + "model": body.model, PREFIX + "subagent_model": body.subagent_model}
    if body.api_key:
        try:
            values[PREFIX + "api_key"] = secrets.encrypt(body.api_key)
        except secrets.SecretsUnavailable as e:
            raise HTTPException(409, "SETTINGS_KEY is not set on the server, so a key cannot be stored. Set OPENAI_API_KEY instead.") from e
    repository.set_many(values, user)
    aiconfig.invalidate()
    log.info("AI settings changed by %s: provider=%s model=%s key=%s", user, body.provider, body.model, "replaced" if body.api_key else "kept")
    return ai_view()


def clear_key(user: str) -> dict:
    repository.delete_keys([PREFIX + "api_key"])
    aiconfig.invalidate()
    log.info("stored AI key removed by %s", user)
    return ai_view()


def test_ai(body: AiIn) -> dict:
    """One tiny request with the candidate settings (the key in use when none is given). Never echoes the key."""
    key = body.api_key or aiconfig.current().api_key
    if not key:
        return {"ok": False, "error": "no API key"}
    client = OpenAI(api_key=key, base_url=aiconfig.PROVIDERS[body.provider] or None, timeout=20, max_retries=0)
    try:
        client.responses.create(model=body.model, input="Reply with: ok", max_output_tokens=16)
    except Exception as e:  # noqa: BLE001  whatever the provider says goes back to the admin who is setting it up
        return {"ok": False, "error": f"{type(e).__name__}: {e}"[:300].replace(key, "<key>")}
    return {"ok": True}
