import logging
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
    """
    logger.info("🧪 Node: Final Synthesis")
    
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=settings.gemini_temperature
    ).with_structured_output(AnalysisReport)
    
    paper_info = state["parsed_content"].get("metadata", {})
    query_text = f"USER QUERY: {state['user_query']}" if state["user_query"] else ""
    
    prompt_text = SYNTHESIS_PROMPT.format(
        methodology=state["methodology_analysis"],
        results=state["results_analysis"],
        context=state["context_analysis"],
        paper_info=str(paper_info),
        query_text=query_text
    )
    
    try:
        report = await llm.ainvoke(prompt_text)
        
        return {
            "final_report": report,
            "status_updates": [{
                "type": "status",
                "message": "Comprehensive report finalized.",
                "progress": 100
            }]
        }
    except Exception as e:
        # Broad catch is justified to ensure any LLM failure in this terminal node
        # is captured and reported without crashing the entire graph worker.
        logger.error(f"Synthesis failed: {e}")
        return {
            "errors": [f"Synthesis failed: {str(e)}"]
        }
