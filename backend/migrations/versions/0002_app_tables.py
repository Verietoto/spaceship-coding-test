"""saved dashboards and report schedules

Revision ID: 0002
Revises: 0001
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def created_columns() -> list[sa.Column]:
    return [
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "dashboards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("spec", JSONB(), nullable=False),
        *created_columns(),
    )
    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("frequency", sa.String(), nullable=False),
        sa.Column("recipients", JSONB(), nullable=False),
        sa.Column("contents", JSONB(), nullable=False),
        sa.Column("filters", JSONB(), nullable=False),
        *created_columns(),
    )


def downgrade() -> None:
    op.drop_table("schedules")
    op.drop_table("dashboards")
