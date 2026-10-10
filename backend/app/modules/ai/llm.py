"""OpenAI Responses API access and what every AI feature shares (schema prompt, tool definition helper).

The model never invents numbers: it reads data only through tools that run validated read-only SQL, and every
answer returns the exact queries it ran so the UI can show "how the AI calculated this".
"""
from functools import lru_cache
from typing import Any, get_args

from langchain_openai import ChatOpenAI
from openai import OpenAI

from ...core import aiconfig
from ...core.errors import require_ai_key
from ..dashboards.schemas import ChartType

CHART_TYPES = list(get_args(ChartType))


def chat_model(name: str | None = None) -> ChatOpenAI:
    """The chat model the agents run on (a LangChain model, unlike `client()` which the one-shot calls use)."""
    require_ai_key()
    cfg = aiconfig.current()
    return ChatOpenAI(model=name or cfg.model, base_url=cfg.base_url or None, api_key=cfg.api_key)


@lru_cache(maxsize=4)
def _client(api_key: str, base_url: str) -> OpenAI:
    return OpenAI(api_key=api_key, base_url=base_url or None)


def client() -> OpenAI:
    """The one-shot client for the settings in force now (a new key or provider from the backoffice gets its own client)."""
    require_ai_key()
    cfg = aiconfig.current()
    return _client(cfg.api_key, cfg.base_url)


SCHEMA = """Table `orders` (PostgreSQL), one row per order, Jan-Dec 2025:
  client_id, order_id, order_date DATE, delivery_date DATE (NULL = not arrived), carrier, origin_city,
  destination_city, status ('delivered','delayed','in_transit','exception','canceled'), sku, product_category,
  quantity, unit_price_usd, order_value_usd (gross, promo discount NOT deducted), is_promo (0/1),
  promo_discount_pct, region, warehouse,
  month INT (1-12, from order_date), lead_days INT (delivery_date - order_date, NULL if not arrived),
  age_days INT (days from order_date to 2025-12-30, the data's "today").
Definitions used everywhere in the dashboard:
  stuck (macet) = status = 'in_transit' AND age_days > 30
  open problem (bermasalah berjalan) = exception OR stuck
  value at risk (nilai terdampak) = order_value_usd of delayed + exception + stuck
  delay rate = share of orders with status 'delayed'; delivered rate likewise
  lead time P90 = percentile_cont(0.9) WITHIN GROUP (ORDER BY lead_days); over-SLA = lead_days > 7 among arrived orders
Proposed targets: delay <= 10%, delivered >= 90%, P90 <= 7 days (SLA), over-SLA <= 5%.
Sample sizes are small: under 10 orders is a small sample, under 5 is not conclusive."""


def call(input_items: list, instructions: str, tools: list | None = None, tool_choice: dict | None = None) -> Any:
    kwargs: dict[str, Any] = {"model": aiconfig.current().model, "instructions": instructions, "input": input_items}
    if tools:
        kwargs["tools"] = tools
    if tool_choice:
        kwargs["tool_choice"] = tool_choice
    return client().responses.create(**kwargs)
