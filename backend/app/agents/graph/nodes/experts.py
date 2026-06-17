import logging
from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.agents.graph.state import PaperAnalysisState
from app.agents.graph.prompts import METHODOLOGY_PROMPT, RESULTS_PROMPT, CONTEXT_PROMPT

logger = logging.getLogger(__name__)

async def analyze_expert(state: PaperAnalysisState, prompt: str, analysis_key: str, status_msg: str, progress: int) -> Dict[str, Any]:
    """Generic node function for expert analysis agents."""
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=settings.gemini_temperature
    )
    
    # Prepare content
    content = "\n\n".join([doc.page_content for doc in state["documents"]])
    if len(content) > 32000:
        content = content[:16000] + "\n\n[...]\n\n" + content[-16000:]
        
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"User Query: {state['user_query']}\n\nContent:\n{content}" if state['user_query'] else content}
    ]
    
    logger.info(f"🧠 Node: Expert Analysis ({analysis_key})")
    
    # Call LLM (synchronous for now, but state-updating)
    response = await llm.ainvoke(messages)
    
    return {
        analysis_key: response.content,
        "status_updates": [{
            "type": "status",
            "message": status_msg,
            "progress": progress
        }]
    }

async def methodology_node(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert(state, METHODOLOGY_PROMPT, "methodology_analysis", "Methodology audit complete.", 50)

async def results_node(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert(state, RESULTS_PROMPT, "results_analysis", "Results verification complete.", 70)

async def context_node(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert(state, CONTEXT_PROMPT, "context_analysis", "Contextualization complete.", 85)
