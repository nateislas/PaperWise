from langgraph.graph import StateGraph, START, END
from app.agents.graph.state import PaperAnalysisState
from app.agents.graph.nodes.parser import parse_pdf_node
from app.agents.graph.nodes.classifier import field_classifier_node
from app.agents.graph.nodes.experts import methodology_node, results_node, context_node
from app.agents.graph.nodes.synthesis import synthesis_node

def create_analysis_graph():
    """
    Creates and compiles the Paper Analysis graph.
    
    Returns:
        The compiled state graph object for paper analysis.
    """
    
    # Initialize Graph
    builder = StateGraph(PaperAnalysisState)
    
    # Add Nodes
    builder.add_node("parse_pdf", parse_pdf_node)
    builder.add_node("classify_field", field_classifier_node)
    builder.add_node("analyze_methodology", methodology_node)
    builder.add_node("analyze_results", results_node)
    builder.add_node("analyze_context", context_node)
    builder.add_node("synthesize", synthesis_node)
    
    # Define Edges
    builder.add_edge(START, "parse_pdf")
    builder.add_edge("parse_pdf", "classify_field")
    
    # Parallel Expert Analysis (Fan-out)
    builder.add_edge("classify_field", "analyze_methodology")
    builder.add_edge("classify_field", "analyze_results")
    builder.add_edge("classify_field", "analyze_context")
    
    # Synthesis (Fan-in)
    # The synthesis node will only run once all three parallel analysis nodes have completed.
    builder.add_edge("analyze_methodology", "synthesize")
    builder.add_edge("analyze_results", "synthesize")
    builder.add_edge("analyze_context", "synthesize")
    
    builder.add_edge("synthesize", END)
    
    # Compile
    return builder.compile()

# Global singleton
analysis_graph = create_analysis_graph()
