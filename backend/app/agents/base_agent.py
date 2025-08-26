from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from langchain.schema import Document
from langchain.schema import HumanMessage, SystemMessage
import logging
from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    """
    Base class for all specialized analysis agents
    """
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        
        # Initialize Llama client
        self.llama_client = OpenAI(
            api_key=settings.llama_api_key,
            base_url=settings.llama_base_url,
        )
        
        self.system_prompt = self._get_system_prompt()
    
    @abstractmethod
    def _get_system_prompt(self) -> str:
        """Return the system prompt specific to this agent's role"""
        pass
    
    @abstractmethod
    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """Main analysis method to be implemented by each agent"""
        pass
    
    def _create_messages(self, content: str, query: Optional[str] = None) -> List[Dict[str, str]]:
        """Create messages for the Llama API"""
        messages = [{"role": "system", "content": self.system_prompt}]
        
        if query:
            messages.append({"role": "user", "content": f"Query: {query}\n\nContent to analyze:\n{content}"})
        else:
            messages.append({"role": "user", "content": content})
        
        return messages
    
    def _call_llama(self, messages: List[Dict[str, str]]) -> str:
        """Make a call to the Llama API"""
        try:
            response = self.llama_client.chat.completions.create(
                model=settings.llama_model,
                messages=messages,
                temperature=settings.llama_temperature,
                max_tokens=settings.max_tokens_per_request
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error calling Llama API: {str(e)}")
            raise e
    
    def _extract_relevant_sections(self, documents: List[Document], section_keywords: List[str]) -> str:
        """Extract sections relevant to this agent's analysis"""
        relevant_content = []
        
        for doc in documents:
            content = doc.page_content.lower()
            if any(keyword in content for keyword in section_keywords):
                relevant_content.append(doc.page_content)
        
        return "\n\n".join(relevant_content) if relevant_content else ""
    
    def _format_analysis_result(self, analysis: str, confidence: float = 0.8) -> Dict[str, Any]:
        """Format the analysis result with metadata"""
        return {
            "agent": self.name,
            "analysis": analysis,
            "confidence": confidence,
            "timestamp": self._get_timestamp()
        }
    
    def _get_timestamp(self) -> str:
        """Get current timestamp"""
        from datetime import datetime
        return datetime.now().isoformat()
    
    def log_analysis(self, documents_count: int, analysis_length: int):
        """Log analysis activity"""
        logger.info(f"{self.name} analyzed {documents_count} documents, "
                   f"produced {analysis_length} characters of analysis")
