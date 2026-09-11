import pytest
import time
from typing import Dict, Any, List
from unittest.mock import MagicMock, AsyncMock, patch

from langchain_core.documents import Document
from app.agents.graph.builder import route_expert_analysis_r1, route_expert_analysis_r2, create_analysis_graph
from app.agents.graph.state import PaperAnalysisState, FieldClassification, AnalysisReport
from app.agents.graph.nodes.parser import parse_pdf_node
from app.agents.graph.nodes.classifier import field_classifier_node
from app.agents.graph.nodes.experts import analyze_expert, methodology_node_r1, results_node_r1, context_node_r1
from app.agents.graph.nodes.synthesis import synthesis_node

def test_route_expert_analysis():
    # 1. Empirical fields should route to results verification node
    cs_state: PaperAnalysisState = {
        "detected_field": "Computer Science",
        "file_path": "",
        "user_query": None,
        "parsed_content": {},
        "documents": [],
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
        "tool_calls": []
    }
    cs_routes = route_expert_analysis_r1(cs_state)
    assert "analyze_methodology_r1" in cs_routes
    assert "analyze_context_r1" in cs_routes
    assert "analyze_results_r1" in cs_routes

    # 2. Pure theoretical field should skip results verification node
    math_state: PaperAnalysisState = {
        "detected_field": "Pure Mathematics",
        "file_path": "",
        "user_query": None,
        "parsed_content": {},
        "documents": [],
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
        "tool_calls": []
    }
    math_routes = route_expert_analysis_r1(math_state)
    assert "analyze_methodology_r1" in math_routes
    assert "analyze_context_r1" in math_routes
    assert "analyze_results_r1" not in math_routes

def test_graph_compiles_with_checkpointer_and_retries():
    graph = create_analysis_graph()
    assert graph is not None
    # Check that checkpointer is set up
    assert hasattr(graph, "checkpointer")
    assert graph.checkpointer is not None

@pytest.mark.asyncio
@patch("app.agents.graph.nodes.parser.PDFParserAgent")
async def test_parse_pdf_node_provenance(mock_parser_class):
    mock_parser = MagicMock()
    mock_parser.parse_pdf.return_value = {
        "status": "success",
        "documents": [Document(page_content="mock chunk", metadata={"page": 1})],
        "parsed_content": {
            "metadata": {"file_size": 1024}
        }
    }
    mock_parser_class.return_value = mock_parser

    state: PaperAnalysisState = {
        "file_path": "/fake/path.pdf",
        "user_query": None,
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
        "tool_calls": []
    }

    result = await parse_pdf_node(state)
    assert "node_provenance" in result
    provenance = result["node_provenance"][0]
    assert provenance["node"] == "parse_pdf"
    assert provenance["status"] == "success"
    assert provenance["metadata"]["chunks_count"] == 1
    assert provenance["metadata"]["file_size"] == 1024
    assert isinstance(provenance["elapsed_seconds"], float)

@pytest.mark.asyncio
@patch("app.agents.graph.nodes.classifier.ChatGoogleGenerativeAI")
async def test_classifier_node_provenance_and_error_recovery(mock_llm_class):
    # Setup mock LLM behavior for successful run
    mock_llm_instance = MagicMock()
    mock_llm_class.return_value = mock_llm_instance
    
    mock_classification = FieldClassification(
        field="Computer Science",
        subfield="AI",
        conferences=["NeurIPS"],
        confidence=0.95
    )
    mock_llm_instance.with_structured_output.return_value.ainvoke = AsyncMock(return_value=mock_classification)

    state: PaperAnalysisState = {
        "documents": [Document(page_content="test doc")],
        "file_path": "",
        "user_query": None,
        "parsed_content": {},
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
        "tool_calls": []
    }

    result = await field_classifier_node(state)
    assert result["detected_field"] == "Computer Science"
    assert result["node_provenance"][0]["status"] == "success"
    assert result["node_provenance"][0]["metadata"]["confidence"] == 0.95

    # Test error recovery
    mock_llm_instance.with_structured_output.return_value.ainvoke = AsyncMock(side_effect=Exception("API limit reached"))
    error_result = await field_classifier_node(state)
    assert error_result["detected_field"] == "generic"
    assert len(error_result["errors"]) == 1
    assert error_result["node_provenance"][0]["status"] == "error"
    assert "API limit reached" in error_result["node_provenance"][0]["metadata"]["error"]

