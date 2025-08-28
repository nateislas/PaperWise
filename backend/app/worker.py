from celery import Celery
from typing import Dict, Any
import os
import json
import time
import asyncio

from app.config import settings
from app.agents.orchestrator_agent import OrchestratorAgent
from app.job_state import set_state


celery_app = Celery(
    "paperwise",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)


def _result_path(job_id: str) -> str:
    results_dir = os.path.join(settings.upload_dir, "results")
    os.makedirs(results_dir, exist_ok=True)
    return os.path.join(results_dir, f"{job_id}.json")


@celery_app.task(bind=True)
def analyze_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
    """Background task to analyze a paper. Accepts either file_id or pdf_url pre-fetched path.

    Expected job keys: job_id, file_path, query
    """
    orchestrator = OrchestratorAgent()

    # Basic progress reporting via backend result backend (placeholder)
    self.update_state(state="PROGRESS", meta={"stage": "starting", "progress": 0})

    file_path = job.get("file_path")
    query = job.get("query")

    if not file_path:
        set_state(job.get("job_id", "unknown"), state="error", stage="failed", error="missing_file_path")
        self.update_state(state="FAILURE", meta={"error": "missing_file_path"})
        raise RuntimeError("missing_file_path")

    file_path = os.path.abspath(file_path)
    if not os.path.exists(file_path):
        set_state(job.get("job_id", "unknown"), state="error", stage="failed", error="file_not_found")
        self.update_state(state="FAILURE", meta={"error": "file_not_found"})
        raise FileNotFoundError(file_path)

    try:
        set_state(job["job_id"], state="processing", stage="starting", progress=1)
        self.update_state(state="PROGRESS", meta={"stage": "starting", "progress": 1})

        async def run_stream() -> Dict[str, Any]:
            final: Dict[str, Any] = {}
            async for chunk in orchestrator.analyze_paper_stream(file_path, query):
                ctype = chunk.get("type")
                progress = chunk.get("progress")
                if ctype == "status":
                    stage_msg = chunk.get("message", "processing")
                    set_state(job["job_id"], state="processing", stage=stage_msg, progress=progress if isinstance(progress, int) else None)
                    self.update_state(state="PROGRESS", meta={"stage": stage_msg, "progress": progress or 0})
                elif ctype in ("methodology_chunk", "results_chunk", "contextualization_chunk", "synthesis_chunk"):
                    # Update coarse progress if provided
                    if isinstance(progress, int):
                        set_state(job["job_id"], state="processing", progress=progress)
                elif ctype == "complete":
                    final = {
                        "analysis_id": chunk.get("analysis_id"),
                        "status": chunk.get("status"),
                        "comprehensive_analysis": chunk.get("analysis"),
                    }
                elif ctype == "error":
                    raise RuntimeError(chunk.get("message", "analysis_error"))
            return final

        result = asyncio.run(run_stream())

        # Persist result
        path = _result_path(job["job_id"])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)

        set_state(job["job_id"], state="done", stage="finalizing", progress=100, result_path=path)
        self.update_state(state="PROGRESS", meta={"stage": "finalizing", "progress": 95})
        return {"result_path": path}
    except Exception as e:
        # Let Celery capture the exception type and message
        set_state(job.get("job_id", "unknown"), state="error", stage="failed", error=type(e).__name__)
        self.update_state(state="FAILURE", meta={"error": type(e).__name__})
        raise


