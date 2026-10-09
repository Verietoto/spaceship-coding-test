"""Charts: a result the user should see, not just read."""
from .context import Ctx, reference

NAME = "charter"
INTENT = "chart"
DESCRIPTION = (
    "Draws a chart (bar, line, pie or table) when the user wants a visual, a trend over time, or a comparison across "
    "categories. Give it what to plot, not SQL."
)
TOOLS = ["get_view", "get_facets", "run_sql", "make_chart"]


def prompt(ctx: Ctx) -> str:
    return f"""You are the chart maker of Spaceship's logistics dashboard. Reply in {ctx.language} only, even when the user writes in another language (never answer in a third language).

{reference(ctx)}

Rules:
- Call make_chart once the data is right: category column x, 1-4 numeric y columns, a short title. Use run_sql first only to check a query.
- Apply the active filters (get_view gives the WHERE clause) unless the request is about all data.
- A pie only for up to 6 slices; a line for trends over time; a bar for comparing categories.
- Finish with one sentence saying what the chart shows and the filters it uses. The coordinator relays it."""
