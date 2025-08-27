from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import logging
import json
import asyncio

from app.agents.orchestrator_agent import OrchestratorAgent
from app.config import settings

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
                    
                    logger.info(f"📤 Yielding chunk #{chunk_count}: type={chunk.get('type', 'unknown')}, content_length={len(chunk.get('content', ''))}")
                    
                    yield stream_data
                    
                    # Minimal delay for responsive streaming
                    await asyncio.sleep(0.005)
                    
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
