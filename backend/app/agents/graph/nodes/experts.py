import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.agents.graph.state import PaperAnalysisState
from app.agents.graph.prompts import METHODOLOGY_PROMPT, RESULTS_PROMPT, CONTEXT_PROMPT

logger = logging.getLogger(__name__)

def _prepare_full_content(state: PaperAnalysisState) -> str:
    """
    Prepares the full, untruncated paper content for analysis,
    prioritizing high-fidelity parsed markdown and structured tables.
    """
    parsed = state.get("parsed_content", {})
    content = parsed.get("text_content", "") if isinstance(parsed, dict) else ""
    
    # Fallback to document chunks if parsed text_content is not available
    if not content and state.get("documents"):
        content = "\n\n".join([doc.page_content for doc in state["documents"]])
        
    # Append structured table data if available
    tables = parsed.get("tables", []) if isinstance(parsed, dict) else []
    if tables:
        table_section = "\n\n## EXTRACTED TABLES\n\n"
        for t in tables:
            page = t.get("page", "Unknown")
            rows = t.get("rows", 0)
            cols = t.get("columns", 0)
            table_section += f"### Table (Page {page}, {rows}x{cols})\n"
            data = t.get("data")
            if data and isinstance(data, list):
                for row in data:
                    if isinstance(row, (list, tuple)):
                        table_section += "| " + " | ".join(str("" if cell is None else cell).replace("\n", " ") for cell in row) + " |\n"
            table_section += "\n"
        content += table_section
        
    return content

async def analyze_expert(state: PaperAnalysisState, prompt: str, analysis_key: str, status_msg: str, progress: int) -> Dict[str, Any]:
    """
    Generic node function for expert analysis agents.
    
    Args:
        state (PaperAnalysisState): The current graph state.
        prompt (str): The system prompt for the specialized expert.
        analysis_key (str): The key in the state where the analysis will be stored.
        status_msg (str): The status message to send to the UI.
        progress (int): The progress percentage to report.
        
    Returns:
        Dict[str, Any]: A dictionary containing the analysis results, status updates, and node_provenance.
    """
    logger.info(f"🧠 Node: Expert Analysis ({analysis_key})")
    start_time = time.time()
    
    # Check if content or documents exist in state
    content = _prepare_full_content(state)
    if not content.strip():
        elapsed = time.time() - start_time
        error_msg = f"No document content provided to expert node {analysis_key}"
        logger.warning(error_msg)
        return {
            analysis_key: f"Analysis skipped: {error_msg}",
            "errors": [error_msg],
            "node_provenance": [{
                "node": analysis_key,
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "failed",
                "metadata": {"error": error_msg}
            }]
        }
    
    try:
        agent_role = analysis_key.replace("_analysis", "").replace("draft_", "")
        thinking_level = settings.get_thinking_level(agent_role)
        llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=settings.gemini_temperature,
            thinking_level=thinking_level
        )
        
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"User Query: {state['user_query']}\n\nFull Paper Content:\n{content}" if state.get('user_query') else f"Full Paper Content:\n{content}"}
        ]
        
        # Call LLM
        response = await llm.ainvoke(messages)
        elapsed = time.time() - start_time

        
        return {
            analysis_key: response.content,
            "status_updates": [{
                "type": "status",
                "message": status_msg,
                "progress": progress
            }],
            "node_provenance": [{
                "node": analysis_key,
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "metadata": {
                    "model": settings.gemini_model,
                    "prompt_tokens_char_length": len(prompt) + len(content),
                    "response_char_length": len(response.content)
                }
            }]
        }
    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = f"Expert Analysis failed for {analysis_key}: {str(e)}"
        logger.error(error_msg)
        
        # Isolate node failure so synthesis node can still produce a partial report
        return {
            analysis_key: f"Analysis failed: {error_msg}",
            "errors": [error_msg],
            "status_updates": [{
                "type": "status",
                "message": f"Expert node {analysis_key} failed, proceeding with synthesis...",
                "progress": progress
            }],
            "node_provenance": [{
                "node": analysis_key,
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "error",
                "metadata": {
                    "model": settings.gemini_model,
                    "error": error_msg
                }
            }]
        }

