"""Chạy bộ đánh giá với Groq thật + DB thật (role app_readonly).

Cần GROQ_API_KEY và DATABASE_URL trong môi trường hoặc .env.
Chạy từ thư mục backend:  python -m tests.eval.run_eval [--only q01,q02]
"""

import argparse
import asyncio
import json
import time
from datetime import datetime
from pathlib import Path

import yaml

from app.config import get_settings
from app.db.pool import create_pool
from app.errors import AppError
from app.schemas import QueryRequest
from app.services.executor import PgExecutor
from app.services.llm import GroqLlm
from app.services.query_service import OutOfScope, answer
from app.services.sql_guard import validate_and_limit
from tests.eval.scoring import results_match

HERE = Path(__file__).parent
PASS_TARGET = 0.85


async def run(only: set[str] | None) -> int:
    s = get_settings()
    if not (s.groq_api_key and s.database_url):
        print("Thiếu GROQ_API_KEY hoặc DATABASE_URL: chưa thể chạy eval thật.")
        return 2
    data = yaml.safe_load((HERE / "questions.yaml").read_text(encoding="utf-8"))
    pool = create_pool(s.database_url.get_secret_value())
    await pool.open()
    executor = PgExecutor(pool, s.max_rows, s.statement_timeout_ms)
    llm = GroqLlm(s.groq_api_key.get_secret_value(), s.groq_model, s.groq_fallback_model)
    rows: list[dict] = []
    try:
        for q in data["questions"]:
            if only and q["id"] not in only:
                continue
            rows.append(await _one(q, s, llm, executor))
            await asyncio.sleep(2)  # tránh vượt giới hạn tốc độ của gói miễn phí
        for r in data["refusals"]:
            if only and r["id"] not in only:
                continue
            rows.append(await _refusal(r, s, llm, executor))
            await asyncio.sleep(2)
    finally:
        await pool.close()
    return _report(rows, s.groq_model)


async def _one(q: dict, s, llm, executor) -> dict:
    t0 = time.monotonic()
    rec = {"id": q["id"], "question": q["question"], "kind": "sql", "ok": False}
    try:
        gold = await executor.execute(validate_and_limit(q["sql"], s.max_rows))
        resp = await answer(QueryRequest(question=q["question"]), s, llm, executor)
        rec["sql"] = resp.sql
        rec["ok"] = results_match(gold.rows, resp.rows)
        if q.get("chart"):
            rec["chart_ok"] = resp.chart is not None
        if not q.get("chart") and resp.chart is not None:
            rec["ok"] = False
            rec["error"] = "vẽ biểu đồ khi không được yêu cầu"
    except (AppError, OutOfScope) as exc:
        rec["error"] = f"{type(exc).__name__}: {getattr(exc, 'message', exc)}"
    rec["seconds"] = round(time.monotonic() - t0, 1)
    return rec


async def _refusal(r: dict, s, llm, executor) -> dict:
    rec = {"id": r["id"], "question": r["question"], "kind": "refusal", "ok": False}
    try:
        resp = await answer(QueryRequest(question=r["question"]), s, llm, executor)
        rec["sql"] = resp.sql
        rec["ok"] = resp.sql is None and not resp.rows
    except OutOfScope as exc:
        rec["ok"] = True
        rec["message"] = exc.message
    except AppError as exc:
        rec["error"] = exc.message
    return rec


def _report(rows: list[dict], model: str) -> int:
    sql_rows = [r for r in rows if r["kind"] == "sql"]
    ref_rows = [r for r in rows if r["kind"] == "refusal"]
    for r in rows:
        print(f"{'PASS' if r['ok'] else 'FAIL'}  {r['id']}  {r['question']}  {r.get('error', '')}")
    acc = sum(r["ok"] for r in sql_rows) / max(len(sql_rows), 1)
    print(f"\nExecution accuracy: {acc:.0%} ({sum(r['ok'] for r in sql_rows)}/{len(sql_rows)})")
    print(f"Từ chối đúng: {sum(r['ok'] for r in ref_rows)}/{len(ref_rows)}")
    out = HERE / "results"
    out.mkdir(exist_ok=True)
    path = out / f"eval-{datetime.now():%Y%m%d-%H%M%S}.json"
    path.write_text(
        json.dumps({"model": model, "accuracy": acc, "rows": rows}, ensure_ascii=False, indent=2)
    )
    print(f"Chi tiết: {path}")
    return 0 if acc >= PASS_TARGET and all(r["ok"] for r in ref_rows) else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="danh sách id cách nhau bởi dấu phẩy")
    args = ap.parse_args()
    raise SystemExit(asyncio.run(run(set(args.only.split(",")) if args.only else None)))
