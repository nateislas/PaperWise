import logging
import asyncio
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
    """
    logger.info("📄 Node: Parsing PDF")
    
    parser = PDFParserAgent()
    # Wrap sync call in to_thread to avoid blocking the event loop
    result = await asyncio.to_thread(parser.parse_pdf, state["file_path"])
    
    if result["status"] == "error":
        return {
            "errors": [f"Failed to parse PDF: {result.get('error')}"],
            "status_updates": [{"type": "error", "message": "PDF parsing failed"}]
        }
    
    return {
        "documents": result["documents"],
        "parsed_content": result["parsed_content"],
        "status_updates": [{
            "type": "status",
            "message": f"PDF parsed successfully. Created {len(result['documents'])} chunks.",
            "progress": 20
        }]
    }
