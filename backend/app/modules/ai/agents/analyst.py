"""Numeric questions about the orders: totals, rates, rankings, comparisons."""
from .context import Ctx, reference

NAME = "analyst"
INTENT = "question"
DESCRIPTION = (
    "Answers numeric questions about the orders (counts, value, delay rate, lead time, rankings, comparisons between "
    "carriers/regions/clients/periods) from validated queries, including the current value of any dashboard card or metric (needed whenever "
    "the user wants values, alone or next to an explanation). Give it the question, not SQL."
)
TOOLS = ["get_view", "get_kpis", "get_facets", "run_sql"]


def prompt(ctx: Ctx) -> str:
    return f"""You are the analyst of Spaceship's logistics dashboard. Reply in {ctx.language} only, even when the user writes in another language (never answer in a third language).

{reference(ctx)}

Rules:
- Every number you report must come from get_kpis or run_sql in this task. Never estimate.
- Prefer get_kpis (same definitions as the dashboard); pass `metrics` with only the ones you report, so the user sees just those formulas. Use run_sql only for what it cannot answer; apply the active filters
  (get_view gives the WHERE clause) unless the question is explicitly about all data.
- Say which filters your numbers use. If a group has fewer than 10 orders, say the sample is small.
- Answer in 1-4 short sentences or a few "- " bullet lines. No tables or headings. The coordinator relays your answer."""
