"""The agent tools as LangChain tools, each a thin typed wrapper over `run_tool` for one Turn.

Which agent may call which tool is decided in the agent files (coordinator: copilot.py / __init__.py; subagents:
analyst.py, charter.py, builder.py), never here. Every SQL tool goes through db/readonly.run_readonly.
"""
import json
from typing import Literal

from langchain_core.tools import BaseTool, tool
from pydantic import BaseModel, Field

from ...dashboards.schemas import ChartType, FilterSpec, Highlight
from .turn import SECTIONS, Turn, run_tool

Compare = Literal["prev", "base", "none"]
Dim = Literal["region", "warehouse", "carrier", "client", "category", "status", "promo", "origin", "destination", "sku"]
Group = Literal["region", "warehouse", "carrier", "client", "category", "status", "promo", "origin", "destination"]  # what get_kpis can group by (not SKU: 355 rows)
Range = Literal["value", "quantity", "lead", "age", "arrived"]
Metric = Literal["orders", "value", "delivered", "delay", "ontime", "mean", "p90", "over7", "stuck", "exc", "atrisk"]


class WidgetSpec(BaseModel):
    kind: Literal["kpi", "chart"]
    title: str
    sql: str  # read-only SELECT; a kpi returns exactly one row with one numeric column
    formulas: list[str] = Field(description="The math behind each number, as a definition WITHOUT numbers (the data is recomputed on every open), e.g. 'delay rate = delayed orders ÷ all orders'. Math, never SQL.")
    format: Literal["number", "usd", "pct", "days"] | None = None  # kpi value format
    chart_type: ChartType | None = None
    x: str | None = None
    y: list[str] | None = Field(default=None, description="Numeric columns to plot (at most 8). With `series`, just one: the value column.")
    series: str | None = Field(default=None, description="Long format: the column whose values become the series (SQL returns x, series, y rather than one column per series). Use it for more than 4 series or when the series are data values such as regions.")
    y_line: list[str] | None = Field(default=None, description="combo only: numeric columns drawn as lines on the right axis (y are the bars).")
    size: str | None = Field(default=None, description="scatter only: numeric column that sizes each point (a bubble chart).")
    target: float | None = Field(default=None, description="A goal. On a chart: a dashed reference line at this value (y axis; the x axis for hbar). On a kpi: the value is judged against it (progress bar, green when met).")
    better: Literal["high", "low"] | None = Field(default=None, description="kpi with a target: is a higher (high, default) or a lower (low, e.g. delay rate) value better.")
    span: int | None = Field(default=None, description="Layout, only when the user asks for one: how many of the 12 columns of a row the widget takes. 12 = a whole row, 6 = half, 4 = a third (three side by side), 3 = a quarter. Widgets fill rows left to right in the order you list them, so side-by-side widgets must be listed one after the other. Charts need at least 4. Omit it otherwise (a KPI then takes 4, a chart 12).")
    highlight: Highlight | None = Field(default=None, description="Only when the user asks to mark the best or worst bars ('top 3', 'worst 2'): the n bars with the highest (top) or lowest (bottom) value get a different color. Bar charts with ONE y column only. Omit otherwise.")


