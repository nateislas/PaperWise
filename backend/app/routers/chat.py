from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import re

from app.config import settings
from app.analysis_manager import analysis_manager
from app.agents.knowledge_chat_agent import KnowledgeChatAgent

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

@router.post("/analyses/{analysis_id}/chat", response_model=ChatResponse)
async def chat_with_paper(
    request: ChatRequest,
    analysis_id: str = Path(..., description="Analysis ID")
):
    """
    Query and chat with a research paper using a LangChain Deep Agent
    """
    try:
        # Resolve paper file path
        paper_path = analysis_manager.get_analysis_file_path(analysis_id, "paper")
        if not paper_path or not os.path.exists(paper_path):
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # Check if PageIndex is enabled and user hasn't explicitly disabled it
        # (For now, we prefer our new LangChain agent as it has access to the full report)
        if settings.pageindex_api_key:
            try:
                # PageIndex direct usage (fast, vectorless RAG)
                # We'll keep this as an option or fallback
                pass
            except Exception as pageindex_error:
                import logging
                logging.warning(f"PageIndex failed: {pageindex_error}")
        
        # Initialize and call the LangChain Knowledge Chat Agent
        agent = KnowledgeChatAgent(analysis_id)
        result = await agent.chat(request.message, request.history)
        
        return ChatResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
        
    except Exception as e:
        import logging
        logging.error(f"Error in chat endpoint: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to process chat query: {str(e)}")
