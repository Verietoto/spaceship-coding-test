"""Plain-language AI text over facts the backend already computed: order/issue explanations and report summaries."""
import json

from ..analytics import filters as af
from ..analytics import metrics as am
from ..analytics import sections as asec
from .llm import call


def explain(facts: str, lang: str) -> str:
    """Plain-language reading of facts the backend already computed (an order, a data issue). No tools: nothing to look up."""
    language = "Indonesian" if lang == "id" else "English"
    instructions = (
        f"You explain logistics data to an operations team in {language}. Use only the facts given; do not add numbers. "
        "In 2-3 sentences: what it likely means and one concrete next action. Plain text, no markdown."
    )
    return call([{"role": "user", "content": facts}], instructions).output_text


def report_summary(f: af.Filters, lang: str) -> dict:
    """Report summary for the active filters, built from SQL-computed facts (returned as the calc trace)."""
    s = am.stats(f)
    carriers = [r for r in am.stats_by(f, "carrier", skip=("carrier",)) if r["n"] >= 10]
    regions = [r for r in am.stats_by(f, "region", skip=("region", "warehouse")) if r["n"] >= 10]
    cl = asec.clients(f)
    facts = {
        "filters": f.as_dict(),
        "orders": s["n"],
        "order_value_usd": round(s["val"], 2),
        "delivered_pct": s["deliv"],
        "delay_pct": s["delay"],
        "lead_p90_days": s["p90"],
        "over_7d_pct": s["over7"],
        "open_problem_orders": s["open"],
        "stuck_orders": s["stuck"],
        "exception_orders": s["exc"],
        "value_at_risk_usd": round(s["prob_val"], 2),
        "worst_carriers_by_delay (min 10 orders)": [
            {"carrier": r["key"], "delay_pct": r["delay"], "orders": r["n"]} for r in sorted(carriers, key=lambda r: -r["delay"])[:2]
        ],
        "worst_regions_by_delay (min 10 orders)": [
            {"region": r["key"], "delay_pct": r["delay"], "orders": r["n"]} for r in sorted(regions, key=lambda r: -r["delay"])[:2]
        ],
        "clients_needing_attention (delay > 20%, min 8 orders)": cl["flagged"],
        "top5_clients_value_share_pct": cl["top5_share"],
        "targets": {"delay_pct": "<= 10", "delivered_pct": ">= 90", "lead_p90_days": "<= 7", "over_7d_pct": "<= 5"},
    }
    language = "Indonesian" if lang == "id" else "English"
    instructions = (
        f"Write a short logistics report summary in {language} from the JSON facts only (no other numbers). "
        "Plain text, no markdown headings. Structure: one line on the filters; 3-5 '- ' bullets with the key numbers vs targets, "
        "worst carrier and region, clients needing attention, open problem orders; then 'Langkah disarankan:'/'Suggested steps:' "
        "with 2-3 '- ' bullets. Round percentages to one decimal."
    )
    text = call([{"role": "user", "content": json.dumps(facts, default=str)}], instructions).output_text
    calc = am.calc(f, ["orders", "value", "delivered", "delay", "p90", "over7", "stuck", "exc", "atrisk"])
    return {"summary": text, "facts": facts, "calc": calc}
