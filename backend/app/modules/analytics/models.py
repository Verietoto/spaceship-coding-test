"""The `orders` table: the CSV columns plus derived columns Postgres computes on insert."""
from datetime import date

from sqlalchemy import Computed, Index
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base
from ...db.engine import AS_OF


class Order(Base):
    __tablename__ = "orders"

    # CSV columns, in file order (export and `SELECT *` keep this order)
    client_id: Mapped[str]
    order_id: Mapped[str] = mapped_column(primary_key=True)
    order_date: Mapped[date]
    delivery_date: Mapped[date | None]  # NULL = not arrived
    carrier: Mapped[str]
    origin_city: Mapped[str]
    destination_city: Mapped[str]
    status: Mapped[str]  # delivered | delayed | in_transit | exception | canceled
    sku: Mapped[str]
    product_category: Mapped[str]
    quantity: Mapped[int]
    unit_price_usd: Mapped[float]
    order_value_usd: Mapped[float]  # gross; promo discount not deducted
    is_promo: Mapped[int]
    promo_discount_pct: Mapped[int]
    region: Mapped[str]
    warehouse: Mapped[str]

    # derived (generated) columns used by every metric
    month: Mapped[int] = mapped_column(Computed("CAST(EXTRACT(MONTH FROM order_date) AS INTEGER)", persisted=True))
    lead_days: Mapped[int | None] = mapped_column(Computed("delivery_date - order_date", persisted=True))
    age_days: Mapped[int] = mapped_column(Computed(f"DATE '{AS_OF}' - order_date", persisted=True))

    __table_args__ = (
        Index("ix_orders_order_date", "order_date"),
        Index("ix_orders_carrier", "carrier"),
        Index("ix_orders_region", "region"),
        Index("ix_orders_client_id", "client_id"),
    )


CSV_COLUMNS = [c.name for c in Order.__table__.columns if c.computed is None]
