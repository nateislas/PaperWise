from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, AsyncGenerator
from langchain.schema import Document
from langchain.schema import HumanMessage, SystemMessage
import logging
from openai import OpenAI
import asyncio
import time
import concurrent.futures

from app.config import settings

logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    """
    Base class for all specialized analysis agents
    """
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        
        # Initialize Llama client with performance optimizations
        self.llama_client = OpenAI(
            api_key=settings.llama_api_key,
            base_url=settings.llama_base_url,
            timeout=settings.request_timeout,
            max_retries=2,
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
    
    async def analyze_stream(self, documents: List[Document], query: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Streaming analysis method for real-time responses"""
        logger.info(f"🎯 {self.name}: Starting streaming analysis")
        logger.info(f"📄 Documents count: {len(documents)}")
        logger.info(f"❓ Query: {query}")
        
        try:
            content = self._prepare_content_for_analysis(documents, query)
            logger.info(f"📝 {self.name}: Prepared content length: {len(content)}")
            
            messages = self._create_messages(content, query)
            logger.info(f"💬 {self.name}: Created {len(messages)} messages")
            
            chunk_count = 0
            async for chunk in self._call_llama_stream(messages):
                chunk_count += 1
                logger.info(f"📤 {self.name}: Yielding analysis chunk #{chunk_count} (length: {len(chunk)})")
                yield chunk
                
            logger.info(f"✅ {self.name}: Streaming analysis completed with {chunk_count} chunks")
                
        except Exception as e:
            logger.error(f"❌ Error in streaming analysis for {self.name}: {str(e)}")
            logger.error(f"❌ Exception type: {type(e).__name__}")
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
            # Keep the beginning and end, truncate middle
            half_length = max_content_length // 2
            combined_content = (
                combined_content[:half_length] + 
                "\n\n[Content truncated for analysis...]\n\n" + 
                combined_content[-half_length:]
            )
        
        return combined_content
    
    def _create_messages(self, content: str, query: Optional[str] = None) -> List[Dict[str, str]]:
        """Create messages for the Llama API"""
        messages = [{"role": "system", "content": self.system_prompt}]
        
        if query:
            messages.append({"role": "user", "content": f"Query: {query}\n\nContent to analyze:\n{content}"})
        else:
            messages.append({"role": "user", "content": content})
        
        return messages
    
    def _call_llama(self, messages: List[Dict[str, str]]) -> str:
        """Synchronous call to Llama API"""
        start_time = time.time()
        
        try:
            response = self.llama_client.chat.completions.create(
                model=settings.llama_model,
                messages=messages,
                temperature=settings.llama_temperature,
                max_tokens=settings.max_tokens_per_request,
                timeout=settings.request_timeout
            )
            
            elapsed_time = time.time() - start_time
            logger.info(f"{self.name} API call completed in {elapsed_time:.2f}s")
            
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error calling Llama API for {self.name}: {str(e)}")
            raise e
    
    async def _call_llama_stream(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        """Streaming call to Llama API"""
        start_time = time.time()
        chunk_count = 0
        
        logger.info(f"🎯 {self.name}: Starting streaming API call")
        
        try:
            # Make the API call in a thread to avoid blocking the event loop
            response = await asyncio.to_thread(
                self.llama_client.chat.completions.create,
                model=settings.llama_model,
                messages=messages,
                temperature=settings.llama_temperature,
                max_tokens=settings.max_tokens_per_request,
                timeout=settings.request_timeout,
                stream=True
            )
            
            buffer = ""
            # Process the synchronous iterator directly - this is the correct approach
            for chunk in response:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    buffer += content
                    
                    # Yield when buffer reaches chunk size
                    if len(buffer) >= settings.stream_chunk_size:
                        chunk_count += 1
                        logger.info(f"📤 {self.name}: Yielding chunk #{chunk_count} (length: {len(buffer)})")
                        yield buffer
                        buffer = ""
                        # Small delay to prevent overwhelming
                        await asyncio.sleep(0.005)
            
            # Yield any remaining content
            if buffer:
                chunk_count += 1
                logger.info(f"📤 {self.name}: Yielding final chunk #{chunk_count} (length: {len(buffer)})")
                yield buffer
            
            elapsed_time = time.time() - start_time
            logger.info(f"✅ {self.name} streaming API call completed in {elapsed_time:.2f}s with {chunk_count} chunks")
            
        except Exception as e:
            logger.error(f"❌ Error in streaming Llama API call for {self.name}: {str(e)}")
            logger.error(f"❌ Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
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
