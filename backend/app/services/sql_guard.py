"""Kiểm tra và chuẩn hóa SQL do LLM sinh ra trước khi chạy (chỉ cho phép SELECT an toàn)."""

import re

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

from app.errors import sql_rejected

ALLOWED_TABLES = {"sales_clean"}
ALLOWED_SCHEMAS = {"", "analytics"}

# Whitelist hàm theo lớp biểu thức của sqlglot (mọi hàm khác bị từ chối).
ALLOWED_FUNCS: tuple[type[exp.Expression], ...] = (
    exp.Count, exp.Sum, exp.Avg, exp.Min, exp.Max, exp.Stddev, exp.Variance,
    exp.PercentileCont, exp.PercentileDisc, exp.Round, exp.Ceil, exp.Floor, exp.Abs,
    exp.Coalesce, exp.Nullif, exp.Greatest, exp.Least, exp.Case, exp.If, exp.Cast,
    exp.TryCast, exp.DateTrunc, exp.TimestampTrunc, exp.TimeToStr, exp.Extract,
    exp.Lower, exp.Upper, exp.Length, exp.Trim, exp.Substring, exp.Concat,
    exp.RowNumber, exp.Rank, exp.DenseRank, exp.Lag, exp.Lead, exp.CountIf,
)  # fmt: skip
ALLOWED_ANON = {"unaccent", "date_part", "to_char", "percentile_cont", "stddev_pop"}

FORBIDDEN_NODES: tuple[type[exp.Expression], ...] = (
    exp.Insert, exp.Update, exp.Delete, exp.Create, exp.Drop, exp.Alter, exp.Command,
    exp.Copy, exp.Set, exp.Into, exp.Lock, exp.Merge, exp.TruncateTable, exp.Use,
    exp.Transaction, exp.Commit, exp.Rollback, exp.Grant, exp.Pragma,
)  # fmt: skip

_COMMENT_RE = re.compile(r"--|/\*|\*/")
_DATE_HINT = "Không dùng CURRENT_DATE/NOW(); hãy dùng ngày tham chiếu dạng DATE 'YYYY-MM-DD'."
_HINTS = {exp.CurrentDate: _DATE_HINT, exp.CurrentTimestamp: _DATE_HINT}


def _func_name(node: exp.Func) -> str:
    return node.name.lower() if isinstance(node, exp.Anonymous) else type(node).__name__


def _check_root(tree: exp.Expression) -> None:
    if isinstance(tree, exp.Select):
        return
    if isinstance(tree, exp.Union):
        for branch in (tree.this, tree.expression):
            _check_root(branch)
        return
    raise sql_rejected("Chỉ cho phép câu lệnh SELECT.")


def _check_tables(tree: exp.Expression) -> None:
    ctes = {c.alias.lower() for c in tree.find_all(exp.CTE)}
    for table in tree.find_all(exp.Table):
        if not isinstance(table.this, exp.Identifier):
            raise sql_rejected("Không cho phép hàm/biểu thức trong mệnh đề FROM.")
        name = table.name.lower()
        if table.catalog or table.db.lower() not in ALLOWED_SCHEMAS:
            raise sql_rejected(f"Không được truy cập schema '{table.db}'.")
        if name not in ALLOWED_TABLES and name not in ctes:
            raise sql_rejected(f"Chỉ được truy vấn bảng sales_clean, không phải '{table.name}'.")


def _check_funcs(tree: exp.Expression) -> None:
    for node in tree.find_all(exp.Func):
        if isinstance(node, exp.Anonymous):
            if node.name.lower() not in ALLOWED_ANON:
                raise sql_rejected(f"Hàm '{node.name}' không được phép.")
        elif not isinstance(node, ALLOWED_FUNCS):
            hint = _HINTS.get(type(node))
            raise sql_rejected(hint or f"Hàm '{_func_name(node)}' không được phép.")


def _apply_limit(tree: exp.Expression, max_rows: int) -> None:
    """Đảm bảo LIMIT ngoài cùng là số nguyên <= max_rows + 1 (dòng dư để nhận biết bị cắt)."""
    cap = max_rows + 1
    limit = tree.args.get("limit")
    value = None
    if isinstance(limit, exp.Limit) and isinstance(limit.expression, exp.Literal):
        value = int(limit.expression.name) if limit.expression.is_int else None
    if value is None or value > cap:
        tree.set("limit", exp.Limit(expression=exp.Literal.number(cap)))


def validate_and_limit(sql: str, max_rows: int = 500) -> str:
    """Trả về SQL đã chuẩn hóa (có LIMIT) hoặc ném AppError SQL_REJECTED."""
    if not sql or not sql.strip():
        raise sql_rejected("SQL rỗng.")
    if _COMMENT_RE.search(sql):
        raise sql_rejected("Không cho phép comment trong SQL.")
    try:
        statements = [s for s in sqlglot.parse(sql, read="postgres") if s is not None]
    except SqlglotError as exc:
        raise sql_rejected(f"SQL không hợp lệ: {str(exc).splitlines()[0]}") from exc
    if len(statements) != 1:
        raise sql_rejected("Chỉ cho phép đúng một câu lệnh.")
    tree = statements[0]
    _check_root(tree)
    if tree.find(*FORBIDDEN_NODES):
        raise sql_rejected("Câu lệnh chứa thao tác không được phép.")
    _check_tables(tree)
    _check_funcs(tree)
    _apply_limit(tree, max_rows)
    return tree.sql(dialect="postgres")
