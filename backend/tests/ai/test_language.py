"""Jev reads the language of each message: the agents answer in Indonesian or English, never anything else."""
import json
from types import SimpleNamespace as NS

import pytest
from langchain_core.messages import AIMessage

from app.modules.ai import agents, clarify, guard, language
from app.modules.ai import copilot as ai
from app.modules.analytics import filters as af
from tests.ai.test_guard import FakeJev, Broken


class Lang:
    """A Jev that only answers the language question."""

    def __init__(self, choice: str, confidence: float = 0.95) -> None:
        self.choice, self.confidence, self.asked = choice, confidence, []

    def invoke(self, payload: dict) -> NS:
        self.asked.append(payload)
        return NS(choices={"language": NS(choice=self.choice, confidence=self.confidence)}, nouls={})


@pytest.mark.parametrize(("choice", "ui", "reply"), [
    ("id", "en", "id"),  # an Indonesian message is answered in Indonesian, whatever the UI toggle says
    ("en", "id", "en"),
    ("other", "id", "en"),  # any other language is routed to English
    ("other", "en", "en"),
])
def test_the_message_decides_the_language_of_the_answer(choice: str, ui: str, reply: str) -> None:
    got = language.resolve("carrier mana yang paling sering terlambat", ui, Lang(choice))
    assert (got.detected, got.reply) == (choice, reply)


def test_jev_is_asked_the_message_and_three_choices() -> None:
    jev = Lang("en")
    language.resolve("which carrier is late most often", "id", jev)
    [asked] = jev.asked
    assert asked["state"] == {"message": "which carrier is late most often"} and set(asked["questions"]) == {"language"}
    assert set(asked["questions"]["language"].criteria) == {"id", "en", "other"}


@pytest.mark.parametrize("ui", ["id", "en"])
def test_when_jev_is_not_sure_the_ui_language_stays(ui: str) -> None:
    got = language.resolve("kirim data please maybe", ui, Lang("en", 0.4))
    assert got.detected is None and got.reply == ui and got.confidence == 0.4


def test_a_failing_or_missing_jev_never_fails_the_request() -> None:
    assert language.resolve("which carrier is late", "id", Broken()).reply == "id"
    assert language.resolve("which carrier is late", "en").reply == "en"  # no client at all (the test suite has no key)
    assert language.resolve("which carrier is late", "fr").reply == "en"  # an unknown UI language is English


@pytest.mark.parametrize("message", ["UPS", "CL-1004", "12345", "ok", "?", "A-1 B-2", ""])
def test_a_message_without_words_is_not_worth_a_call(message: str) -> None:
    jev = Lang("other")
    assert language.resolve(message, "id", jev).reply == "id" and jev.asked == []


@pytest.mark.parametrize("message", ["どのキャリアが一番遅いですか", "ما هو أبطأ ناقل", "哪个承运商最慢"])
def test_text_in_a_script_without_spaces_is_still_judged(message: str) -> None:
    jev = Lang("other")
    assert language.resolve(message, "id", jev).reply == "en" and len(jev.asked) == 1


# ---------- in the copilot

def run(monkeypatch: pytest.MonkeyPatch, fake_model, jev: FakeJev, message: str, ui: str) -> tuple[dict, list]:  # noqa: ANN001
    monkeypatch.setattr(guard, "_client", lambda: jev)
    seen: list = []
    build = agents.build_copilot
    monkeypatch.setattr(agents, "build_copilot", lambda turn, ctx, route: (seen.append(ctx.lang), build(turn, ctx, route))[1])
    return ai.copilot(message, [], af.Filters(), "prev", ui), seen


def test_the_agents_get_the_detected_language(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="ok")])
    out, seen = run(monkeypatch, fake_model, FakeJev(language="id", language_confidence=0.9), "carrier mana yang paling telat", "en")
    assert seen == ["id"] and out["route"]["language"] == {"detected": "id", "confidence": 0.9, "reply": "id"}


def test_another_language_is_answered_in_english(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="ok")])
    out, seen = run(monkeypatch, fake_model, FakeJev(language="other", language_confidence=0.9), "どのキャリアが一番遅いですか", "id")
    assert seen == ["en"] and out["route"]["language"]["detected"] == "other" and out["route"]["language"]["reply"] == "en"


