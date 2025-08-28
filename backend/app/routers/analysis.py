from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any, List
import os
import logging
import json
import asyncio
import uuid
import httpx

from app.agents.orchestrator_agent import OrchestratorAgent
from app.config import settings
from app.worker import celery_app, analyze_job
from app.job_state import init_job, set_state, get_status, publish_current_status
from celery.result import AsyncResult

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize the orchestrator agent
orchestrator = OrchestratorAgent()

class AnalysisRequest(BaseModel):
    file_id: str
    query: Optional[str] = None
    analysis_type: str = "comprehensive"

class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    message: str
    analysis: Optional[Dict[str, Any]] = None


class AsyncAnalyzeRequest(BaseModel):
    file_id: Optional[str] = None
    pdf_url: Optional[str] = None
    query: Optional[str] = None
    analysis_type: str = "comprehensive"

    @field_validator("pdf_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Basic guard; deeper allow‑list enforced during fetch
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("pdf_url must be http(s)")
        return v


def _uploads_path_for_file_id(file_id: str) -> Optional[str]:
    upload_dir = settings.upload_dir
    for filename in os.listdir(upload_dir):
        if filename.startswith(file_id):
            return os.path.abspath(os.path.join(upload_dir, filename))
    return None


async def _download_pdf_to_uploads(pdf_url: str, filename_hint: Optional[str] = None) -> str:
    # Allow‑list basic arXiv domain; extend as needed
    allow_domains = ["arxiv.org", "export.arxiv.org"]
    from urllib.parse import urlparse
    host = urlparse(pdf_url).hostname or ""
    if not any(host.endswith(d) for d in allow_domains):
        raise HTTPException(status_code=400, detail="pdf_url domain is not allowed")

    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
        resp = await client.get(pdf_url)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch PDF ({resp.status_code})")
        content_type = resp.headers.get("content-type", "")
        content_bytes = resp.content
        if "pdf" not in content_type:
            # Some servers omit type; fallback by checking first bytes for %PDF
            if not content_bytes.startswith(b"%PDF"):
                raise HTTPException(status_code=400, detail="Fetched content is not a PDF")

    file_id = str(uuid.uuid4())
    suggested_name = filename_hint or os.path.basename(pdf_url.split("?")[0]) or "paper.pdf"
    filename = f"{file_id}_{suggested_name}"
    upload_dir = settings.upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, 'wb') as f:
        f.write(content_bytes)

    return file_path

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_paper(request: AnalysisRequest):
    """
    Analyze a research paper using the AI agent system
    """
    try:
        # Construct file path from file_id
        upload_dir = settings.upload_dir
        file_path = None
        
        # Find the file with the given file_id
        for filename in os.listdir(upload_dir):
            if filename.startswith(request.file_id):
                file_path = os.path.join(upload_dir, filename)
                break
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        logger.info(f"Starting analysis for file: {file_path}")
        
        # Run the analysis
        result = await orchestrator.analyze_paper(file_path, request.query)
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["error"])
        
        return AnalysisResponse(
            analysis_id=result["analysis_id"],
            status="success",
            message="Analysis completed successfully",
            analysis=result["comprehensive_analysis"]
        )
        
    except Exception as e:
        logger.error(f"Error in analysis endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/analyze/async")
