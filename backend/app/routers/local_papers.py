from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import shutil
import uuid
from datetime import datetime, timezone

from app.config import settings
from app.analysis_manager import analysis_manager

router = APIRouter()

class OpenPaperRequest(BaseModel):
    absolute_path: str

class LocalPaperInfo(BaseModel):
    filename: str
    absolute_path: str
    size_bytes: int
    modified_at: str
    already_analyzed: bool
    analysis_id: Optional[str] = None

@router.get("/local-papers", response_model=List[LocalPaperInfo])
async def list_local_papers(path: Optional[str] = Query(None, description="Directory path on laptop to scan")):
    """
    List PDF files in a local folder on the laptop
    """
    scan_path = path or settings.papers_dir or "papers"
    
    if not os.path.exists(scan_path):
        # Fallback: if default "papers" folder doesn't exist, use uploads
        scan_path = "papers"
        os.makedirs(scan_path, exist_ok=True)

    if not os.path.isdir(scan_path):
        raise HTTPException(status_code=400, detail=f"Path '{scan_path}' is not a directory")

    try:
        # Get existing analyses to see if we've already imported these files
        existing_analyses = analysis_manager.list_analyses(limit=1000)
        analyzed_map = {}
        for analysis in existing_analyses:
            orig_filename = analysis.get("paper_info", {}).get("original_filename", "")
            if orig_filename:
                analyzed_map[orig_filename] = analysis["analysis_id"]

        local_papers = []
        for filename in os.listdir(scan_path):
            if filename.lower().endswith('.pdf'):
                abs_path = os.path.abspath(os.path.join(scan_path, filename))
                stat_info = os.stat(abs_path)
                
                # Check if this filename matches an already imported paper
                already_analyzed = filename in analyzed_map
                analysis_id = analyzed_map.get(filename)

                local_papers.append(LocalPaperInfo(
                  filename=filename,
                  absolute_path=abs_path,
                  size_bytes=stat_info.st_size,
                  modified_at=datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                  already_analyzed=already_analyzed,
                  analysis_id=analysis_id
                ))
                
        # Sort by filename
        local_papers.sort(key=lambda x: x.filename.lower())
        return local_papers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan local folder: {str(e)}")

@router.post("/local-papers/open")
async def open_local_paper(request: OpenPaperRequest):
    """
    Open a local paper from the laptop.
    Copies it to an analysis workspace, creates metadata, and returns analysis_id.
    """
    if not os.path.exists(request.absolute_path):
        raise HTTPException(status_code=404, detail="Local PDF file not found at the specified path")
    
    if not request.absolute_path.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    filename = os.path.basename(request.absolute_path)
    
    try:
        # Check if already imported
        existing_analyses = analysis_manager.list_analyses(limit=1000)
        for analysis in existing_analyses:
            if analysis.get("paper_info", {}).get("original_filename") == filename:
                return {
                    "analysis_id": analysis["analysis_id"],
                    "message": "Paper already opened previously",
                    "status": "opened"
                }

        # Initialize a new analysis
        analysis_id = str(uuid.uuid4())
        analysis_manager.create_analysis_directory(analysis_id, filename)
        
        # Move/Copy paper to analysis directory
        dest_path = os.path.join(analysis_manager.analyses_dir, analysis_id, "paper.pdf")
        shutil.copy2(request.absolute_path, dest_path)
        
        # Save metadata with 'completed' or 'ready_for_analysis' status
        metadata = {
            "paper_info": {
                "original_filename": filename,
                "arxiv_id": "",
                "title": filename.rsplit('.', 1)[0].replace('_', ' ').replace('-', ' '),
                "authors": ["Local User"],
                "upload_date": datetime.now(timezone.utc).isoformat()
            },
            "analysis_info": {
                "type": "comprehensive",
                "query": None,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "status": "completed"  # Start as completed so they can open immediately
            }
        }
        
        analysis_manager.save_analysis_metadata(analysis_id, metadata)
        
        # Create empty placeholder results so frontend doesn't throw format errors
        placeholder_results = {
            "analysis_id": analysis_id,
            "field": "Local PDF",
            "field_confidence": 1.0,
            "comprehensive_analysis": {
                "executive_summary": "This local PDF has been opened. You can now annotate it, view it side-by-side, or use the Chat Box to query it.\n\nTo run the full multi-agent AI analysis, click 'Run Full AI Analysis'.",
                "novelty_assessment": None,
                "gap_analysis": None,
                "methodological_evaluation": None,
                "evidence_quality": None,
                "impact_assessment": None,
                "research_opportunities": None,
                "implementation_guide": None,
                "critical_review": None
            }
        }
        analysis_manager.save_analysis_result(analysis_id, "comprehensive", placeholder_results)

        return {
            "analysis_id": analysis_id,
            "message": "Paper opened successfully",
            "status": "opened"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open local paper: {str(e)}")