async def analyze_expert_revision(state: PaperAnalysisState, original_prompt: str, final_key: str, self_draft_key: str, status_msg: str, progress: int) -> Dict[str, Any]:
    """
    Generic node function for expert revision agents (Round 2).
    """
    from app.agents.graph.prompts import REVISION_SYSTEM_PROMPT
    logger.info(f"🧠 Node: Expert Revision ({final_key})")
    start_time = time.time()
    
    try:
        agent_role = final_key.replace("_analysis", "").replace("draft_", "")
        thinking_level = settings.get_thinking_level(agent_role)
        llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=settings.gemini_temperature,
            thinking_level=thinking_level
        )
        
        # Include prepared paper content with extracted tables
        content = _prepare_full_content(state)
        
        # Build drafts context
        drafts_text = f"Your Initial Draft:\n{state.get(self_draft_key, 'None')}\n\n"
        drafts_text += "Other Experts' Drafts:\n"
        if self_draft_key != 'draft_methodology':
            drafts_text += f"--- Methodology Draft ---\n{state.get('draft_methodology', 'None')}\n\n"
        if self_draft_key != 'draft_results':
            drafts_text += f"--- Results Draft ---\n{state.get('draft_results', 'None')}\n\n"
        if self_draft_key != 'draft_context':
            drafts_text += f"--- Context Draft ---\n{state.get('draft_context', 'None')}\n\n"

        user_content = f"Full Paper Content:\n{content}\n\n{drafts_text}"
        if state.get("user_query"):
            user_content = f"User Query: {state['user_query']}\n\n" + user_content

        messages = [
            {"role": "system", "content": f"{original_prompt}\n\n{REVISION_SYSTEM_PROMPT}"},
            {"role": "user", "content": user_content}
        ]
        
        response = await llm.ainvoke(messages)
        elapsed = time.time() - start_time
        
        return {
            final_key: response.content,
            "status_updates": [{
                "type": "status",
                "message": status_msg,
                "progress": progress
            }],
            "node_provenance": [{
                "node": final_key,
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "metadata": {
                    "model": settings.gemini_model,
                }
            }]
        }
    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = f"Revision failed for {final_key}: {str(e)}"
        logger.error(error_msg)
        
        draft_val = state.get(self_draft_key)
        fallback_val = draft_val if draft_val and draft_val.strip() else f"Analysis failed: {error_msg}"
        
        return {
            final_key: fallback_val,
            "errors": [error_msg],
            "status_updates": [{
                "type": "status",
                "message": f"Expert node {final_key} failed, falling back to draft...",
                "progress": progress
            }],
            "node_provenance": [{
                "node": final_key,
                "elapsed_seconds": elapsed,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "error",
                "metadata": {
                    "model": settings.gemini_model,
                    "error": error_msg
                }
            }]
        }

# --- ROUND 1 NODES (DRAFTS) ---

async def methodology_node_r1(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert(state, METHODOLOGY_PROMPT, "draft_methodology", "Methodology draft complete.", 40)

async def results_node_r1(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert(state, RESULTS_PROMPT, "draft_results", "Results draft complete.", 45)

async def context_node_r1(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert(state, CONTEXT_PROMPT, "draft_context", "Context draft complete.", 50)

# --- SYNC NODE ---

async def debate_sync_node(state: PaperAnalysisState) -> Dict[str, Any]:
    """Pass-through node to synchronize R1 before starting R2."""
    return {
        "status_updates": [{
            "type": "status",
            "message": "Cross-critique sync point reached. Starting debates...",
            "progress": 55
        }]
    }

# --- ROUND 2 NODES (REVISIONS) ---

async def methodology_node_r2(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert_revision(state, METHODOLOGY_PROMPT, "methodology_analysis", "draft_methodology", "Methodology final complete.", 65)

async def results_node_r2(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert_revision(state, RESULTS_PROMPT, "results_analysis", "draft_results", "Results final complete.", 75)

async def context_node_r2(state: PaperAnalysisState) -> Dict[str, Any]:
    return await analyze_expert_revision(state, CONTEXT_PROMPT, "context_analysis", "draft_context", "Context final complete.", 85)


