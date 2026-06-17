from celery import Celery
from typing import Dict, Any
import os
import json
import time
import asyncio
import logging
from datetime import datetime, timezone

from app.config import settings
from app.agents.orchestrator_agent import OrchestratorAgent
from app.job_state import set_state, publish_update
from app.analysis_manager import analysis_manager


logger = logging.getLogger(__name__)


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
                    publish_update(job["job_id"], {"type": "status", "stage": stage_msg, "progress": progress or 0})
                elif ctype in ("methodology_chunk", "results_chunk", "contextualization_chunk", "synthesis_chunk"):
                    # Update coarse progress if provided
                    if isinstance(progress, int):
                        set_state(job["job_id"], state="processing", progress=progress)
                        publish_update(job["job_id"], {"type": ctype, "progress": progress})
                elif ctype == "complete":
                    final = {
                        "analysis_id": chunk.get("analysis_id"),
                        "status": chunk.get("status"),
                        "comprehensive_analysis": chunk.get("analysis"),
                    }
                    publish_update(job["job_id"], {"type": "complete"})
                elif ctype == "error":
                    raise RuntimeError(chunk.get("message", "analysis_error"))
            return final

        result = asyncio.run(run_stream())

        # Save results using analysis manager
        analysis_id = job["job_id"]
        
        # Save comprehensive analysis
        if "comprehensive_analysis" in result:
            analysis_manager.save_analysis_result(
                analysis_id, 
                "comprehensive", 
                result["comprehensive_analysis"]
            )
        
        # Update metadata with completion info and extracted paper metadata
        metadata = analysis_manager.get_analysis_metadata(analysis_id)
        if metadata:
            metadata["analysis_info"]["status"] = "completed"
            metadata["analysis_info"]["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            # Add logging to debug the result structure
            logger.info(f"🔍 Worker result keys: {list(result.keys())}")
            if "comprehensive_analysis" in result:
                logger.info(f"🔍 Comprehensive analysis keys: {list(result['comprehensive_analysis'].keys())}")
                if "paper_info" in result["comprehensive_analysis"]:
                    logger.info(f"🔍 Found paper_info in comprehensive_analysis: {result['comprehensive_analysis']['paper_info']}")
            
            # Update paper_info with extracted metadata from analysis results
            if "comprehensive_analysis" in result and "paper_info" in result["comprehensive_analysis"]:
                extracted_paper_info = result["comprehensive_analysis"]["paper_info"]
                logger.info(f"🔍 Extracted paper_info: {extracted_paper_info}")
                if extracted_paper_info:
                    # Update title and authors if they were successfully extracted
                    if extracted_paper_info.get("title") and extracted_paper_info["title"] != "Unknown":
                        logger.info(f"🔍 Updating title from '{metadata['paper_info']['title']}' to '{extracted_paper_info['title']}'")
                        metadata["paper_info"]["title"] = extracted_paper_info["title"]
                    if extracted_paper_info.get("author") and extracted_paper_info["author"] != "Unknown":
                        logger.info(f"🔍 Updating author from '{metadata['paper_info'].get('author', 'None')}' to '{extracted_paper_info['author']}'")
                        metadata["paper_info"]["author"] = extracted_paper_info["author"]
                    if extracted_paper_info.get("authors"):
                        logger.info(f"🔍 Updating authors to: {extracted_paper_info['authors']}")
                        metadata["paper_info"]["authors"] = extracted_paper_info["authors"]
                    # Add additional metadata fields
                    for key in ["subject", "creator", "producer", "pages", "file_size", "parsed_at"]:
                        if key in extracted_paper_info:
                            metadata["paper_info"][key] = extracted_paper_info[key]
                            logger.info(f"🔍 Added {key}: {extracted_paper_info[key]}")
                else:
                    logger.warning("🔍 Extracted paper_info is empty or None")
            else:
                logger.warning("🔍 No paper_info found in comprehensive_analysis")
            # Pre-submit document to PageIndex if API key is present
            if settings.pageindex_api_key:
                try:
                    logger.info(f"🚀 Pre-submitting paper to PageIndex in background: {file_path}")
                    from pageindex import PageIndexClient
                    pi_client = PageIndexClient(api_key=settings.pageindex_api_key)
                    pi_result = pi_client.submit_document(file_path)
                    doc_id = pi_result.get("doc_id")
                    if doc_id:
                        metadata["pageindex_doc_id"] = doc_id
                        logger.info(f"✅ PageIndex pre-submission successful. doc_id: {doc_id}")
                except Exception as pageindex_error:
                    logger.warning(f"⚠️ PageIndex background pre-submission failed: {pageindex_error}")

            # NEW: Upload document to LlamaCloud Managed RAG
            if settings.llama_cloud_api_key:
                try:
                    logger.info(f"☁️ Uploading paper to LlamaCloud Managed RAG: {file_path}")
                    from llama_cloud_services import LlamaCloudIndex
                    
                    # Connection parameters
                    collection_name = f"paper_{analysis_id}"
                    
                    # Get or Create Index
                    index = await LlamaCloudIndex.acreate_index(
                        name=collection_name,
                        project_name=settings.llama_cloud_project,
                        organization_id=settings.llama_cloud_org_id,
                        api_key=settings.llama_cloud_api_key
                    )
                    
                    # Upload file
                    await index.aupload_file(file_path)
                    logger.info(f"✅ File uploaded to LlamaCloud. Waiting for ingestion...")
                    
                    # Wait for ingestion to complete so it's ready for chat immediately
                    await index.await_for_completion()
                    
                    metadata["llama_index_id"] = index.id
                    logger.info(f"✅ LlamaCloud ingestion complete. Index ID: {index.id}")
                except Exception as llama_error:
                    logger.warning(f"⚠️ LlamaCloud upload failed: {llama_error}")

            analysis_manager.save_analysis_metadata(analysis_id, metadata)

        set_state(job["job_id"], state="done", stage="finalizing", progress=100)
        publish_update(job["job_id"], {"type": "done"})
        self.update_state(state="PROGRESS", meta={"stage": "finalizing", "progress": 95})
        
        return {"analysis_id": analysis_id}
    except Exception as e:
        # Let Celery capture the exception type and message
        set_state(job.get("job_id", "unknown"), state="error", stage="failed", error=type(e).__name__)
        publish_update(job.get("job_id", "unknown"), {"type": "error", "error": type(e).__name__})
        self.update_state(state="FAILURE", meta={"error": type(e).__name__})
        
        raise


