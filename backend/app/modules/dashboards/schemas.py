from typing import Any, Literal

from pydantic import BaseModel, Field


MAX_WIDGETS = 24  # a dashboard holds this many widgets at most (each one re-runs its SQL when the dashboard opens)


class Highlight(BaseModel):
    """Draw the `n` bars with the highest (top) or lowest (bottom) value in a different color."""

    mode: Literal["top", "bottom"]
    n: int = Field(ge=1, le=5)


class Widget(BaseModel):
    kind: Literal["kpi", "chart"]
    title: str = Field(max_length=120)
    sql: str = Field(max_length=4000)
    formulas: list[str] = []
    format: Literal["number", "usd", "pct", "days"] | None = None
    chart_type: Literal["bar", "line", "pie", "table"] | None = None
    x: str | None = None
    y: list[str] = Field(default=[], max_length=4)
    highlight: Highlight | None = None  # bar charts with one series only
    span: int | None = Field(default=None, ge=1, le=12)  # columns of 12 the widget takes; None = a KPI a third of a row, a chart a whole row


class FilterSpec(BaseModel):
    """A filter the dashboard offers its viewers, with what it starts on."""

    key: Literal[
        "period", "arrived", "region", "warehouse", "carrier", "client", "category", "status", "promo", "origin", "destination", "sku",
        "value", "quantity", "lead", "age",
    ]
    default: list[str] = Field(default=[], max_length=400)  # a value filter: the values selected at first (empty = all)
    start: str | None = Field(default=None, max_length=10)  # period or arrived: the date range selected at first (YYYY-MM-DD)
    end: str | None = Field(default=None, max_length=10)
    min: float | None = None  # a number filter (value, quantity, lead, age): the bounds selected at first
    max: float | None = None


class DashboardIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    plan: list[str] = Field(default=[], max_length=6)
    widgets: list[Widget] = Field(min_length=1, max_length=MAX_WIDGETS)
    filters: list[FilterSpec] = Field(default=[], max_length=5)


class PreviewIn(DashboardIn):
    """A draft (or a proposed change) rendered with the viewer's filter values; None = the dashboard's own defaults."""

    values: dict[str, Any] | None = None
