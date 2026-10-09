"""The read-only SQL guard every LLM-written or saved-widget query goes through."""
import pytest

from app.db import readonly
from app.db.readonly import UnsafeSQL, run_readonly


def test_select_runs() -> None:
    rows = run_readonly("SELECT carrier, count(*) AS n FROM orders GROUP BY carrier;")
    assert sum(r["n"] for r in rows) == 400


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM orders",
        "DROP TABLE orders",
        "INSERT INTO orders SELECT * FROM orders",
        "UPDATE orders SET status = 'delivered'",
        "CREATE TABLE x (a int)",
        "SELECT 1; DROP TABLE orders",
        "SELECT 1) AS q; DROP TABLE orders; SELECT * FROM (SELECT 1",  # tries to escape the subquery wrapper
        "WITH d AS (DELETE FROM orders RETURNING *) SELECT * FROM d",
        "COPY orders TO PROGRAM 'id'",
        "SELECT pg_read_file('/etc/passwd')",
        "SELECT lo_import('/etc/passwd')",
        "SELECT * FROM dashboards",  # app tables are not readable by the LLM role
        "SELECT set_config('transaction_read_only', 'off', true)",
        "SELECT * FROM nope",
        "",
    ],
)
def test_unsafe_sql_rejected(sql: str) -> None:
    with pytest.raises(UnsafeSQL):
        run_readonly(sql)
    assert run_readonly("SELECT count(*) AS n FROM orders")[0]["n"] == 400  # table intact


def test_row_cap() -> None:
    assert len(run_readonly("SELECT * FROM generate_series(1, 10000)")) == 500


def test_timeout_and_no_carry_over(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(readonly, "TIMEOUT_MS", 200)
    with pytest.raises(UnsafeSQL, match="timeout"):
        run_readonly("SELECT pg_sleep(2)")
    run_readonly("SELECT set_config('statement_timeout', '0', false) AS s")  # a query loosening its own session...
    with pytest.raises(UnsafeSQL, match="timeout"):
        run_readonly("SELECT pg_sleep(2)")  # ...doesn't loosen the next one


def test_percent_signs_are_literal() -> None:
    assert run_readonly("SELECT count(*) AS n FROM orders WHERE sku LIKE 'PAPER%'")[0]["n"] > 0
