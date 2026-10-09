"""Dashboard data: one endpoint per section, plus metadata and CSV export."""
import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from ...core.security import logged_in
from . import forecast as fc
from . import sections
from .dependencies import get_filters
from .filters import Filters, all_carriers, all_categories, all_clients, all_regions, all_warehouses, data_bounds, data_years, total_orders

router = APIRouter(prefix="/api", tags=["analytics"], dependencies=[logged_in])


@router.get("/meta")
def meta() -> dict:
    lo, hi = data_bounds()
    return {
        "regions": all_regions(),
        "carriers": all_carriers(),
        "warehouses": all_warehouses(),
        "clients": all_clients(),
        "categories": all_categories(),
        "total": total_orders(),
        "bounds": {"min": lo.isoformat(), "max": hi.isoformat()},
        "years": data_years(),
    }


@router.get("/facets")
def facets(f: Filters = Depends(get_filters)) -> dict:
    return sections.facets(f)


@router.get("/overview")
def overview(
    f: Filters = Depends(get_filters),
    compare: Literal["prev", "base", "none"] = "prev",
    gran: Literal["month", "quarter"] = "month",
) -> dict:
    return sections.overview(f, compare, gran)


@router.get("/delivery")
def delivery(f: Filters = Depends(get_filters)) -> dict:
    return sections.delivery(f)


@router.get("/clients")
def clients(f: Filters = Depends(get_filters)) -> dict:
    return sections.clients(f)


@router.get("/risk")
def risk(
    f: Filters = Depends(get_filters),
    include_delayed: bool = False,
    sort: Literal["impact", "age", "value"] = "impact",
) -> dict:
    return sections.risk(f, include_delayed, sort)


@router.get("/forecast")
def forecast(
    f: Filters = Depends(get_filters),
    metric: Literal["orders", "units"] = "orders",
    horizon: int = Query(3, ge=1, le=6),
    category: str | None = None,
    sku: str | None = None,
    service: float = 0.9,
) -> dict:
    """Monthly demand ahead: `category` or `sku` narrow it (a SKU is estimated from its category); `service` (0.8, 0.9, 0.95) is for units' inventory."""
    try:
        return fc.forecast(f, metric, horizon, category, sku, service)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@router.get("/quality")
def quality() -> dict:
    return sections.quality()


def _cell(v: object) -> object:
    """A text cell that starts like a formula would run in Excel/Sheets: a leading quote makes it plain text."""
    return "'" + v if isinstance(v, str) and v[:1] in ("=", "+", "-", "@", "\t", "\r") else v


@router.get("/export.csv")
def export_csv(f: Filters = Depends(get_filters)) -> StreamingResponse:
    rows = sections.export_rows(f)
    buf = io.StringIO()
    if rows:
        w = csv.DictWriter(buf, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows({k: _cell(v) for k, v in r.items()} for r in rows)
    name = f"orders_{f.slug()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{name}"'}
    )
