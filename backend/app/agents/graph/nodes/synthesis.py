import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.agents.graph.state import PaperAnalysisState, AnalysisReport
from app.agents.graph.prompts import SYNTHESIS_PROMPT

logger = logging.getLogger(__name__)

async def synthesis_node(state: PaperAnalysisState) -> Dict[str, Any]:
    """
    Synthesizes expert analyses into a final structured report.
    
    Args:
        state (PaperAnalysisState): The current graph state containing expert analysis strings.
        
    Returns:
        Dict[str, Any]: A dictionary containing:
            - final_report (AnalysisReport): The structured Pydantic report object (on success).
            - status_updates (List[Dict[str, Any]]): Final status update (on success).
            - errors (List[str]): Error message (on failure).
            - node_provenance (List[Dict[str, Any]]): Provenance entry.
    """
    logger.info("🧪 Node: Final Synthesis")
    start_time = time.time()
    
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=settings.gemini_temperature
    ).with_structured_output(AnalysisReport)
    
    paper_info = state["parsed_content"].get("metadata", {}) if state.get("parsed_content") else {}
    query_text = f"USER QUERY: {state['user_query']}" if state.get("user_query") else ""
    
    # Safe retrieval of expert analyses with descriptive fallbacks if skipped or failed
    methodology = state.get("methodology_analysis") or "Methodology analysis not generated or skipped."
    results = state.get("results_analysis") or "Results verification not generated, skipped, or not applicable."
    context = state.get("context_analysis") or "Contextualization not generated or skipped."
    
    prompt_text = SYNTHESIS_PROMPT.format(
        methodology=methodology,
        results=results,
        context=context,
        paper_info=str(paper_info),
        query_text=query_text
    )
    
    try:
        report = await llm.ainvoke(prompt_text)
        elapsed = time.time() - start_time
        
        return {
            "final_report": report,
            "status_updates": [{
                "type": "status",
                "message": "Comprehensive report finalized.",
                "progress": 100
            }],
            "node_provenance": [{
                "node": "synthesize",
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "metadata": {
                    "model": settings.gemini_model,
                    "prompt_char_length": len(prompt_text),
                    "report_summary_char_length": len(report.executive_summary) if report else 0
                }
            }]
        }
    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = f"Synthesis failed: {str(e)}"
        logger.error(error_msg)
        return {
            "errors": [error_msg],
            "node_provenance": [{
                "node": "synthesize",
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "error",
                "metadata": {
                    "model": settings.gemini_model,
                    "error": error_msg
                }
            }]
        }

