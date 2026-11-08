"""Điểm vào FastAPI."""

from fastapi import FastAPI

app = FastAPI(title="Text-to-SQL Bất động sản")


@app.get("/health")
async def health() -> dict[str, str]:
    """Kiểm tra tiến trình còn sống."""
    return {"status": "ok"}
