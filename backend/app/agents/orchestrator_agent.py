import asyncio
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator, Union
import uuid
import time
import json

from app.agents.base_agent import BaseAgent, agent
from app.agents.graph.builder import analysis_graph
from app.agents.graph.state import PaperAnalysisState
from app.config import settings

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
            "draft_methodology": "",
            "draft_results": "",
            "draft_context": "",
            "methodology_analysis": "",
            "results_analysis": "",
            "context_analysis": "",
            "final_report": None,
            "status_updates": [],
            "errors": [],
            "node_provenance": [],
            "tool_calls": [],
            "enrichment_data": {}
        }
        
        try:
            # Yield immediate initial status so frontend receives feedback within milliseconds
            yield {
                "type": "status",
                "stage": "parsing",
                "analysis_id": analysis_id,
                "message": "Extracting document structure & high-resolution figures...",
                "progress": 5
            }

            # Single pass over graph execution to avoid double-processing and API costs
            # Configured with thread_id to allow MemorySaver checkpointer persistence
            config = {"configurable": {"thread_id": analysis_id}}
            async for event in analysis_graph.astream(full_state, config=config, stream_mode="updates"):
                for node_name, updates in event.items():
                    logger.info(f"📍 Node completed: {node_name}")
                    
                    # Accumulate state locally to track progress for the final report
                    for key, val in updates.items():
                        if key in ["status_updates", "errors", "node_provenance", "tool_calls"]:
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
                    
                    # Stage transitions & progress updates
                    if node_name == "parse_pdf":
                        yield {
                            "type": "status",
                            "stage": "classification",
                            "analysis_id": analysis_id,
                            "message": "Classifying research domain & calibrating evaluation rubrics...",
                            "progress": 25
                        }
                    elif node_name == "classify_field":
                        field_name = updates.get("detected_field", full_state.get("detected_field", "generic"))
                        yield {
                            "type": "status",
                            "stage": "round_1_debate",
                            "analysis_id": analysis_id,
                            "message": f"Domain: {field_name.title()}. Round 1: Specialized agents drafting initial analyses...",
                            "progress": 35
                        }
                    elif node_name == "debate_sync":
                        yield {
                            "type": "status",
                            "stage": "cross_critique",
                            "analysis_id": analysis_id,
                            "message": "Synchronizing expert drafts for cross-peer critique & debate...",
                            "progress": 60
                        }
                    elif node_name == "synthesize":
                        yield {
                            "type": "status",
                            "stage": "synthesis",
                            "analysis_id": analysis_id,
                            "message": "Synthesizing comprehensive structured research report...",
                            "progress": 90
                        }
                    elif node_name == "enrich_context":
                        yield {
                            "type": "status",
                            "stage": "enrichment",
                            "analysis_id": analysis_id,
                            "message": "Finalizing analysis report and citations...",
                            "progress": 96
                        }

                    # Yield specific chunks for UI compatibility (backward compatibility)
                    if node_name in ("analyze_methodology", "analyze_methodology_r1", "analyze_methodology_r2"):
                        content = updates.get("methodology_analysis") or updates.get("draft_methodology")
                        if content:
                            is_revised = "methodology_analysis" in updates
                            progress = 70 if is_revised else 42
                            stage = "round_2_debate" if is_revised else "round_1_debate"
                            yield {"type": "methodology_chunk", "analysis_id": analysis_id, "content": content, "progress": progress, "stage": stage}
                    elif node_name in ("analyze_results", "analyze_results_r1", "analyze_results_r2"):
                        content = updates.get("results_analysis") or updates.get("draft_results")
                        if content:
                            is_revised = "results_analysis" in updates
                            progress = 76 if is_revised else 48
                            stage = "round_2_debate" if is_revised else "round_1_debate"
                            yield {"type": "results_chunk", "analysis_id": analysis_id, "content": content, "progress": progress, "stage": stage}
                    elif node_name in ("analyze_context", "analyze_context_r1", "analyze_context_r2"):
                        content = updates.get("context_analysis") or updates.get("draft_context")
                        if content:
                            is_revised = "context_analysis" in updates
                            progress = 84 if is_revised else 54
                            stage = "round_2_debate" if is_revised else "round_1_debate"
                            yield {"type": "contextualization_chunk", "analysis_id": analysis_id, "content": content, "progress": progress, "stage": stage}

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
                        "model_used": settings.gemini_model,
                        "provenance": full_state.get("node_provenance", []),
                        "tool_calls": full_state.get("tool_calls", []),
                        "enrichment": full_state.get("enrichment_data", {})
                    },
                    "field": full_state.get("detected_field"),
                    "paper_info": full_state.get("parsed_content", {}).get("metadata", {}),
                    "enrichment": full_state.get("enrichment_data", {})
                }

                parsed_content = full_state.get("parsed_content", {})
                if parsed_content and analysis_id:
                    try:
                        from app.analysis_manager import analysis_manager
                        analysis_manager.save_parsed_content(analysis_id, parsed_content)
                    except Exception as pe:
                        logger.warning(f"Could not directly save parsed_content for {analysis_id}: {pe}")
                
                yield {
                    "type": "complete",
                    "analysis_id": analysis_id,
                    "status": "success",
                    "message": "Analysis completed successfully",
                    "analysis": final_output,
                    "_parsed_content": parsed_content,
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
            logger.error(f"Critical error in LangGraph analysis: {str(e)}", exc_info=True)
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
