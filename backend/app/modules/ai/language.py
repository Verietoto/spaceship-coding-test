"""Which language did the user write in? One Jev question per message, asked alongside the input guard and the routing.

The agent answers in Indonesian or English only: Indonesian when the message is Indonesian, English when it is English or any
other language. When Jev is not sure (or cannot answer, or the message has too few words to tell), the language of the UI
toggle stays, so this step can change a reply's language but never fail a request.
"""
import re
from dataclasses import dataclass
from typing import Any

from langchain_typesafe import Choice

from ...core.config import JEV_THRESHOLD
from . import guard

LANGUAGES = {
    "id": "Indonesian (Bahasa Indonesia), also when it mixes in English technical terms such as 'delay rate' or 'carrier'.",
    "en": "English.",
    "other": "Any other language, such as Japanese, French, Arabic, Javanese or Malay.",
}
WORD = re.compile(r"[^\W\d_]{2,}")  # a run of letters; "UPS", "CL-1004" and numbers alone say nothing about the language


@dataclass(frozen=True)
class Detected:
    detected: str | None  # id | en | other; None = not determined (no Jev, too short, not sure, error)
    confidence: float
    reply: str  # the language the agents answer in: id | en

    def as_dict(self) -> dict[str, Any]:
        return {"detected": self.detected, "confidence": self.confidence, "reply": self.reply}


def _ui(lang: str) -> str:
    return "id" if lang == "id" else "en"


def resolve(message: str, ui_lang: str, client: Any = None) -> Detected:
    fallback = Detected(None, 0.0, _ui(ui_lang))
    words = WORD.findall(message)
    if len(words) < 2 and not any(not w.isascii() for w in words):  # one Latin word says little; Japanese or Arabic text is one "word" but plenty
        return fallback
    client = client or guard._client()  # the same Jev client as the guardrails (None without a key)
    if client is None:
        return fallback
    try:
        question = Choice(instructions="Which language is the user's message written in?", criteria=LANGUAGES)
        choice = client.invoke({"state": {"message": message[:1000]}, "questions": {"language": question}}).choices["language"]
        language, confidence = choice.choice, float(choice.confidence)
    except Exception:  # noqa: BLE001  a failing check never fails the request
        return fallback
    if language not in LANGUAGES or confidence < JEV_THRESHOLD:
        return Detected(None, round(confidence, 2), fallback.reply)
    return Detected(language, round(confidence, 2), "id" if language == "id" else "en")  # other -> English
