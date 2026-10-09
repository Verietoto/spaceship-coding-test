from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Every table's ORM model inherits this; migrations/env.py reads Base.metadata for --autogenerate."""
