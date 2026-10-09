"""CSV export: text that would run as a spreadsheet formula is neutralised; numbers are left alone."""
from fastapi.testclient import TestClient

from app.modules.analytics.router import _cell


def test_formula_cells_are_quoted_and_numbers_kept() -> None:
    assert [_cell(v) for v in ("=1+1", "+cmd", "-2+3", "@SUM(A1)", "\t=x", "plain", "")] == ["'=1+1", "'+cmd", "'-2+3", "'@SUM(A1)", "'\t=x", "plain", ""]
    assert _cell(-5) == -5 and _cell(1.5) == 1.5 and _cell(None) is None


def test_export_still_downloads(client: TestClient) -> None:
    r = client.get("/api/export.csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
