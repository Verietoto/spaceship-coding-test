"""orders table with derived columns

Revision ID: 0001
Revises:
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AS_OF = "2025-12-30"  # same as app.db.engine.AS_OF; frozen here so this migration never changes


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("client_id", sa.String(), nullable=False),
        sa.Column("order_id", sa.String(), primary_key=True),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("delivery_date", sa.Date(), nullable=True),
        sa.Column("carrier", sa.String(), nullable=False),
        sa.Column("origin_city", sa.String(), nullable=False),
        sa.Column("destination_city", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("sku", sa.String(), nullable=False),
        sa.Column("product_category", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_usd", sa.Float(), nullable=False),
        sa.Column("order_value_usd", sa.Float(), nullable=False),
        sa.Column("is_promo", sa.Integer(), nullable=False),
        sa.Column("promo_discount_pct", sa.Integer(), nullable=False),
        sa.Column("region", sa.String(), nullable=False),
        sa.Column("warehouse", sa.String(), nullable=False),
        sa.Column("month", sa.Integer(), sa.Computed("CAST(EXTRACT(MONTH FROM order_date) AS INTEGER)", persisted=True), nullable=False),
        sa.Column("lead_days", sa.Integer(), sa.Computed("delivery_date - order_date", persisted=True), nullable=True),
        sa.Column("age_days", sa.Integer(), sa.Computed(f"DATE '{AS_OF}' - order_date", persisted=True), nullable=False),
    )
    for col in ("order_date", "carrier", "region", "client_id"):
        op.create_index(f"ix_orders_{col}", "orders", [col])


def downgrade() -> None:
    op.drop_table("orders")
