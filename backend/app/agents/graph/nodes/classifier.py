import logging
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.agents.graph.state import PaperAnalysisState, FieldClassification
from app.agents.graph.prompts import FIELD_CLASSIFIER_PROMPT

logger = logging.getLogger(__name__)

async def field_classifier_node(state: PaperAnalysisState) -> Dict[str, Any]:
    """Classifies the academic field of the paper."""
    logger.info("🔍 Node: Classifying Field")
    
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
        logger.error(f"Field classification failed: {e}")
        return {
            "detected_field": "generic",
            "errors": [f"Classification failed: {str(e)}"]
        }
