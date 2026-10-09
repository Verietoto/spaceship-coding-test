"""Maps AI failures to HTTP errors the UI can show."""
from collections.abc import Callable, Iterable, Iterator
from typing import Any

import openai
from fastapi import HTTPException

from . import aiconfig


class AINotConfigured(RuntimeError):
    pass


NOT_CONFIGURED = "AI is not configured (no API key: set it in the Backoffice, or OPENAI_API_KEY)"


def require_ai_key() -> None:
    if not aiconfig.current().api_key:
        raise AINotConfigured(NOT_CONFIGURED)


def run_ai[T](fn: Callable[..., T], *args: Any) -> T:
    try:
        return fn(*args)
    except AINotConfigured as e:
        raise HTTPException(503, NOT_CONFIGURED) from e
    except openai.OpenAIError as e:
        raise HTTPException(502, f"AI provider error: {type(e).__name__}") from e
    except ValueError as e:  # model returned something unusable
        raise HTTPException(502, str(e)) from e


def stream_ai(events: Iterable[dict]) -> Iterator[dict]:
    """`run_ai` for a stream: the status line is already sent, so a failure becomes a last {"type": "error"} event."""
    try:
        yield from events
    except AINotConfigured:
        yield {"type": "error", "status": 503, "message": NOT_CONFIGURED}
    except openai.OpenAIError as e:
        yield {"type": "error", "status": 502, "message": f"AI provider error: {type(e).__name__}"}
    except ValueError as e:
        yield {"type": "error", "status": 502, "message": str(e)}
