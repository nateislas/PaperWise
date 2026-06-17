from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, AsyncGenerator
from langchain.schema import Document
from langchain.schema.messages import HumanMessage, SystemMessage, BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI
import logging
import asyncio
import time

from app.config import settings

# No-op decorators (AgentOps removed)
def agent(name=None):
    def decorator(cls):
        return cls
    return decorator

def operation(func):
    return func

def tool(name=None, cost=None):
    def decorator(func):
        return func
    return decorator


logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    """
    Base class for all specialized analysis agents using LangChain's Google Generative AI integration
    """
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        
        # Initialize LangChain Gemini client
        self.llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=settings.gemini_temperature,
            timeout=settings.request_timeout,
            max_retries=2,
            streaming=True
        )
        
        self.system_prompt = self._get_system_prompt()
    
    @abstractmethod
    def _get_system_prompt(self) -> str:
        """Return the system prompt specific to this agent's role"""
        pass
    
    @abstractmethod
    @operation
    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """Main analysis method to be implemented by each agent"""
        pass
    
    @operation
    async def analyze_stream(self, documents: List[Document], query: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Streaming analysis method for real-time responses"""
        logger.info(f"🎯 {self.name}: Starting streaming analysis")
        
        try:
            content = self._prepare_content_for_analysis(documents, query)
            messages = self._create_messages(content, query)
            
            chunk_count = 0
            async for chunk in self._call_llm_stream(messages):
                chunk_count += 1
                yield chunk
                
            logger.info(f"✅ {self.name}: Streaming analysis completed with {chunk_count} chunks")
                
        except Exception as e:
            logger.error(f"❌ Error in streaming analysis for {self.name}: {str(e)}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            yield f"Error in {self.name} analysis: {str(e)}"
    
    def _prepare_content_for_analysis(self, documents: List[Document], query: Optional[str] = None) -> str:
        """Prepare content for analysis with smart chunking"""
        if not documents:
            return ""
        
        # Combine all document content
        content_parts = []
        for doc in documents:
            content_parts.append(doc.page_content)
        
        combined_content = "\n\n".join(content_parts)
        
        # If content is too long, truncate intelligently
        max_content_length = 32000  # Leave room for system prompt and response
        if len(combined_content) > max_content_length:
            half_length = max_content_length // 2
            combined_content = (
                combined_content[:half_length] + 
                "\n\n[Content truncated for analysis...]\n\n" + 
                combined_content[-half_length:]
            )
        
        return combined_content
    
    def _create_messages(self, content: str, query: Optional[str] = None) -> List[BaseMessage]:
        """Create messages for the LangChain LLM"""
        messages = [SystemMessage(content=self.system_prompt)]
        
        if query:
            messages.append(HumanMessage(content=f"Query: {query}\n\nContent to analyze:\n{content}"))
        else:
            messages.append(HumanMessage(content=content))
        
        return messages
    
    @tool(name="LLMCall")
    async def _call_llm(self, messages: List[BaseMessage]) -> str:
        """Asynchronous call to the configured LLM"""
        start_time = time.time()
        
        try:
            response = await self.llm.ainvoke(messages)
            elapsed_time = time.time() - start_time
            logger.info(f"{self.name} API call completed in {elapsed_time:.2f}s")
            return response.content
        except Exception as e:
            logger.error(f"Error calling LLM for {self.name}: {str(e)}")
            raise e
    
    @tool(name="LLMStream")
    async def _call_llm_stream(self, messages: List[BaseMessage]) -> AsyncGenerator[str, None]:
        """Streaming call to the configured LLM"""
        start_time = time.time()
        chunk_count = 0
        
        try:
            buffer = ""
            async for chunk in self.llm.astream(messages):
                if chunk.content:
                    content = chunk.content
                    buffer += content
                    
                    if len(buffer) >= settings.stream_chunk_size:
                        chunk_count += 1
                        yield buffer
                        buffer = ""
                        await asyncio.sleep(0.005)
            
            if buffer:
                chunk_count += 1
                yield buffer
            
            elapsed_time = time.time() - start_time
            logger.info(f"✅ {self.name} streaming API call completed in {elapsed_time:.2f}s with {chunk_count} chunks")
            
        except Exception as e:
            logger.error(f"❌ Error in streaming LLM call for {self.name}: {str(e)}")
            yield f"Error in {self.name} analysis: {str(e)}"
    
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