async def analyze_paper_async(request: AsyncAnalyzeRequest):
    """
    Submit an async analysis job. Accepts either file_id or pdf_url and returns job_id immediately.
    """
    try:
        has_file = bool(request.file_id)
        has_url = bool(request.pdf_url)
        if has_file == has_url:
            raise HTTPException(status_code=400, detail="Provide exactly one of file_id or pdf_url")

        # Resolve file path
        file_path: Optional[str] = None
        if request.file_id:
            file_path = _uploads_path_for_file_id(request.file_id)
            if not file_path or not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="File not found")
        else:
            # Download server‑side
            file_path = await _download_pdf_to_uploads(request.pdf_url or "")

        job_id = str(uuid.uuid4())
        # Initialize job state in Redis
        init_job(job_id, file_path, request.query)
        task = analyze_job.apply_async(args=({
            "job_id": job_id,
            "file_path": file_path,
            "query": request.query,
            "analysis_type": request.analysis_type,
        },), task_id=job_id)

        return {"job_id": job_id, "status": "queued"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting async analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit job")


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Return job state and result_url when available without relying on Celery backend decoding."""
    try:
        return get_status(job_id)
    except Exception as e:
        import traceback
        logger.error(f"Error getting job status: {e}")
        logger.error(traceback.format_exc())
        return get_status(job_id)


@router.get("/jobs_debug/{job_id}")
async def get_job_status_debug(job_id: str):
    """Temporary debug endpoint to isolate routing/handler issues."""
    try:
        return {
            "job_id": job_id,
            "ok": True,
            "note": "debug endpoint"
        }
    except Exception as e:
        return {"job_id": job_id, "ok": False, "error": str(e)}


@router.get("/jobs/{job_id}/result")
async def get_job_result(job_id: str):
    """Return the final JSON result for a job if present."""
    try:
        result_path = os.path.join(settings.upload_dir, "results", f"{job_id}.json")
        if not os.path.exists(result_path):
            raise HTTPException(status_code=404, detail="Result not found")
        with open(result_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return JSONResponse(content=data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reading job result: {e}")
        raise HTTPException(status_code=500, detail="Failed to read job result")

@router.post("/analyze/stream")
async def analyze_paper_stream(request: AnalysisRequest):
    """
    Stream analysis of a research paper with real-time updates using Server-Sent Events
    """
    logger.info(f"🎯 STREAMING REQUEST RECEIVED")
    logger.info(f"📋 Request data: file_id={request.file_id}, query={request.query}, analysis_type={request.analysis_type}")
    
    try:
        # Construct file path from file_id
        upload_dir = settings.upload_dir
        file_path = None
        
        logger.info(f"🔍 Looking for file with ID: {request.file_id}")
        logger.info(f"📁 Upload directory: {upload_dir}")
        
        # Find the file with the given file_id
        files_in_dir = os.listdir(upload_dir)
        logger.info(f"📂 Files in upload directory: {files_in_dir}")
        
        for filename in files_in_dir:
            if filename.startswith(request.file_id):
                file_path = os.path.join(upload_dir, filename)
                logger.info(f"✅ Found file: {file_path}")
                break
        
        if not file_path or not os.path.exists(file_path):
            logger.error(f"❌ File not found: {file_path}")
            logger.error(f"❌ File exists check: {os.path.exists(file_path) if file_path else 'No path'}")
            raise HTTPException(status_code=404, detail="File not found")
        
        logger.info(f"🚀 Starting streaming analysis for file: {file_path}")
        
        async def generate_stream():
            """Generate streaming response"""
            chunk_count = 0
            try:
                logger.info(f"📡 Starting stream generation...")
                async for chunk in orchestrator.analyze_paper_stream(file_path, request.query):
                    chunk_count += 1
                    # Convert chunk to JSON and send as Server-Sent Event
                    data = json.dumps(chunk, ensure_ascii=False)
                    stream_data = f"data: {data}\n\n"
                    
                    logger.info(f"📤 Yielding chunk #{chunk_count}: type={chunk.get('type', 'unknown')}, progress={chunk.get('progress', 'N/A')}, content_length={len(chunk.get('content', ''))}")
                    
                    yield stream_data
                    
                    # Ensure chunks are flushed immediately
                    await asyncio.sleep(0.01)
                    
                logger.info(f"✅ Stream generation completed. Total chunks: {chunk_count}")
                    
            except Exception as e:
                logger.error(f"❌ Error in streaming analysis: {str(e)}")
                logger.error(f"❌ Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"❌ Traceback: {traceback.format_exc()}")
                
                error_data = json.dumps({
                    "type": "error",
                    "message": f"Streaming analysis failed: {str(e)}"
                }, ensure_ascii=False)
                yield f"data: {error_data}\n\n"
        
        logger.info(f"🔄 Creating StreamingResponse...")
        response = StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
                "Transfer-Encoding": "chunked",
            }
        )
        logger.info(f"✅ StreamingResponse created successfully")
        return response
        
    except Exception as e:
        logger.error(f"❌ Error in streaming analysis endpoint: {str(e)}")
        logger.error(f"❌ Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Streaming analysis failed: {str(e)}")

@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """
    Retrieve a specific analysis by ID
    """
    # This would typically query a database for stored analyses
    # For now, return a placeholder response
    return {
        "analysis_id": analysis_id,
        "status": "not_found",
        "message": "Analysis not found or expired"
    }

@router.get("/analysis/{analysis_id}/stream")
async def get_analysis_stream(analysis_id: str):
    """
    Stream a specific analysis by ID (for future implementation)
    """
    # This would typically stream from a database or cache
    # For now, return a placeholder response
    async def generate_stream():
        data = json.dumps({
            "type": "error",
            "message": "Analysis streaming not implemented for this ID"
        }, ensure_ascii=False)
        yield f"data: {data}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


@router.get("/jobs/{job_id}/stream")
async def stream_job_updates(job_id: str):
    """Server-Sent Events stream for job updates via Redis pub/sub."""
    import redis
    import threading
    r = redis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub(ignore_subscribe_messages=True)
    channel = f"jobs:{job_id}"
    pubsub.subscribe(channel)

    stop_event = threading.Event()

    async def event_generator():
        try:
            # Immediately publish a snapshot so the client sees initial state
            publish_current_status(job_id)
            while not stop_event.is_set():
                message = pubsub.get_message(timeout=1.0)
                if message and message.get("type") == "message":
                    data = message.get("data")
                    yield f"data: {data}\n\n"
                await asyncio.sleep(0.2)
        finally:
            try:
                pubsub.unsubscribe(channel)
                pubsub.close()
                r.close()
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/analyze/methodology")
async def analyze_methodology(request: AnalysisRequest):
    """
    Analyze only the methodology of a research paper
    """
    try:
        # Construct file path from file_id
        upload_dir = settings.upload_dir
        file_path = None
        
        for filename in os.listdir(upload_dir):
            if filename.startswith(request.file_id):
                file_path = os.path.join(upload_dir, filename)
                break
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Parse the PDF first
        pdf_result = orchestrator.pdf_parser.parse_pdf(file_path)
        
        if pdf_result["status"] == "error":
            raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {pdf_result.get('error', 'Unknown error')}")
        
        # Run methodology analysis only
        methodology_result = orchestrator.methodology_agent.analyze(
            pdf_result["documents"], 
            request.query
        )
        
        return {
            "analysis_id": f"methodology_{request.file_id}",
            "status": "success",
            "analysis": methodology_result
        }
        
    except Exception as e:
        logger.error(f"Error in methodology analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Methodology analysis failed: {str(e)}")

@router.post("/analyze/results")
async def analyze_results(request: AnalysisRequest):
    """
    Analyze only the results of a research paper
    """
    try:
        # Construct file path from file_id
        upload_dir = settings.upload_dir
        file_path = None
        
        for filename in os.listdir(upload_dir):
            if filename.startswith(request.file_id):
                file_path = os.path.join(upload_dir, filename)
                break
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Parse the PDF first
        pdf_result = orchestrator.pdf_parser.parse_pdf(file_path)
        
        if pdf_result["status"] == "error":
            raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {pdf_result.get('error', 'Unknown error')}")
        
        # Run results analysis only
        results_result = orchestrator.results_agent.analyze(
            pdf_result["documents"], 
            request.query
        )
        
        return {
            "analysis_id": f"results_{request.file_id}",
            "status": "success",
            "analysis": results_result
        }
        
    except Exception as e:
        logger.error(f"Error in results analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Results analysis failed: {str(e)}")

@router.post("/analyze/contextualization")
async def analyze_contextualization(request: AnalysisRequest):
    """
    Analyze only the contextualization of a research paper
    """
    try:
        # Construct file path from file_id
        upload_dir = settings.upload_dir
        file_path = None
        
        for filename in os.listdir(upload_dir):
            if filename.startswith(request.file_id):
                file_path = os.path.join(upload_dir, filename)
                break
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Parse the PDF first
        pdf_result = orchestrator.pdf_parser.parse_pdf(file_path)
        
        if pdf_result["status"] == "error":
            raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {pdf_result.get('error', 'Unknown error')}")
        
        # Run contextualization analysis only
        contextualization_result = orchestrator.contextualization_agent.analyze(
            pdf_result["documents"], 
            request.query
        )
        
        return {
            "analysis_id": f"contextualization_{request.file_id}",
            "status": "success",
            "analysis": contextualization_result
        }
        
    except Exception as e:
        logger.error(f"Error in contextualization analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Contextualization analysis failed: {str(e)}")

@router.get("/health")
async def health_check():
    """
    Health check endpoint for the analysis service
    """
    return {
        "status": "healthy",
        "service": "paperwise-analysis",
        "agents": {
            "orchestrator": "ready",
            "pdf_parser": "ready",
            "methodology": "ready",
            "results": "ready",
            "contextualization": "ready"
        }
    }
