from typing import Optional, Dict, Any
import json
import redis
import os

from app.config import settings


def _get_redis() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


def _job_key(job_id: str) -> str:
    return f"jobs:{job_id}"


def init_job(job_id: str, file_path: str, query: Optional[str]) -> None:
    r = _get_redis()
    r.hset(_job_key(job_id), mapping={
        "state": "queued",
        "stage": "queued",
        "progress": "0",
        "file_path": file_path,
        "query": query or "",
    })


def set_state(job_id: str, *, state: Optional[str] = None, stage: Optional[str] = None,
              progress: Optional[int] = None, error: Optional[str] = None,
              result_path: Optional[str] = None) -> None:
    r = _get_redis()
    mapping: Dict[str, str] = {}
    if state is not None:
        mapping["state"] = state
    if stage is not None:
        mapping["stage"] = stage
    if progress is not None:
        mapping["progress"] = str(progress)
    if error is not None:
        mapping["error"] = error
    if result_path is not None:
        mapping["result_path"] = result_path
    if mapping:
        r.hset(_job_key(job_id), mapping=mapping)


def get_status(job_id: str) -> Dict[str, Any]:
    r = _get_redis()
    data = r.hgetall(_job_key(job_id))
    if not data:
        return {
            "job_id": job_id,
            "state": "pending",
            "progress": None,
            "stage": None,
            "error_code": None,
            "result_url": None,
        }

    result_path = data.get("result_path")
    result_url = None
    if result_path and os.path.exists(result_path):
        result_url = f"/api/v1/jobs/{job_id}/result"

    progress_str = data.get("progress")
    progress_val = int(progress_str) if progress_str and progress_str.isdigit() else None

    return {
        "job_id": job_id,
        "state": data.get("state", "processing"),
        "progress": progress_val,
        "stage": data.get("stage"),
        "error_code": data.get("error"),
        "result_url": result_url,
    }


