import logging
import asyncio
import time
from datetime import datetime, timezone
from typing import Dict, Any, List
from app.agents.pdf_parser_agent import PDFParserAgent
from app.agents.graph.state import PaperAnalysisState

logger = logging.getLogger(__name__)

async def parse_pdf_node(state: PaperAnalysisState) -> Dict[str, Any]:
    """
    Parses the PDF file into document chunks.
    
    Args:
        state (PaperAnalysisState): The current graph state containing 'file_path'.
        
    Returns:
        Dict[str, Any]: A dictionary containing:
            - documents (List[Document]): The extracted document chunks (on success).
            - parsed_content (Dict[str, Any]): Detailed parsed content (on success).
            - status_updates (List[Dict[str, Any]]): Status update for the UI.
            - errors (List[str]): Error message (on failure).
            - node_provenance (List[Dict[str, Any]]): Provenance entry.
    """
    logger.info("📄 Node: Parsing PDF")
    start_time = time.time()
    
    try:
        parser = PDFParserAgent()
        # Wrap sync call in to_thread to avoid blocking the event loop
        result = await asyncio.to_thread(parser.parse_pdf, state["file_path"])
        elapsed = time.time() - start_time
        
        if result["status"] == "error":
            error_msg = f"Failed to parse PDF: {result.get('error')}"
            return {
                "errors": [error_msg],
                "status_updates": [{"type": "error", "message": "PDF parsing failed"}],
                "node_provenance": [{
                    "node": "parse_pdf",
                    "elapsed_seconds": elapsed,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "failed",
                    "metadata": {"error": error_msg}
                }]
            }
        
        engine = result.get("metadata", {}).get("parser_engine", "liteparse")
        pages_count = result.get("metadata", {}).get("pages", 0)
        chunks_count = len(result["documents"])

        return {
            "documents": result["documents"],
            "parsed_content": result["parsed_content"],
            "status_updates": [{
                "type": "status",
                "message": f"PDF parsed via {engine} ({pages_count} pages, {chunks_count} chunks) in {elapsed:.2f}s.",
                "progress": 20
            }],
            "node_provenance": [{
                "node": "parse_pdf",
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "metadata": {
                    "engine": engine,
                    "pages_count": pages_count,
                    "chunks_count": chunks_count,
                    "file_size": result["parsed_content"].get("metadata", {}).get("file_size", 0),
                    "tables_count": len(result["parsed_content"].get("tables", [])),
                    "figures_count": len(result["parsed_content"].get("figures", []))
                }
            }]
        }
    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = f"Exception during PDF parsing: {str(e)}"
        logger.error(error_msg)
        return {
            "errors": [error_msg],
            "status_updates": [{"type": "error", "message": "PDF parsing failed"}],
            "node_provenance": [{
                "node": "parse_pdf",
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "error",
                "metadata": {"error": error_msg}
            }]
        }

