from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import RetryPolicy
from app.agents.graph.state import PaperAnalysisState
from app.agents.graph.nodes.parser import parse_pdf_node
from app.agents.graph.nodes.classifier import field_classifier_node
from app.agents.graph.nodes.experts import (
    methodology_node_r1, results_node_r1, context_node_r1,
    debate_sync_node,
    methodology_node_r2, results_node_r2, context_node_r2
)
from app.agents.graph.nodes.synthesis import synthesis_node
from app.agents.graph.nodes.enrichment import enrich_context_node

def route_expert_analysis_r1(state: PaperAnalysisState) -> list[str]:
    """Dynamically routes to R1 expert nodes."""
    field = (state.get("detected_field") or "generic").lower()
    routes = ["analyze_methodology_r1", "analyze_context_r1"]
    
    empirical_indicators = [
        "computer science", "medicine", "biology", "clinical", "experimental",
        "physics", "chemistry", "psychology", "engineering", "materials science",
        "generic"
    ]
    if any(indicator in field for indicator in empirical_indicators):
        routes.append("analyze_results_r1")
    return routes

def route_expert_analysis_r2(state: PaperAnalysisState) -> list[str]:
    """Dynamically routes to R2 expert nodes based on the same field logic."""
    field = (state.get("detected_field") or "generic").lower()
    routes = ["analyze_methodology_r2", "analyze_context_r2"]
    
    empirical_indicators = [
        "computer science", "medicine", "biology", "clinical", "experimental",
        "physics", "chemistry", "psychology", "engineering", "materials science",
        "generic"
    ]
    if any(indicator in field for indicator in empirical_indicators):
        routes.append("analyze_results_r2")
    return routes

def create_analysis_graph():
    """
    Creates and compiles the Paper Analysis graph with modern persistence,
    retry policy, dynamic conditional routing, and post-synthesis external enrichment.
    """
    builder = StateGraph(PaperAnalysisState)
    
    retry_policy = RetryPolicy(
        max_attempts=3,
        backoff_factor=2.0
    )
    
    # Parse & Classify
    builder.add_node("parse_pdf", parse_pdf_node)
    builder.add_node("classify_field", field_classifier_node, retry_policy=retry_policy)
    
    # Round 1 (Drafts)
    builder.add_node("analyze_methodology_r1", methodology_node_r1, retry_policy=retry_policy)
    builder.add_node("analyze_results_r1", results_node_r1, retry_policy=retry_policy)
    builder.add_node("analyze_context_r1", context_node_r1, retry_policy=retry_policy)
    
    # Sync
    builder.add_node("debate_sync", debate_sync_node)
    
    # Round 2 (Revisions)
    builder.add_node("analyze_methodology_r2", methodology_node_r2, retry_policy=retry_policy)
    builder.add_node("analyze_results_r2", results_node_r2, retry_policy=retry_policy)
    builder.add_node("analyze_context_r2", context_node_r2, retry_policy=retry_policy)
    
    # Synthesis & Enrichment
    builder.add_node("synthesize", synthesis_node, retry_policy=retry_policy)
    builder.add_node("enrich_context", enrich_context_node)
    
    # Core Edges
    builder.add_edge(START, "parse_pdf")
    builder.add_edge("parse_pdf", "classify_field")
    
    # R1 Routing (Fan-out)
    builder.add_conditional_edges("classify_field", route_expert_analysis_r1)
    
    # R1 to Sync (Fan-in)
    builder.add_edge("analyze_methodology_r1", "debate_sync")
    builder.add_edge("analyze_results_r1", "debate_sync")
    builder.add_edge("analyze_context_r1", "debate_sync")
    
    # R2 Routing (Fan-out from Sync)
    builder.add_conditional_edges("debate_sync", route_expert_analysis_r2)
    
    # R2 to Synthesis (Fan-in)
    builder.add_edge("analyze_methodology_r2", "synthesize")
    builder.add_edge("analyze_results_r2", "synthesize")
    builder.add_edge("analyze_context_r2", "synthesize")
    
    # Enrichment
    builder.add_edge("synthesize", "enrich_context")
    builder.add_edge("enrich_context", END)
    
    # Setup MemorySaver Checkpointer
    checkpointer = MemorySaver()
    
    # Compile
    return builder.compile(checkpointer=checkpointer)

# Global singleton
analysis_graph = create_analysis_graph()