def make_tools(turn: Turn) -> dict[str, BaseTool]:
    def call(name: str, **args: object) -> str:
        return json.dumps(run_tool(turn, name, {k: v for k, v in args.items() if v is not None}), default=str)

    @tool(parse_docstring=True)
    def set_filters(
        period: str | None = None,
        year: int | None = None,
        start: str | None = None,
        end: str | None = None,
        region: list[str] | None = None,
        warehouse: list[str] | None = None,
        carrier: list[str] | None = None,
        client: list[str] | None = None,
        category: list[str] | None = None,
        status: list[str] | None = None,
        promo: list[str] | None = None,
        origin: list[str] | None = None,
        destination: list[str] | None = None,
        sku: list[str] | None = None,
        value_min: float | None = None,
        value_max: float | None = None,
        quantity_min: float | None = None,
        quantity_max: float | None = None,
        lead_min: float | None = None,
        lead_max: float | None = None,
        age_min: float | None = None,
        age_max: float | None = None,
        arrived_start: str | None = None,
        arrived_end: str | None = None,
        clear_ranges: list[Range] | None = None,
        exclude: list[Dim] | None = None,
        compare: Compare | None = None,
        reset: bool = False,
    ) -> str:
        """Change the dashboard filters the user sees. Dimensions you pass replace their old values; the rest stay.

        Args:
            period: Preset FY, H1, H2, Q1-Q4, M1-M12, or "all" to clear the date range.
            year: Year of the preset; defaults to the latest year in the data.
            start: Range start, YYYY-MM-DD (overrides the preset).
            end: Range end, YYYY-MM-DD, inclusive.
            region: Region codes; an empty list clears the dimension.
            warehouse: Warehouse codes; an empty list clears the dimension.
            carrier: Carrier names; an empty list clears the dimension.
            client: Client ids like CL-1004; an empty list clears the dimension.
            category: Product categories (see the valid values); an empty list clears it.
            status: Order statuses: delivered, delayed, in_transit, exception, canceled.
            promo: "1" for promo orders, "0" for regular ones.
            origin: Origin cities, exactly as listed (e.g. "London, UK").
            destination: Destination cities, exactly as listed.
            sku: SKUs like CRAYON-0017.
            value_min: Lowest order value in USD (inclusive). value_max is the highest.
            quantity_min: Lowest quantity ordered (inclusive). quantity_max is the highest.
            lead_min: Lowest lead time in days (inclusive; only arrived orders have one). lead_max is the highest.
            age_min: Lowest order age in days (inclusive). age_max is the highest.
            arrived_start: Earliest arrival date, YYYY-MM-DD. arrived_end is the latest (only arrived orders have one).
            clear_ranges: Number ranges (value, quantity, lead, age) or the arrival dates (arrived) to clear.
            exclude: Dimensions whose list means everything EXCEPT those values.
            compare: Comparison for the KPIs: prev, base or none.
            reset: Start from the default filters before applying the rest.
        """
        return call("set_filters", period=period, year=year, start=start, end=end, region=region, warehouse=warehouse,
                    carrier=carrier, client=client, category=category, status=status, promo=promo, origin=origin, destination=destination, sku=sku,
                    value_min=value_min, value_max=value_max, quantity_min=quantity_min, quantity_max=quantity_max, lead_min=lead_min,
                    lead_max=lead_max, age_min=age_min, age_max=age_max, arrived_start=arrived_start, arrived_end=arrived_end,
                    clear_ranges=clear_ranges, exclude=exclude, compare=compare, reset=reset)

    @tool(parse_docstring=True)
    def remember(text: str) -> str:
        """Save one short fact about the user so future answers fit them. Only when the user explicitly asks to remember something.

        Args:
            text: The fact in one sentence, in the user's words (e.g. "I watch clients CL-1004 and CL-1002").
        """
        return call("remember", text=text)

    @tool(parse_docstring=True)
    def search_kb(query: str) -> str:
        """Search the team's knowledge base (SLA terms, carrier agreements, KPI definitions, notes on the dashboard's author). Returns matching passages with their document titles.

        Args:
            query: A few keywords, not a full sentence.
        """
        return call("search_kb", query=query)

    @tool(parse_docstring=True)
    def open_section(section: Literal["overview", "delivery", "clients", "risk", "forecast", "quality", "reports"]) -> str:
        """Open a dashboard section for the user.

        Args:
            section: The section to show.
        """
        assert section in SECTIONS
        return call("open_section", section=section)

    @tool
    def get_view() -> str:
        """Read the dashboard's current filters, compare mode, SQL WHERE clause, order count and the data's date range."""
        return call("get_view")

    @tool(parse_docstring=True)
    def get_kpis(by: Group | None = None, metrics: list[Metric] | None = None) -> str:
        """Standard KPIs for the active filters, computed exactly as the dashboard does (no SQL needed).

        Result keys: n orders, val order value USD, aov, deliv delivered %, delay delay %, ontime on-time % (delivered ÷ delivered+delayed), delay_n delayed orders, lead_n
        orders with an arrival date, mean/p50/p90 lead days, over7 % of arrived orders over 7 days, stuck, exc exception
        orders, open open problem orders, prob_n/prob_val problem orders and their value (value at risk), deliv_n delivered orders,
        over7_n arrived orders over 7 days.

        Args:
            by: Optionally one row per region, warehouse, carrier, client, category, status, promo, origin or destination instead of a single total.
            metrics: Which metrics you will report (default: all), so the "how this was calculated" shows only their formulas.
        """
        return call("get_kpis", by=by, metrics=metrics)

    @tool
    def get_facets() -> str:
        """List each filter dimension's valid values with its order count under the other active filters, plus the data's date range."""
        return call("get_facets")

    @tool(parse_docstring=True)
    def run_sql(sql: str, formulas: list[str]) -> str:
        """Run one read-only PostgreSQL SELECT over `orders` (max 500 rows). Use it for anything get_kpis cannot answer.

        Args:
            sql: A single SELECT statement. Apply the active filters (see get_view) in the WHERE clause unless the question is about all data.
            formulas: The math behind each number as a definition WITHOUT numbers (you have not seen the result yet), e.g. "delay rate = delayed orders ÷ all orders". Math, never SQL. At most 2 short lines, in the user's language, no repeats.
        """
        return call("run_sql", sql=sql, formulas=formulas)

    @tool(parse_docstring=True)
    def make_chart(sql: str, formulas: list[str], type: ChartType, x: str, y: list[str], title: str, series: str | None = None, y_line: list[str] | None = None, target: float | None = None, size: str | None = None) -> str:
        """Run a read-only SELECT and show its result to the user as a chart.

        Args:
            sql: A single SELECT statement.
            formulas: The math behind the charted values as a definition (numbers only if you already saw them in an earlier query), e.g. "delay rate = delayed orders ÷ all orders". Math, never SQL. At most 2 short lines, in the user's language, no repeats.
            type: bar, hbar (horizontal bars: rankings, long labels), stacked_bar, area, line, combo (y as bars plus y_line as lines on the right axis), histogram (x = bin label, y = count), pie, table, heatmap (two dimensions: x = rows, series = columns, y = [value]), scatter (x and y numeric; series colors the points, size makes bubbles), funnel (ordered stages), treemap (parts of a whole, many items), radar (x = axes, y = measures) or sankey (flows: x = from, series = to, y = [amount]).
            x: Column for categories / the x axis.
            y: Numeric column(s) to plot, at most 8. With `series`, only the value column.
            title: Chart title.
            series: Long format: the column whose values become the series (SQL returns x, series, y). Use it for more than 4 series or when the series are values such as regions.
            y_line: combo only: numeric columns drawn as lines on the right axis.
            target: A goal drawn as a dashed reference line.
            size: scatter only: numeric column that sizes each point.
        """
        return call("make_chart", sql=sql, formulas=formulas, type=type, x=x, y=y, title=title, series=series, y_line=y_line, target=target, size=size)

    @tool(parse_docstring=True)
    def create_dashboard(title: str, plan: list[str], widgets: list[WidgetSpec], filters: list[FilterSpec] | None = None) -> str:
        """Create the dashboard draft: every widget's SQL is run and any that fail are reported back so you can fix them and call again.

        Args:
            title: Dashboard title.
            plan: 3-5 short steps describing what the dashboard covers.
            widgets: At most 24. Usually 3-4 kpi widgets (one row, one numeric column each) then 1-3 chart widgets (category column x, numeric y); a table is a chart widget with chart_type table. A widget that should follow the filters writes {{WHERE}} in its WHERE clause. When the user asks for a layout, set `span` on the widgets (see its description) and order the list so that widgets sharing a row come one after the other.
            filters: The filters viewers can change: period or arrived (start/end dates); region, warehouse, carrier, client, category, status, promo, origin, destination, sku (each with the values selected at first, empty = all); value, quantity, lead, age (number ranges with min and/or max). Declare only what helps; set a default only when the request names a scope.
        """
        return call("create_dashboard", title=title, plan=plan, widgets=[w.model_dump(exclude_none=True) for w in widgets], filters=[f.model_dump(exclude_none=True) for f in filters or []])

    @tool(parse_docstring=True)
    def forecast_demand(
        metric: Literal["orders", "units"] = "units",
        horizon: int = 3,
        category: str | None = None,
        sku: str | None = None,
        service_level: Literal[80, 90, 95] = 90,
        carrier: list[str] | None = None,
        region: list[str] | None = None,
        warehouse: list[str] | None = None,
        client: list[str] | None = None,
        status: list[str] | None = None,
        promo: list[str] | None = None,
        origin: list[str] | None = None,
        destination: list[str] | None = None,
        value_min: float | None = None,
        value_max: float | None = None,
        quantity_min: float | None = None,
        quantity_max: float | None = None,
        lead_min: float | None = None,
        lead_max: float | None = None,
        age_min: float | None = None,
        age_max: float | None = None,
        arrived_start: str | None = None,
        arrived_end: str | None = None,
        title: str | None = None,
    ) -> str:
        """Forecast monthly demand for the next months. Picks, by backtest on the last 6 months, the best of moving average, exponential smoothing and linear trend; shows the chart to the user; for units also returns an inventory recommendation. Never forecast by hand.

        Args:
            metric: units (quantity ordered; use for inventory and stock questions) or orders (number of order rows).
            horizon: Months ahead, 1 to 6.
            category: Product category (e.g. PAPER) to forecast on its own; omit for all products.
            sku: A SKU (e.g. CRAYON-0017). It is estimated from its category's forecast times its share, because a SKU alone has too little history.
            service_level: Percent chance the planned inventory covers demand: 80, 90 or 95.
            carrier: Forecast only these carriers (e.g. ["UPS"]). Use it when the user names one; it does not change the dashboard. Omit to use the dashboard's current filters.
            region: Forecast only these regions. Same rule as carrier.
            warehouse: Forecast only these warehouses. Same rule as carrier.
            client: Forecast only these clients (e.g. ["CL-1004"]). Same rule as carrier.
            status: Forecast only orders with these statuses (delivered, delayed, in_transit, exception, canceled). Same rule as carrier.
            promo: "1" for promo orders only, "0" for regular ones only. Same rule as carrier.
            origin: Forecast only orders from these cities, exactly as listed. Same rule as carrier.
            destination: Forecast only orders to these cities, exactly as listed. Same rule as carrier.
            value_min: Only orders worth at least this many USD. value_max is the most.
            quantity_min: Only orders of at least this many items. quantity_max is the most.
            lead_min: Only arrived orders with at least this lead time in days. lead_max is the most.
            age_min: Only orders at least this many days old. age_max is the most.
            arrived_start: Only orders that arrived on or after this date (YYYY-MM-DD). arrived_end is the latest.
            title: Chart title, in the user's language.
        """
        return call("forecast_demand", metric=metric, horizon=horizon, category=category, sku=sku, service_level=service_level, carrier=carrier, region=region, warehouse=warehouse, client=client,
                    status=status, promo=promo, origin=origin, destination=destination, value_min=value_min, value_max=value_max,
                    quantity_min=quantity_min, quantity_max=quantity_max, lead_min=lead_min, lead_max=lead_max, age_min=age_min,
                    age_max=age_max, arrived_start=arrived_start, arrived_end=arrived_end, title=title)

    return {t.name: t for t in (set_filters, open_section, remember, search_kb, get_view, get_kpis, get_facets, run_sql, make_chart, create_dashboard, forecast_demand)}
