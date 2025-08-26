from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import logging

from app.config import settings
from app.agents.orchestrator_agent import OrchestratorAgent

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize the orchestrator agent
orchestrator = OrchestratorAgent()

class AnalysisRequest(BaseModel):
    file_id: str
    query: Optional[str] = None
    analysis_type: Optional[str] = "comprehensive"  # comprehensive, methodology, results, contextualization

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

@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """
    Retrieve a specific analysis by ID
    """
    # In a production system, you'd store analyses in a database
    # For now, we'll return a placeholder
    return {
        "analysis_id": analysis_id,
        "status": "not_implemented",
        "message": "Analysis retrieval not implemented in this version"
    }

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
