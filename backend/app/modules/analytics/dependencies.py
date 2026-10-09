"""Turns request filter values into a validated Filters (422 on anything the data doesn't contain)."""
from typing import Any

from fastapi import HTTPException, Request

from .filters import DIMS, RANGES, Filters, build_filters


def get_filters(request: Request) -> Filters:
    """Query string: start, end (ISO dates), region/warehouse/carrier/client (repeat for several), exclude (dimension names).

    The old single-value form still works: ?period=Q4&carrier=UPS.
    """
    q = request.query_params
    values: dict[str, Any] = {k: q.get(k) for k in ("start", "end", "period", "year")}
    values.update({d: q.getlist(d) for d in (*DIMS, "exclude")})
    values.update({k: q.get(k) for k in ("arrived_start", "arrived_end", *(f"{r}_{b}" for r in RANGES for b in ("min", "max")))})
    try:
        return build_filters(values)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


def filters_from(values: dict[str, Any]) -> Filters:
    """Same validation for filters sent in a JSON body or stored with a schedule/preset; unknown keys are ignored."""
    try:
        return build_filters(values)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
