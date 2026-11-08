import pytest

from app.errors import AppError
from app.services.sql_guard import validate_and_limit

OK_QUERIES = [
    "SELECT count(*) FROM sales_clean",
    "SELECT nguon_lead, count(*) FROM analytics.sales_clean GROUP BY 1 ORDER BY 2 DESC",
    "SELECT to_char(ngay_ky_hd, 'YYYY-MM') AS thang, sum(gia_tri_giao_dich_vnd) "
    "FROM sales_clean WHERE trang_thai = 'Ký HĐ' GROUP BY 1 ORDER BY 1",
    "SELECT date_trunc('month', ngay_tao_lead) m, extract(day from ngay_tao_lead) FROM sales_clean",
    "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY dien_tich_m2) FROM sales_clean",
    "SELECT round(avg(ngay_ky_hd - ngay_tao_lead), 1) FROM sales_clean WHERE da_ky_hd",
    "SELECT ngay_tao_lead >= DATE '2026-11-08' - INTERVAL '30 days' FROM sales_clean",
    "WITH t AS (SELECT team, count(*) c FROM sales_clean GROUP BY 1) SELECT * FROM t",
    "SELECT team FROM sales_clean UNION ALL SELECT ma_nv FROM sales_clean",
    "SELECT count(*) FILTER (WHERE da_ky_hd) * 1.0 / count(*) FROM sales_clean",
    "SELECT ten_nv FROM sales_clean WHERE ten_nv ILIKE '%an%'",
    "SELECT count(*) FROM sales_clean;",
]

REJECTED = {
    "drop": "DROP TABLE sales_clean",
    "delete": "DELETE FROM sales_clean",
    "update": "UPDATE sales_clean SET team = 'x'",
    "insert": "INSERT INTO sales_clean (ma_giao_dich) VALUES ('x')",
    "multi": "SELECT 1 FROM sales_clean; DROP TABLE sales_clean",
    "multi_select": "SELECT 1 FROM sales_clean; SELECT 2 FROM sales_clean",
    "pg_sleep": "SELECT pg_sleep(10) FROM sales_clean",
    "other_table": "SELECT * FROM users",
    "public_sales": "SELECT * FROM public.sales",
    "info_schema": "SELECT * FROM information_schema.tables",
    "pg_catalog": "SELECT * FROM pg_catalog.pg_roles",
    "pg_table": "SELECT * FROM pg_class",
    "line_comment": "SELECT 1 FROM sales_clean -- hi",
    "block_comment": "SELECT /* x */ 1 FROM sales_clean",
    "select_into": "SELECT * INTO newt FROM sales_clean",
    "cte_dml": "WITH a AS (DELETE FROM sales_clean RETURNING *) SELECT * FROM a",
    "for_update": "SELECT * FROM sales_clean FOR UPDATE",
    "generate_series": "SELECT * FROM generate_series(1, 1000000)",
    "gs_expr": "SELECT generate_series(1, 5) FROM sales_clean",
    "set": "SET statement_timeout = 0",
    "set_config": "SELECT set_config('statement_timeout', '0', false) FROM sales_clean",
    "current_setting": "SELECT current_setting('x') FROM sales_clean",
    "current_date": "SELECT * FROM sales_clean WHERE ngay_tao_lead > CURRENT_DATE",
    "now": "SELECT now() FROM sales_clean",
    "empty": "   ",
    "garbage": "hôm nay trời đẹp",
    "copy": "COPY sales_clean TO '/tmp/x'",
    "subquery_other": "SELECT * FROM sales_clean WHERE ma_nv IN (SELECT ma_nv FROM public.sales)",
    "dblink": "SELECT dblink('x', 'select 1') FROM sales_clean",
    "lo": "SELECT lo_import('/etc/passwd') FROM sales_clean",
}


@pytest.mark.parametrize("sql", OK_QUERIES)
def test_allowed(sql: str) -> None:
    assert validate_and_limit(sql).upper().startswith(("SELECT", "WITH"))


@pytest.mark.parametrize("sql", REJECTED.values(), ids=REJECTED.keys())
def test_rejected(sql: str) -> None:
    with pytest.raises(AppError) as err:
        validate_and_limit(sql)
    assert err.value.code == "SQL_REJECTED"
    assert err.value.status == 400


def test_limit_added_when_missing() -> None:
    assert validate_and_limit("SELECT * FROM sales_clean", 500).endswith("LIMIT 501")


def test_limit_clamped() -> None:
    assert validate_and_limit("SELECT * FROM sales_clean LIMIT 100000", 500).endswith("LIMIT 501")


def test_small_limit_kept() -> None:
    assert validate_and_limit("SELECT * FROM sales_clean LIMIT 5", 500).endswith("LIMIT 5")


def test_limit_all_replaced() -> None:
    assert validate_and_limit("SELECT * FROM sales_clean LIMIT ALL", 500).endswith("LIMIT 501")


def test_union_limit() -> None:
    sql = validate_and_limit("SELECT team FROM sales_clean UNION SELECT ma_nv FROM sales_clean")
    assert sql.endswith("LIMIT 501")


def test_inner_limit_not_enough() -> None:
    sql = validate_and_limit("SELECT * FROM (SELECT * FROM sales_clean LIMIT 3) t")
    assert sql.endswith("LIMIT 501")


def test_boolean_operators_and_exists_allowed() -> None:
    sql = (
        "SELECT count(*) FROM sales_clean WHERE (tinh_tp = 'Hà Nội' OR tinh_tp = 'An Giang') "
        "AND xac_suat_chot > 70 AND EXISTS (SELECT 1 FROM sales_clean)"
    )
    assert validate_and_limit(sql)


CTE_SCOPE_REJECTED = {
    "decoy_cte_elsewhere": "SELECT * FROM (WITH pg_user AS (SELECT 1) SELECT 1) q, pg_user",
    "decoy_in_subquery": "SELECT * FROM sales_clean WHERE ma_nv IN "
    "(WITH pg_user AS (SELECT 'a' AS ma_nv) SELECT ma_nv FROM pg_user) "
    "AND ma_nv IN (SELECT usename FROM pg_user)",
    "forward_reference": "WITH a AS (SELECT * FROM pg_user), pg_user AS (SELECT 1) SELECT * FROM a",
    "recursive": "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r) SELECT n FROM r",
    "qualified_cte_name": "WITH t AS (SELECT 1) SELECT * FROM public.t",
}


@pytest.mark.parametrize("sql", CTE_SCOPE_REJECTED.values(), ids=CTE_SCOPE_REJECTED.keys())
def test_cte_scope_and_recursive_rejected(sql: str) -> None:
    with pytest.raises(AppError) as exc:
        validate_and_limit(sql)
    assert exc.value.code == "SQL_REJECTED"


CTE_SCOPE_OK = [
    "WITH a AS (SELECT team, count(*) c FROM sales_clean GROUP BY 1), "
    "b AS (SELECT * FROM a WHERE c > 1) SELECT * FROM b",
    "WITH a AS (SELECT team FROM sales_clean) SELECT * FROM sales_clean "
    "WHERE team IN (SELECT team FROM a)",
    "WITH a AS (SELECT team FROM sales_clean) SELECT team FROM a UNION ALL SELECT team FROM a",
    "SELECT * FROM (WITH a AS (SELECT team FROM sales_clean) SELECT * FROM a) q",
]


@pytest.mark.parametrize("sql", CTE_SCOPE_OK)
def test_cte_scope_allowed(sql: str) -> None:
    assert validate_and_limit(sql).upper().startswith(("SELECT", "WITH"))
