"""Which AI provider, key and models the app uses right now.

Settings saved in the backoffice (database) win over the environment, field by field; the environment stays the fallback, so an
app that never uses the backoffice behaves as before. core/ sits below the database layer, so the database lookup is injected
(main.py) the way the session's user lookup is. The lookup is cached for a few seconds and cleared on every save.
"""
import logging
import os
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from . import config

log = logging.getLogger(__name__)

PROVIDERS = {"openai": "", "openrouter": "https://openrouter.ai/api/v1"}  # name -> base URL; fixed, never typed by a user
TTL = 5.0  # seconds a database lookup is reused


@dataclass(frozen=True)
class AIConfig:
    provider: str
    base_url: str
    api_key: str = field(repr=False)  # never in a repr, so never in a log line
    model: str
    subagent_model: str  # empty = the subagents use `model`


Loader = Callable[[], dict[str, str]]  # what the backoffice saved: provider, api_key, model, subagent_model (only the ones set)
_load: Loader | None = None
_cached: tuple[float, dict[str, str]] | None = None


def set_db_loader(loader: Loader) -> None:
    global _load
    _load = loader
    invalidate()


def invalidate() -> None:
    global _cached
    _cached = None


def _stored() -> dict[str, str]:
    global _cached
    if _load is None:
        return {}
    now = time.monotonic()
    if _cached is None or now - _cached[0] > TTL:
        try:
            _cached = (now, _load())
        except Exception:  # noqa: BLE001  the database being down must not take the AI down: fall back to the environment
            log.warning("could not read the AI settings from the database", exc_info=True)
            _cached = (now, {})
    return _cached[1]


def from_env() -> AIConfig:
    base = config.OPENAI_BASE_URL
    provider = "openrouter" if "openrouter.ai" in base else "openai"
    return AIConfig(provider, base, os.environ.get("OPENAI_API_KEY", ""), config.OPENAI_MODEL, config.OPENAI_MODEL_SUBAGENT)


def current() -> AIConfig:
    env, db = from_env(), _stored()
    provider = db.get("provider", env.provider)
    base = PROVIDERS[provider] if "provider" in db else env.base_url
    return AIConfig(provider, base, db.get("api_key") or env.api_key, db.get("model") or env.model, db.get("subagent_model", env.subagent_model))
