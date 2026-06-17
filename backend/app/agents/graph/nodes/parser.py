import logging
from typing import Dict, Any, List
from app.agents.pdf_parser_agent import PDFParserAgent
from app.agents.graph.state import PaperAnalysisState

logger = logging.getLogger(__name__)

async def parse_pdf_node(state: PaperAnalysisState) -> Dict[str, Any]:
    """Parses the PDF file into document chunks."""
    logger.info("📄 Node: Parsing PDF")
    
    parser = PDFParserAgent()
    result = parser.parse_pdf(state["file_path"])
    
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