def test_without_a_confident_answer_the_ui_language_is_used(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="ok")])
    out, seen = run(monkeypatch, fake_model, FakeJev(), "which carrier is late", "id")  # Jev "not sure"
    assert seen == ["id"] and out["route"]["language"]["detected"] is None


def test_a_refusal_is_in_the_language_of_the_message(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    model = fake_model([AIMessage(content="ok")])
    jev = FakeJev("off_topic", 0.95, language="other", language_confidence=0.9)
    monkeypatch.setattr(guard, "_client", lambda: jev)
    out = ai.copilot("日本の首相は誰ですか", [], af.Filters(), "prev", "id")  # UI Indonesian, message Japanese
    assert out["answer"] == guard.SCOPE_REPLY["en"] and model.seen == []
    assert {"topic", "language"} <= {k for a in jev.asked for k in a["questions"]}  # both were asked of Jev


def test_the_stream_reports_the_language_in_the_route(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="ok")])
    monkeypatch.setattr(guard, "_client", lambda: FakeJev(language="id", language_confidence=0.9))
    events = list(ai.run_copilot("carrier mana yang paling telat", [], af.Filters(), "prev", "en"))
    route = next(e for e in events if e["type"] == "route")
    assert route["language"]["reply"] == "id" and json.dumps(route)  # serialisable for the NDJSON stream


# ---------- in the builder

def asked_in(monkeypatch: pytest.MonkeyPatch, jev: Lang, prompt: str, ui: str) -> str:
    seen: list = []

    class Spy:
        def invoke(self, messages: list) -> AIMessage:
            seen.append(messages[0].content)
            return AIMessage(content='{"ready": true}')

    monkeypatch.setattr(guard, "_client", lambda: jev)
    monkeypatch.setattr("app.modules.ai.llm.chat_model", lambda name=None: Spy())
    monkeypatch.setattr(clarify, "_jev", lambda: None)
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    clarify.clarify(prompt, [], ui)
    return seen[0]


def test_the_builder_question_follows_the_language_of_the_request(monkeypatch: pytest.MonkeyPatch) -> None:
    assert "Indonesian" in asked_in(monkeypatch, Lang("id"), "buatkan dashboard performa carrier", "en")
    system = asked_in(monkeypatch, Lang("other"), "créez un tableau de bord des transporteurs", "id")
    assert "Write in English" in system and "Indonesian" not in system.split("Write in")[1][:40]


def test_every_prompt_tells_the_model_to_stay_in_the_chosen_language_even_if_the_user_does_not() -> None:
    """A French question detected as 'other' is answered in English: the model must not just mirror the user."""
    from app.modules.ai.agents import analyst, builder, charter
    from app.modules.ai.agents.context import Ctx

    ctx = Ctx(af.Filters(), "prev", "en")
    for text in (analyst.prompt(ctx), charter.prompt(ctx), builder.prompt(ctx), agents.coordinator_prompt(ctx, agents.Route(subagents=(), tools=()))):
        assert "only, even when" in text and "English" in text


def test_a_message_in_a_third_language_is_sent_with_a_reminder_to_answer_in_english(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="ok")])
    sent: list = []
    stream = agents.stream
    monkeypatch.setattr(agents, "stream", lambda agent, messages: (sent.append(messages), stream(agent, messages))[1])
    guarded: list = []
    monkeypatch.setattr(guard, "check_input", lambda message, *a, **k: (guarded.append(message), guard.Verdict("input", "allow", "dashboard", {}))[1])
    monkeypatch.setattr(guard, "_client", lambda: FakeJev(language="other", language_confidence=0.9))
    ai.copilot("Quel transporteur est le plus lent ?", [], af.Filters(), "prev", "id")
    assert sent[0][-1] == ("user", "Quel transporteur est le plus lent ?\n\n(Answer in English only.)")
    assert guarded == ["Quel transporteur est le plus lent ?"]  # the guard still reads what the user wrote


def test_indonesian_and_english_messages_are_sent_as_written(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="ok")])
    sent: list = []
    stream = agents.stream
    monkeypatch.setattr(agents, "stream", lambda agent, messages: (sent.append(messages), stream(agent, messages))[1])
    monkeypatch.setattr(guard, "_client", lambda: FakeJev(language="id", language_confidence=0.9))
    ai.copilot("carrier mana yang paling telat", [], af.Filters(), "prev", "en")
    assert sent[0][-1] == ("user", "carrier mana yang paling telat")
