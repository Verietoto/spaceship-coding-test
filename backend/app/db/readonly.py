"""Runs SQL written by the LLM (and saved dashboard widgets): one SELECT, row-capped, time-limited, read-only.

Defense in depth, each layer enough on its own for the common attacks:
1. A separate login, `analytics_ro` (migration 0003): SELECT on `orders` only, no other table, no CREATE, read-only
   by default. It is not a superuser and holds no pg_read_server_files, so pg_read_file/COPY ... PROGRAM fail.
2. The text is wrapped as a subquery, so anything but a SELECT/VALUES/WITH query is a syntax error.
3. The row cap is a bound parameter, which makes psycopg use the extended protocol: Postgres then refuses more than
   one statement ("cannot insert multiple commands into a prepared statement").
4. Every run is its own read-only transaction with a local statement timeout, on a fresh connection (no pool), so a
   `set_config(...)` inside one query can't loosen the next one.
"""
from sqlalchemy import create_engine, exc
from sqlalchemy.pool import NullPool

from ..core.config import DATABASE_URL_READONLY
from .engine import plain

MAX_ROWS = 500
TIMEOUT_MS = 5000

# ponytail: NullPool = one connection per LLM query (~ms on localhost). Pool + RESET ALL if this ever shows up in latency.
readonly_engine = create_engine(DATABASE_URL_READONLY, poolclass=NullPool)


class UnsafeSQL(ValueError):
    pass


def run_readonly(sql: str) -> list[dict]:
    sql = sql.strip().rstrip(";").strip()
    if not sql:
        raise UnsafeSQL("empty SQL")
    wrapped = "SELECT * FROM (\n" + sql.replace("%", "%%") + "\n) AS q LIMIT %(row_cap)s"
    try:
        with readonly_engine.connect() as con:
            con.exec_driver_sql("SET TRANSACTION READ ONLY")
            con.exec_driver_sql(f"SET LOCAL statement_timeout = {TIMEOUT_MS}")
            result = con.exec_driver_sql(wrapped, {"row_cap": MAX_ROWS})
            rows = [{k: plain(v) for k, v in r.items()} for r in result.mappings()]
            con.rollback()
            return rows
    except exc.DBAPIError as e:
        raise UnsafeSQL(str(e.orig).strip().splitlines()[0] if e.orig else str(e)) from e
