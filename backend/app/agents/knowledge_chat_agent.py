import logging
from typing import Dict, List, Any, Optional
import json
import asyncio

from llama_index.core import Settings
from llama_index.llms.google_genai import GoogleGenAI
from llama_cloud_services import LlamaCloudIndex

from app.config import settings
from app.analysis_manager import analysis_manager

logger = logging.getLogger(__name__)

class KnowledgeChatAgent:
    """
    Expert Agent for chatting about a research paper using LlamaIndex and LlamaCloud Managed RAG.
    Replaces local Chroma indexing with high-performance managed search.
    """
    
    def __init__(self, analysis_id: str):
        self.analysis_id = analysis_id
        
        # Configure LlamaIndex to use Gemini
        Settings.llm = GoogleGenAI(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
            temperature=0.2
        )
        
        self.llama_api_key = settings.llama_cloud_api_key
        self.project_name = settings.llama_cloud_project
        self.organization_id = settings.llama_cloud_org_id
        
        self._index = None
        
    async def get_index(self) -> LlamaCloudIndex:
        """Connect to the LlamaCloud Managed Index."""
        if self._index:
            return self._index
            
        # Get metadata to check if we already have a llama_index_id
        metadata = analysis_manager.get_analysis_metadata(self.analysis_id)
        index_id = metadata.get("llama_index_id") if metadata else None
        
        if index_id:
            logger.info(f"Connecting to existing LlamaCloud index: {index_id}")
            self._index = LlamaCloudIndex(
                id=index_id,
                api_key=self.llama_api_key,
                organization_id=self.organization_id
            )
        else:
            # Fallback: connect by name (collection_name usually matches analysis_id or paper title)
            collection_name = f"paper_{self.analysis_id}"
            logger.info(f"Connecting to LlamaCloud index by name: {collection_name}")
            self._index = await LlamaCloudIndex.acreate_index(
                name=collection_name,
                project_name=self.project_name,
                organization_id=self.organization_id,
                api_key=self.llama_api_key
            )
            
            # Save the index_id back to metadata for future speedup
            if metadata:
                metadata["llama_index_id"] = self._index.id
                analysis_manager.save_analysis_metadata(self.analysis_id, metadata)
                
        return self._index

    async def chat(self, message: str, history: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Process a chat message using LlamaIndex Managed Chat Engine.
        """
        try:
            index = await self.get_index()
            
            # Create chat engine (LlamaCloud handles context and RAG automatically)
            # We use 'context' mode for robust RAG
            chat_engine = index.as_chat_engine(
                chat_mode="context",
                similarity_top_k=5
            )
            
            # Process history (LlamaIndex expects ChatMessage objects)
            from llama_index.core.base.llms.types import ChatMessage, MessageRole
            llama_history = []
            for msg in history[-10:]:
                role = MessageRole.USER if msg["role"] == "user" else MessageRole.ASSISTANT
                llama_history.append(ChatMessage(role=role, content=msg["content"]))
            
            # Execute chat
            logger.info(f"Executing LlamaCloud chat for analysis {self.analysis_id}")
            response = await chat_engine.achat(message, chat_history=llama_history)
            
            # Extract citations from source nodes
            sources = []
            if hasattr(response, 'source_nodes'):
                for node_with_score in response.source_nodes:
                    metadata = node_with_score.node.metadata
                    page = metadata.get("page_label") or metadata.get("start_page_label")
                    if page:
                        sources.append(f"Page {page}")
            
            # Add analysis report context if needed
            # (Note: In this managed version, we rely on the index. 
            # If the user wants specific analysis synthesis, the LLM usually has enough context 
            # from the RAG chunks if the analysis was indexed too.)
            
            return {
                "answer": str(response),
                "sources": list(set(sources)) if sources else ["LlamaCloud RAG"]
            }
            
        except Exception as e:
            logger.error(f"Error in LlamaIndex KnowledgeChatAgent: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise e
