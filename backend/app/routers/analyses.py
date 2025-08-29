"""
Analyses API Router
Handles listing, viewing, and managing analysis history
"""

from fastapi import APIRouter, HTTPException, Query, Path
from fastapi.responses import FileResponse
from typing import List, Optional
import os

from app.analysis_manager import analysis_manager

router = APIRouter()


@router.get("/analyses")
async def list_analyses(
    limit: int = Query(50, ge=1, le=100, description="Number of analyses to return"),
    offset: int = Query(0, ge=0, description="Number of analyses to skip"),
    search: Optional[str] = Query(None, description="Search query for paper title, authors, or arXiv ID")
):
    """
    List all analyses with optional search and pagination
    """
    try:
        if search:
            analyses = analysis_manager.search_analyses(search)
            # Apply pagination to search results
            analyses = analyses[offset:offset + limit]
        else:
            analyses = analysis_manager.list_analyses(limit=limit, offset=offset)
        
        return {
            "analyses": analyses,
            "total": len(analyses),
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list analyses: {str(e)}")


@router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str = Path(..., description="Analysis ID")):
    """
    Get analysis metadata and summary
    """
    try:
        metadata = analysis_manager.get_analysis_metadata(analysis_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Format metadata for frontend
        formatted_metadata = analysis_manager._format_metadata_for_frontend(metadata)
        
        # Get available result types
        analysis_dir = os.path.join(analysis_manager.analyses_dir, analysis_id, "results")
        result_types = []
        if os.path.exists(analysis_dir):
            result_types = [f.replace('.json', '') for f in os.listdir(analysis_dir) 
                          if f.endswith('.json')]
        
        return {
            "analysis_id": analysis_id,
            **formatted_metadata,
            "available_results": result_types
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analysis: {str(e)}")


@router.get("/analyses/{analysis_id}/results/{result_type}")
async def get_analysis_result(
    analysis_id: str = Path(..., description="Analysis ID"),
    result_type: str = Path(..., description="Result type (comprehensive, methodology, etc.)")
):
    """
    Get specific analysis result
    """
    try:
        result = analysis_manager.get_analysis_result(analysis_id, result_type)
        if not result:
            raise HTTPException(status_code=404, detail="Result not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get result: {str(e)}")


@router.get("/analyses/{analysis_id}/paper")
async def download_paper(analysis_id: str = Path(..., description="Analysis ID")):
    """
    Download the original PDF paper
    """
    try:
        paper_path = analysis_manager.get_analysis_file_path(analysis_id, "paper")
        if not paper_path or not os.path.exists(paper_path):
            raise HTTPException(status_code=404, detail="Paper not found")
        
        metadata = analysis_manager.get_analysis_metadata(analysis_id)
        filename = metadata.get("paper_info", {}).get("original_filename", "paper.pdf")
        
        return FileResponse(
            paper_path,
            media_type="application/pdf",
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download paper: {str(e)}")


@router.get("/analyses/{analysis_id}/figures")
async def list_figures(analysis_id: str = Path(..., description="Analysis ID")):
    """
    List extracted figures for an analysis
    """
    try:
        figures_dir = analysis_manager.get_analysis_file_path(analysis_id, "figures")
        if not figures_dir or not os.path.exists(figures_dir):
            return {"figures": []}
        
        figures = []
        for filename in os.listdir(figures_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                file_path = os.path.join(figures_dir, filename)
                file_size = os.path.getsize(file_path)
                figures.append({
                    "filename": filename,
                    "size": file_size,
                    "url": f"/api/v1/analyses/{analysis_id}/figures/{filename}"
                })
        
        return {"figures": figures}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list figures: {str(e)}")


@router.get("/analyses/{analysis_id}/figures/{filename}")
async def get_figure(
    analysis_id: str = Path(..., description="Analysis ID"),
    filename: str = Path(..., description="Figure filename")
):
    """
    Get a specific figure from an analysis
    """
    try:
        figures_dir = analysis_manager.get_analysis_file_path(analysis_id, "figures")
        if not figures_dir:
            raise HTTPException(status_code=404, detail="Figures directory not found")
        
        figure_path = os.path.join(figures_dir, filename)
        if not os.path.exists(figure_path):
            raise HTTPException(status_code=404, detail="Figure not found")
        
        # Determine content type
        content_type = "image/png"  # Default
        if filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
            content_type = "image/jpeg"
        elif filename.lower().endswith('.gif'):
            content_type = "image/gif"
        
        return FileResponse(
            figure_path,
            media_type=content_type,
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get figure: {str(e)}")


@router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str = Path(..., description="Analysis ID")):
    """
    Delete an analysis and all its files
    """
    try:
        success = analysis_manager.delete_analysis(analysis_id)
        if not success:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        return {"message": "Analysis deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete analysis: {str(e)}")


@router.get("/analyses/stats/summary")
async def get_analysis_stats():
    """
    Get summary statistics about analyses
    """
    try:
        analyses = analysis_manager.list_analyses(limit=1000)  # Get all for stats
        
        total_analyses = len(analyses)
        
        # Count by analysis type
        type_counts = {}
        for analysis in analyses:
            analysis_type = analysis.get("analysis_info", {}).get("type", "unknown")
            type_counts[analysis_type] = type_counts.get(analysis_type, 0) + 1
        
        # Count by status
        status_counts = {}
        for analysis in analyses:
            status = analysis.get("analysis_info", {}).get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            "total_analyses": total_analyses,
            "by_type": type_counts,
            "by_status": status_counts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
