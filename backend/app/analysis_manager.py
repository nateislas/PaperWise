"""
Analysis Manager
Handles file organization, metadata tracking, and analysis history
"""

import os
import json
import shutil
import uuid
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class AnalysisManager:
    def __init__(self, base_dir: Optional[str] = None):
        upload_dir = base_dir or settings.upload_dir
        self.analyses_dir = os.path.join(upload_dir, "analyses")
        self.temp_dir = os.path.join(upload_dir, "temp")
        self._ensure_directories()
        self._parse_locks: Dict[str, asyncio.Lock] = {}
        self._parse_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pdf-parse")
    
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
            metadata["created_at"] = datetime.now(timezone.utc).isoformat()
        
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
    
    def update_analysis_status(self, analysis_id: str, status: str) -> bool:
        """Update the status of an analysis in its metadata.json"""
        metadata = self.get_analysis_metadata(analysis_id)
        if not metadata:
            return False
        if "analysis_info" not in metadata:
            metadata["analysis_info"] = {}
        metadata["analysis_info"]["status"] = status
        if status == "completed":
            metadata["analysis_info"]["completed_at"] = datetime.now(timezone.utc).isoformat()
        self.save_analysis_metadata(analysis_id, metadata)
        return True
    
    def save_parsed_content(self, analysis_id: str, parsed_content: Dict[str, Any]) -> str:
        """Save parsed content (LiteParse text, chunks, tables, figures) to JSON file"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        os.makedirs(analysis_dir, exist_ok=True)
        content_path = os.path.join(analysis_dir, "parsed_content.json")
        
        serializable_content = dict(parsed_content)
        if "chunks" in serializable_content:
            serialized_chunks = []
            for chunk in serializable_content["chunks"]:
                if hasattr(chunk, "page_content"):
                    serialized_chunks.append({
                        "text": chunk.page_content,
                        "metadata": getattr(chunk, "metadata", {})
                    })
                elif isinstance(chunk, dict):
                    serialized_chunks.append(chunk)
                else:
                    serialized_chunks.append({"text": str(chunk), "metadata": {}})
            serializable_content["chunks"] = serialized_chunks

        with open(content_path, 'w', encoding='utf-8') as f:
            json.dump(serializable_content, f, indent=2, ensure_ascii=False)
            
        return content_path

    def _get_parse_lock(self, analysis_id: str) -> asyncio.Lock:
        if analysis_id not in self._parse_locks:
            self._parse_locks[analysis_id] = asyncio.Lock()
        return self._parse_locks[analysis_id]

    async def get_parsed_content_async(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get parsed content asynchronously, coordinating concurrent misses with a per-analysis lock."""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        content_path = os.path.join(analysis_dir, "parsed_content.json")
        
        # 1. Quick initial cache check
        if os.path.exists(content_path):
            try:
                with open(content_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read parsed_content.json for {analysis_id}: {e}")
        
        # 2. Coordinate concurrent misses with per-analysis lock
        lock = self._get_parse_lock(analysis_id)
        async with lock:
            # Recheck cache after acquiring the lock so only one request parses each PDF
            if os.path.exists(content_path):
                try:
                    with open(content_path, 'r', encoding='utf-8') as f:
                        return json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to read parsed_content.json after lock for {analysis_id}: {e}")
            
            # Fallback: if paper.pdf exists, parse in a bounded worker/thread to avoid blocking event loop
            paper_path = os.path.join(analysis_dir, "paper.pdf")
            if os.path.exists(paper_path):
                def _do_parse():
                    from app.agents.pdf_parser_agent import PDFParserAgent
                    parser = PDFParserAgent()
                    return parser.parse_pdf(paper_path)
                
                try:
                    loop = asyncio.get_running_loop()
                    parse_result = await loop.run_in_executor(self._parse_executor, _do_parse)
                    if parse_result.get("status") == "success" and "parsed_content" in parse_result:
                        parsed_content = parse_result["parsed_content"]
                        self.save_parsed_content(analysis_id, parsed_content)
                        return parsed_content
                except Exception as e:
                    logger.error(f"Fallback async parsing failed for {analysis_id}: {e}")

        return None

    def get_parsed_content(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get parsed content for an analysis, re-parsing on-the-fly if missing"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        content_path = os.path.join(analysis_dir, "parsed_content.json")
        
        if os.path.exists(content_path):
            try:
                with open(content_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read parsed_content.json for {analysis_id}: {e}")
        
        # Fallback: if paper.pdf exists, parse it with PDFParserAgent and cache to disk
        paper_path = os.path.join(analysis_dir, "paper.pdf")
        if os.path.exists(paper_path):
            try:
                from app.agents.pdf_parser_agent import PDFParserAgent
                parser = PDFParserAgent()
                parse_result = parser.parse_pdf(paper_path)
                if parse_result.get("status") == "success" and "parsed_content" in parse_result:
                    parsed_content = parse_result["parsed_content"]
                    self.save_parsed_content(analysis_id, parsed_content)
                    return parsed_content
            except Exception as e:
                logger.error(f"Fallback parsing failed for {analysis_id}: {e}")

        return None

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
                # Format the data to match frontend expectations
                formatted_metadata = self._format_metadata_for_frontend(metadata)
                analyses.append({
                    "analysis_id": analysis_id,
                    **formatted_metadata
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
    
    def _format_metadata_for_frontend(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Format metadata to match frontend expectations"""
        formatted = metadata.copy()
        
        # Ensure paper_info exists
        if "paper_info" not in formatted:
            formatted["paper_info"] = {}
        
        paper_info = formatted["paper_info"]
        
        # Handle authors field - convert string to array if needed
        authors_val = paper_info.get("authors")
        author_str = paper_info.get("author")
        if (not authors_val or len(authors_val) == 0) and author_str and author_str != "Unknown":
            # Split by common delimiters and clean up
            if ";" in author_str:
                authors = [a.strip() for a in author_str.split(";") if a.strip()]
            elif "," in author_str:
                authors = [a.strip() for a in author_str.split(",") if a.strip()]
            elif " and " in author_str:
                authors = [a.strip() for a in author_str.split(" and ") if a.strip()]
            else:
                authors = [author_str.strip()]
            paper_info["authors"] = authors
        elif not authors_val:
            paper_info["authors"] = []

        # Extract venue and year if missing
        if not paper_info.get("venue"):
            if paper_info.get("journal_ref"):
                paper_info["venue"] = paper_info["journal_ref"]
            elif paper_info.get("subject"):
                paper_info["venue"] = paper_info["subject"]
        
        if not paper_info.get("year"):
            date_candidate = paper_info.get("upload_date") or paper_info.get("published") or formatted.get("created_at")
            if date_candidate:
                import re
                year_match = re.search(r'\b(19\d\d|20\d\d)\b', str(date_candidate))
                if year_match:
                    try:
                        paper_info["year"] = int(year_match.group(1))
                    except (ValueError, TypeError):
                        pass

        # Ensure required fields exist with defaults
        if "title" not in paper_info:
            paper_info["title"] = "Unknown Paper"
        if "arxiv_id" not in paper_info:
            paper_info["arxiv_id"] = ""
        if "upload_date" not in paper_info:
            paper_info["upload_date"] = formatted.get("created_at", "")
        
        # Ensure analysis_info exists
        if "analysis_info" not in formatted:
            formatted["analysis_info"] = {
                "type": "comprehensive",
                "status": "unknown",
                "started_at": formatted.get("created_at", ""),
            }
        
        return formatted
    
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
    
    def save_analysis_annotations(self, analysis_id: str, annotations: List[Dict[str, Any]]) -> str:
        """Save annotations to JSON file"""
        analysis_dir = os.path.join(self.analyses_dir, analysis_id)
        annotations_path = os.path.join(analysis_dir, "annotations.json")
        with open(annotations_path, 'w', encoding='utf-8') as f:
            json.dump(annotations, f, indent=2, ensure_ascii=False)
        return annotations_path

    def get_analysis_annotations(self, analysis_id: str) -> List[Dict[str, Any]]:
        """Get annotations for an analysis"""
        annotations_path = os.path.join(self.analyses_dir, analysis_id, "annotations.json")
        if not os.path.exists(annotations_path):
            return []
        try:
            with open(annotations_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

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
        elif file_type == "annotations":
            return os.path.join(analysis_dir, "annotations.json")
        elif file_type == "parsed_content":
            return os.path.join(analysis_dir, "parsed_content.json")
        
        return None


# Global instance
analysis_manager = AnalysisManager()
