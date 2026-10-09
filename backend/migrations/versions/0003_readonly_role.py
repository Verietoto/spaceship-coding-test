"""analytics_ro: the read-only login that runs SQL written by the LLM

Revision ID: 0003
Revises: 0002

It can SELECT from `orders` and nothing else (not dashboards/schedules), and every transaction is read-only with a
5 s statement timeout. Roles are server-wide, so this creates it once and only (re)sets its password and grants
on later runs; the password comes from ANALYTICS_RO_PASSWORD.
"""
from collections.abc import Sequence

from alembic import op

from app.core.config import ANALYTICS_RO_PASSWORD

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def literal(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def upgrade() -> None:
    pw = literal(ANALYTICS_RO_PASSWORD)
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_ro') THEN
                CREATE ROLE analytics_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD {pw};
            ELSE
                ALTER ROLE analytics_ro PASSWORD {pw};
            END IF;
        END $$""")
    op.execute("ALTER ROLE analytics_ro SET default_transaction_read_only = on")
    op.execute("ALTER ROLE analytics_ro SET statement_timeout = '5s'")
    op.execute("DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO analytics_ro', current_database()); END $$")
    op.execute("REVOKE CREATE ON SCHEMA public FROM PUBLIC")
    op.execute("GRANT USAGE ON SCHEMA public TO analytics_ro")
    op.execute("GRANT SELECT ON orders TO analytics_ro")


def downgrade() -> None:
    op.execute("REVOKE SELECT ON orders FROM analytics_ro")
    op.execute("REVOKE USAGE ON SCHEMA public FROM analytics_ro")
    op.execute("DO $$ BEGIN EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM analytics_ro', current_database()); END $$")
    # The role itself stays: it is server-wide and may still be used by another database on this server.
