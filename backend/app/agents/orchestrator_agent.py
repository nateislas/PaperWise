import asyncio
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator, Union
import uuid
import time
import json

from app.agents.base_agent import BaseAgent, agent
from app.agents.graph.builder import analysis_graph
from app.agents.graph.state import PaperAnalysisState

logger = logging.getLogger(__name__)

@agent(name="OrchestratorAgent")
class OrchestratorAgent(BaseAgent):
    """
    Main orchestrator agent that coordinates all specialized analysis agents using LangGraph
    """
    
    def __init__(self):
        # We still inherit for basic naming, but logic is moving to the Graph
        super().__init__("Orchestrator", "Main coordinator for comprehensive analysis via LangGraph")
    
    def _get_system_prompt(self) -> str:
        return "Orchestrator for LangGraph Paper Analysis"
    
    async def analyze_paper_stream(self, file_path: str, user_query: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream analysis of a research paper with real-time updates using LangGraph.
        
        Args:
            file_path (str): Path to the PDF file.
            user_query (Optional[str]): Optional user query to guide analysis.
            
        Yields:
            AsyncGenerator[Dict[str, Any], None]: A sequence of status, chunk, and completion events.
        """
        logger.info(f"🎯 ORCHESTRATOR (LANGGRAPH): Starting streaming analysis")
        
        analysis_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Initial State
        full_state: PaperAnalysisState = {
            "file_path": file_path,
            "user_query": user_query,
            "parsed_content": {},
            "documents": [],
            "detected_field": "generic",
            "field_info": None,
            "methodology_analysis": "",
            "results_analysis": "",
            "context_analysis": "",
            "final_report": None,
            "status_updates": [],
            "errors": []
        }
        
        try:
            # Single pass over graph execution to avoid double-processing and API costs
            async for event in analysis_graph.astream(full_state, stream_mode="updates"):
                for node_name, updates in event.items():
                    logger.info(f"📍 Node completed: {node_name}")
                    
                    # Accumulate state locally to track progress for the final report
                    for key, val in updates.items():
                        if key in ["status_updates", "errors"]:
                            full_state[key].extend(val)
                        else:
                            full_state[key] = val
                    
                    # Yield any status updates found in this chunk for real-time UI updates
                    if "status_updates" in updates:
                        for status in updates["status_updates"]:
                            yield {
                                "analysis_id": analysis_id,
                                **status
                            }
                    
                    # Yield specific chunks for UI compatibility (backward compatibility)
                    if node_name == "analyze_methodology" and "methodology_analysis" in updates:
                        yield {"type": "methodology_chunk", "analysis_id": analysis_id, "content": updates["methodology_analysis"], "progress": 50}
                    elif node_name == "analyze_results" and "results_analysis" in updates:
                        yield {"type": "results_chunk", "analysis_id": analysis_id, "content": updates["results_analysis"], "progress": 70}
                    elif node_name == "analyze_context" and "context_analysis" in updates:
                        yield {"type": "contextualization_chunk", "analysis_id": analysis_id, "content": updates["context_analysis"], "progress": 85}

            # Final validation: check if analysis succeeded or failed
            if full_state.get("final_report"):
                report_dict = full_state["final_report"].model_dump()
                
                # Add metadata for UI compatibility
                final_output = {
                    "analysis_id": analysis_id,
                    "comprehensive_analysis": report_dict, 
                    "metadata": {
                        "analysis_timestamp": self._get_timestamp(),
                        "analysis_confidence": 0.9,
                        "model_used": "gemini-1.5-pro"
                    },
                    "field": full_state.get("detected_field"),
                    "paper_info": full_state.get("parsed_content", {}).get("metadata", {})
                }
                
                yield {
                    "type": "complete",
                    "analysis_id": analysis_id,
                    "status": "success",
                    "message": "Analysis completed successfully",
                    "analysis": final_output,
                    "progress": 100,
                    "elapsed_time": time.time() - start_time
                }
            else:
                # Synthesis failed or report is missing
                error_msg = full_state["errors"][-1] if full_state["errors"] else "Analysis finished without generating a final report."
                yield {
                    "type": "error",
                    "analysis_id": analysis_id,
                    "status": "failed",
                    "message": f"Synthesis failed: {error_msg}",
                    "progress": 100,
                    "elapsed_time": time.time() - start_time
                }
                
        except Exception as e:
            logger.error(f"Critical error in LangGraph analysis: {str(e)}")
            yield {
                "type": "error",
                "analysis_id": analysis_id,
                "message": f"Analysis failed: {str(e)}"
            }
    
    def analyze(self, documents: List[Any], query: Optional[str] = None) -> Dict[str, Any]:
        """Required by BaseAgent interface; Orchestrator uses streaming API primarily."""
        return {"status": "ready"}
    
    async def analyze_paper(self, file_path: str, user_query: Optional[str] = None) -> Dict[str, Any]:
        """
        Legacy async method for backward compatibility.
        
        Args:
            file_path (str): Path to PDF.
            user_query (Optional[str]): Query string.
            
        Returns:
            Dict[str, Any]: Final analysis result.
        """
        async for update in self.analyze_paper_stream(file_path, user_query):
            if update.get("type") == "complete":
                return update
            elif update.get("type") == "error":
                return update
        return {"status": "error", "message": "Failed to complete analysis"}