@pytest.mark.asyncio
@patch("app.agents.graph.nodes.experts.ChatGoogleGenerativeAI")
async def test_expert_node_resiliency(mock_llm_class):
    mock_llm_instance = MagicMock()
    mock_llm_class.return_value = mock_llm_instance
    mock_llm_instance.ainvoke = AsyncMock(side_effect=Exception("Timeout"))

    state: PaperAnalysisState = {
        "documents": [Document(page_content="test methodology")],
        "file_path": "",
        "user_query": None,
        "parsed_content": {},
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

    # Verify that the node runs without raising an exception and degrades gracefully
    result = await methodology_node_r1(state)
    assert "Analysis failed:" in result["draft_methodology"]
    assert "Timeout" in result["draft_methodology"]
    assert len(result["errors"]) == 1
    assert result["node_provenance"][0]["status"] == "error"

def test_prepare_full_content_untruncated_with_tables():
    from app.agents.graph.nodes.experts import _prepare_full_content
    
    state: PaperAnalysisState = {
        "file_path": "",
        "user_query": None,
        "parsed_content": {
            "text_content": "# Comprehensive Research Paper\n\nFull section content...",
            "tables": [
                {
                    "page": 3,
                    "rows": 2,
                    "columns": 2,
                    "data": [["Model", "F1 Score"], ["Baseline", "0.88"]]
                }
            ]
        },
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
    
    content = _prepare_full_content(state)
    assert "Full section content..." in content
    assert "## EXTRACTED TABLES" in content
    assert "### Table (Page 3, 2x2)" in content
    assert "| Model | F1 Score |" in content
    assert "| Baseline | 0.88 |" in content

@pytest.mark.asyncio
async def test_enrich_context_node_graceful():
    from app.agents.graph.nodes.enrichment import enrich_context_node
    from app.config import settings
    
    state: PaperAnalysisState = {
        "file_path": "",
        "user_query": None,
        "parsed_content": {
            "metadata": {"title": "Attention Is All You Need"}
        },
        "documents": [],
        "detected_field": "Computer Science",
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
    
    # 1. Test when external enrichment is disabled by default (no live network calls)
    with patch.object(settings, "enable_external_enrichment", False):
        result_disabled = await enrich_context_node(state)
        assert "enrichment_data" in result_disabled
        assert "node_provenance" in result_disabled
        prov_disabled = result_disabled["node_provenance"][0]
        assert prov_disabled["node"] == "enrich_context"
        assert "status" in prov_disabled
        assert prov_disabled["status"] in ("success", "partial", "degraded", "skipped")
        assert result_disabled["enrichment_data"]["citation_count"] is None
    
    # 2. Test when external enrichment is enabled with mocked SemanticScholar and Exa
    with patch.object(settings, "enable_external_enrichment", True), \
         patch.object(settings, "exa_api_key", "mock-key"), \
         patch("semanticscholar.SemanticScholar") as mock_s2_class, \
         patch("exa_py.Exa") as mock_exa_class:
        
        mock_s2 = MagicMock()
        mock_paper = MagicMock()
        mock_paper.citationCount = 1200
        mock_paper.influentialCitationCount = 450
        mock_paper.url = "https://semanticscholar.org/mock"
        mock_paper.paperId = "mock123"
        mock_results = MagicMock()
        mock_results.items = [mock_paper]
        mock_s2.search_paper.return_value = mock_results
        mock_s2.get_recommended_papers.return_value = []
        mock_s2_class.return_value = mock_s2
        
        mock_exa = MagicMock()
        mock_exa_results = MagicMock()
        mock_exa_results.results = []
        mock_exa.search_and_contents.return_value = mock_exa_results
        mock_exa_class.return_value = mock_exa
        
        result_enabled = await enrich_context_node(state)
        assert "enrichment_data" in result_enabled
        assert "node_provenance" in result_enabled
        prov_enabled = result_enabled["node_provenance"][0]
        assert prov_enabled["node"] == "enrich_context"
        assert "status" in prov_enabled
        assert prov_enabled["status"] in ("success", "partial", "degraded", "skipped")
        assert result_enabled["enrichment_data"]["citation_count"] == 1200

def test_prepare_full_content_falsy_cells_preserved():
    from app.agents.graph.nodes.experts import _prepare_full_content
    
    state: PaperAnalysisState = {
        "file_path": "",
        "user_query": None,
        "parsed_content": {
            "text_content": "Paper text...",
            "tables": [
                {
                    "page": 1,
                    "rows": 2,
                    "columns": 4,
                    "data": [
                        ["Count", "Score", "Active", "Notes"],
                        [0, 0.0, False, None]
                    ]
                }
            ]
        },
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
    
    content = _prepare_full_content(state)
    assert "| Count | Score | Active | Notes |" in content
    assert "| 0 | 0.0 | False |  |" in content

@pytest.mark.asyncio
@patch("app.agents.graph.nodes.experts.ChatGoogleGenerativeAI")
async def test_expert_revision_fallback_and_prompt(mock_llm_class):
    from app.agents.graph.nodes.experts import analyze_expert_revision
    
    mock_llm = MagicMock()
    mock_llm_class.return_value = mock_llm
    
    # 1. Success case: verify paper content and tables are included in user message
    mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="Revised Methodology Evaluation"))
    state_success: PaperAnalysisState = {
        "file_path": "",
        "user_query": "Explain findings",
        "parsed_content": {
            "text_content": "Deep research body...",
            "tables": [{"page": 1, "rows": 1, "columns": 1, "data": [["val"]]}]
        },
        "documents": [],
        "detected_field": "generic",
        "field_info": None,
        "draft_methodology": "Initial Draft Review",
        "draft_results": "Results draft",
        "draft_context": "Context draft",
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
    
    res = await analyze_expert_revision(
        state_success, "METHOD_PROMPT", "methodology_analysis", "draft_methodology", "Done", 65
    )
    assert res["methodology_analysis"] == "Revised Methodology Evaluation"
    assert mock_llm.ainvoke.call_count == 1
    call_messages = mock_llm.ainvoke.call_args[0][0]
    user_msg = next(m["content"] for m in call_messages if m["role"] == "user")
    assert "Full Paper Content:" in user_msg
    assert "Deep research body..." in user_msg
    assert "## EXTRACTED TABLES" in user_msg
    assert "Initial Draft Review" in user_msg
    
    # 2. Error case with non-empty draft: should fall back to draft
    mock_llm.ainvoke = AsyncMock(side_effect=Exception("API failure"))
    state_draft_fallback = dict(state_success)
    state_draft_fallback["draft_methodology"] = "Valid initial draft content"
    
    res_fallback = await analyze_expert_revision(
        state_draft_fallback, "METHOD_PROMPT", "methodology_analysis", "draft_methodology", "Done", 65
    )
    assert res_fallback["methodology_analysis"] == "Valid initial draft content"
    assert len(res_fallback["errors"]) == 1
    
    # 3. Error case with empty/falsy draft: should fall back to error message
    state_empty_draft = dict(state_success)
    state_empty_draft["draft_methodology"] = "   "  # whitespace or empty
    
    res_error = await analyze_expert_revision(
        state_empty_draft, "METHOD_PROMPT", "methodology_analysis", "draft_methodology", "Done", 65
    )
    assert "Analysis failed:" in res_error["methodology_analysis"]
    assert "API failure" in res_error["methodology_analysis"]


