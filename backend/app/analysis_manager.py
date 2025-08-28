"""
Analysis Manager
Handles file organization, metadata tracking, and analysis history
"""

import os
import json
import shutil
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from app.config import settings


class AnalysisManager:
    def __init__(self):
        self.analyses_dir = os.path.join(settings.upload_dir, "analyses")
        self.temp_dir = os.path.join(settings.upload_dir, "temp")
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Ensure required directories exist"""
        os.makedirs(self.analyses_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)
    
    def create_analysis_directory(self, analysis_id: str, paper_filename: str) -> str:
        """Create a new analysis directory and return its path"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        os.makedirs(analysis_dir, exist_ok=True)
        
        # Create subdirectories
        os.makedirs(os.path.join(analysis_dir, "results"), exist_ok=True)
        os.makedirs(os.path.join(analysis_dir, "figures"), exist_ok=True)
        os.makedirs(os.path.join(analysis_dir, "logs"), exist_ok=True)
        
        return analysis_dir
    
    def move_paper_to_analysis(self, analysis_id: str, source_path: str, paper_filename: str) -> str:
        """Move uploaded paper to analysis directory"""
        analysis_dir = self.create_analysis_directory(analysis_id, paper_filename)
        dest_path = os.path.join(analysis_dir, "paper.pdf")
        
        # Move the file
        shutil.move(source_path, dest_path)
        return dest_path
    
    def save_analysis_metadata(self, analysis_id: str, metadata: Dict[str, Any]) -> str:
        """Save analysis metadata to JSON file"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        metadata_path = os.path.join(analysis_dir, "metadata.json")
        
        # Add timestamps if not present
        if "created_at" not in metadata:
            metadata["created_at"] = datetime.utcnow().isoformat()
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        return metadata_path
    
    def save_analysis_result(self, analysis_id: str, result_type: str, data: Dict[str, Any]) -> str:
        """Save analysis result to JSON file"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        results_dir = os.path.join(analysis_dir, "results")
        
        result_path = os.path.join(results_dir, f"{result_type}.json")
        
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return result_path
    
    def get_analysis_metadata(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get analysis metadata"""
        metadata_path = os.path.join(self.analyses_dir, analysis_id, "metadata.json")
        
        if not os.path.exists(metadata_path):
            return None
        
        with open(metadata_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_analysis_result(self, analysis_id: str, result_type: str) -> Optional[Dict[str, Any]]:
        """Get analysis result by type"""
        result_path = os.path.join(self.analyses_dir, analysis_id, "results", f"{result_type}.json")
        
        if not os.path.exists(result_path):
            return None
        
        with open(result_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def list_analyses(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """List all analyses with metadata"""
        analyses = []
        
        if not os.path.exists(self.analyses_dir):
            return analyses
        
        # Get all analysis directories
        analysis_dirs = [d for d in os.listdir(self.analyses_dir) 
                        if os.path.isdir(os.path.join(self.analyses_dir, d))]
        
        # Sort by creation time (newest first)
        analysis_dirs.sort(key=lambda x: self._get_analysis_creation_time(x), reverse=True)
        
        # Apply pagination
        analysis_dirs = analysis_dirs[offset:offset + limit]
        
        for analysis_id in analysis_dirs:
            metadata = self.get_analysis_metadata(analysis_id)
            if metadata:
                analyses.append({
                    "analysis_id": analysis_id,
                    **metadata
                })
        
        return analyses
    
    def _get_analysis_creation_time(self, analysis_id: str) -> float:
        """Get analysis creation time for sorting"""
        metadata = self.get_analysis_metadata(analysis_id)
        if metadata and "created_at" in metadata:
            try:
                return datetime.fromisoformat(metadata["created_at"]).timestamp()
            except:
                pass
        
        # Fallback to directory creation time
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        return os.path.getctime(analysis_dir)
    
    def search_analyses(self, query: str) -> List[Dict[str, Any]]:
        """Search analyses by paper title, authors, or arXiv ID"""
        query = query.lower()
        analyses = []
        
        for analysis in self.list_analyses(limit=1000):  # Get all for search
            paper_info = analysis.get("paper_info", {})
            
            # Search in title
            title = paper_info.get("title", "").lower()
            if query in title:
                analyses.append(analysis)
                continue
            
            # Search in authors
            authors = " ".join(paper_info.get("authors", [])).lower()
            if query in authors:
                analyses.append(analysis)
                continue
            
            # Search in arXiv ID
            arxiv_id = paper_info.get("arxiv_id", "").lower()
            if query in arxiv_id:
                analyses.append(analysis)
                continue
        
        return analyses
    
    def delete_analysis(self, analysis_id: str) -> bool:
        """Delete an analysis and all its files"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        
        if not os.path.exists(analysis_dir):
            return False
        
        try:
            shutil.rmtree(analysis_dir)
            return True
        except Exception:
            return False
    
    def get_analysis_file_path(self, analysis_id: str, file_type: str) -> Optional[str]:
        """Get path to analysis file (paper, result, figure, etc.)"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        
        if file_type == "paper":
            return os.path.join(analysis_dir, "paper.pdf")
        elif file_type == "metadata":
            return os.path.join(analysis_dir, "metadata.json")
        elif file_type == "result":
            return os.path.join(analysis_dir, "results", "comprehensive.json")
        elif file_type == "figures":
            return os.path.join(analysis_dir, "figures")
        
        return None


# Global instance
analysis_manager = AnalysisManager()
