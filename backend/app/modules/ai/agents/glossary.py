"""What every card, chart and section of the dashboard means, so the copilot can explain them without guessing.

Keep it in step with the UI texts (frontend i18n/overview.ts, formulas.ts, delivery.ts ...) and the SQL in
analytics/metrics.py. Definitions of the data itself (stuck, open problem, value at risk) are in llm.SCHEMA.
"""

GLOSSARY = """What the dashboard shows (use this to explain a card, chart or section; the numbers themselves come from tools):

Overview: six cards, each with the value for the current filters, a change against the comparison, and a sub-line.
- Orders: number of order rows in the filter. Change in relative %.
- Order value: sum of order_value_usd, gross (promo discounts are NOT deducted). Sub-line: AOV, the average order value. Change in relative %.
- Delivered: orders with status delivered / all orders (canceled, in_transit, delayed and exception orders are not delivered). Suggested target >= 90%. Change in percentage points; a drop is bad.
- Delay rate: orders with status delayed / all orders. Suggested target <= 10%; shown red above it. Change in percentage points; a rise is bad.
- Lead time P90: the 90th percentile of lead time (days from order to arrival), only orders that have arrived: 9 of 10 arrived orders arrive within that many days. Sub-line: median and mean. Change in days; a rise is bad.
- Orders > 7 days: share of arrived orders whose lead time is over 7 days (a suggested 7-day SLA, target <= 5%). Change in percentage points; a rise is bad.
- The change compares with the "Compare" choice: previous period (the same length right before; a month, quarter, half or year shifts back by whole months; when nothing precedes it and a carrier/region/warehouse/client filter is on, it compares with all data), all data (the same dashboard without carrier/region/warehouse/client filters), or none. Green = better, red = worse, grey = no clear change.
- Charts: delay rate per month (or quarter), months outside the selected period dimmed, n = orders in that month, small n is not conclusive; lead time distribution: how many arrived orders took each number of days, split at 7 days.
Delivery performance: carrier ranking by delay rate (dashed line = 10% target; also P90 and mean lead time); carrier x region heatmap of delay rate (dashed outline = fewer than 5 orders, draw no conclusion); warehouses by region (each warehouse serves one region, so compare within a region). Clicking a row focuses the dashboard on it.
Clients: top 5 clients by order value; clients with delay rate over 20% (at least 8 orders); value at risk (delayed + exception + stuck orders) and its share of order value; table of all clients with open problems and value at risk.
Risk and exceptions: the open problem orders (exception, and stuck = in transit over 30 days as of 2025-12-30; optionally delayed orders that arrived), sortable by business impact (the client's total value, then the order value), order age or order value; each order has an explanation, its basis and a draft message.
Demand forecast: orders or units per month, actual vs forecast, for all products or one category. Three simple methods compete (moving average of 3 months, exponential smoothing, linear trend) and the one with the lowest backtest error (WAPE, one month ahead over the last 6 months) is used; "same as last month" is only a yardstick. 1 to 6 months ahead with an 80% range. For units, an inventory recommendation: the forecast over the horizon plus safety stock (z x error x sqrt(months)) at a service level of 80, 90 or 95%. A SKU is estimated from its category's forecast times its share. The period filter is ignored (other filters apply). With only 12 months and no clear seasonality the forecast is flat with a wide range: read it as a range.
Data quality: how far the numbers can be trusted: in-transit orders over 30 days (counted as stuck), promo orders not net of discount (so every value is gross), and no ETA/SLA or shipping cost columns (delayed cannot be checked against a promise, the 7-day SLA is a proposal).
Reports: AI report summary, CSV export of the active filters, print to PDF, and scheduled reports (email delivery is simulated).
Knowledge: the user's own notes and the team's documents. The targets (90%, 10%, 7 days, 5%) are proposals, not contractual.
Order statuses: delivered, delayed, in_transit, exception, canceled.
Filters: besides the period, region, warehouse, carrier and client, the data can be filtered by product category, order status, promo, origin and destination city, SKU, and number ranges (order value, quantity, lead time, order age) and an arrival date range. Filtering by status changes what Delivered and Delay rate are measured against (with status = delayed, Delivered is 0% and Delay rate 100%); a lead time or an arrival date exists only for arrived orders, so a bound on either leaves out the orders still on their way.
"""
