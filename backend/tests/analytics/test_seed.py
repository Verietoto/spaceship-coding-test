"""The order CSV is not in the repository: a missing file must say where it belongs."""
from pathlib import Path

import pytest

from app.modules.analytics import seed as s


def test_a_missing_csv_says_where_to_put_it(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError) as e:
        s.read_rows(tmp_path / "nope.csv")
    assert "data/" in str(e.value) and "DATA_CSV" in str(e.value) and "nope.csv" in str(e.value)


def test_read_rows_parses_the_real_file_when_it_is_there() -> None:
    rows = s.read_rows()
    assert len(rows) == 400 and isinstance(rows[0]["quantity"], int) and rows[0]["order_date"].year == 2025
