import logging
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.agents.graph.state import PaperAnalysisState, FieldClassification
from app.agents.graph.prompts import FIELD_CLASSIFIER_PROMPT

logger = logging.getLogger(__name__)

async def field_classifier_node(state: PaperAnalysisState) -> Dict[str, Any]:
    """
    Classifies the academic field of the paper.
    
    Args:
        state (PaperAnalysisState): The current graph state containing 'documents'.
        
    Returns:
        Dict[str, Any]: A dictionary containing:
            - detected_field (str): The primary field name.
            - field_info (FieldClassification): Structured classification details (on success).
            - status_updates (List[Dict[str, Any]]): Status update for the UI (on success).
            - errors (List[str]): Error messages (on failure).
    """
    logger.info("🔍 Node: Classifying Field")
    
    # Defensive check for documents
    if not state.get("documents"):
        logger.warning("No documents found in state for classification.")
        return {
            "detected_field": "generic",
            "errors": ["No documents available for field classification."]
        }
    
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0
    ).with_structured_output(FieldClassification)
    
    # Use first few chunks for classification to save tokens
    sample_text = "\n\n".join([doc.page_content for doc in state["documents"][:5]])
    
    try:
        classification = await llm.ainvoke([
            {"role": "system", "content": FIELD_CLASSIFIER_PROMPT},
            {"role": "user", "content": f"Analyze this paper text and classify it:\n\n{sample_text}"}
        ])
        
        return {
            "detected_field": classification.field,
            "field_info": classification,
            "status_updates": [{
                "type": "status",
                "message": f"Detected: {classification.field} ({classification.subfield})",
                "progress": 30
            }]
        }
    except Exception as e:
        # Broad catch is justified here because any LLM or network error should be handled 
        # gracefully by falling back to 'generic' and logging the error.
        logger.error(f"Field classification failed: {e}")
        return {
            "detected_field": "generic",
            "errors": [f"Classification failed: {str(e)}"]
        }
