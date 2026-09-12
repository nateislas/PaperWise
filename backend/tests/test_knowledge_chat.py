import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import os
import json
from langchain_core.messages import AIMessage

from app.analysis_manager import AnalysisManager
from app.agents.knowledge_chat_agent import KnowledgeChatAgent

def test_analysis_manager_save_and_get_parsed_content(tmp_path):
    """Test saving and retrieving parsed_content.json via AnalysisManager."""
    manager = AnalysisManager(str(tmp_path))
    analysis_id = "test-chat-analysis-1"
    manager.create_analysis_directory(analysis_id, "paper.pdf")
    
    mock_parsed = {
        "text_content": "Full extracted text of the paper...",
        "chunks": [
            {"text": "Attention is all you need.", "metadata": {"page": 1}},
            {"text": "The Transformer uses multi-head self-attention.", "metadata": {"page": 3}}
        ],
        "tables": [
            {"page": 4, "markdown": "| Model | BLEU |\n|---|---|\n| Transformer | 28.4 |"}
        ],
        "figures": [
            {"page": 2, "description": "The Transformer architecture", "ocr_text": "Scaled Dot-Product Attention"}
        ]
    }
    
    # Save
    saved_path = manager.save_parsed_content(analysis_id, mock_parsed)
    assert os.path.exists(saved_path)
    assert saved_path.endswith("parsed_content.json")
    
    # Retrieve
    retrieved = manager.get_parsed_content(analysis_id)
    assert retrieved is not None
    assert retrieved["text_content"] == mock_parsed["text_content"]
    assert len(retrieved["chunks"]) == 2
    assert retrieved["chunks"][1]["text"] == "The Transformer uses multi-head self-attention."
    assert retrieved["tables"][0]["page"] == 4
    assert retrieved["figures"][0]["page"] == 2


def test_knowledge_chat_agent_tools():
    """Test individual tools built by KnowledgeChatAgent."""
    agent = KnowledgeChatAgent("test-id")
    
    mock_parsed = {
        "text_content": "Full text...",
        "chunks": [
            {"text": "Lanmodulin exhibits picomolar affinity for neodymium.", "page": 3},
            {"text": "Chromatography separation factors reached 4.5.", "page": 7}
        ],
        "tables": [
            {"page": 5, "markdown": "| REE | Kd (pM) |\n| Nd | 12 |"}
        ],
        "figures": [
            {"page": 6, "description": "Titration curves", "ocr_text": "Fluorescence intensity vs Nd concentration"}
        ]
    }
    mock_comprehensive = {
        "comprehensive_analysis": {
            "executive_summary": "Study of lanmodulin selectivity.",
            "methodological_evaluation": {
                "strengths": "Rigorous isothermal calorimetry",
                "limitations": "Fixed pH 5.5 without low pH validation"
            },
            "evidence_quality": {
                "empirical_support": "High confidence binding data"
            },
            "overall_verdict": "Accepted with minor revisions"
        }
    }
    mock_metadata = {
        "paper_info": {
            "title": "Lanmodulin Selectivity Portrait",
            "author": "Patrick Diep",
            "pages": 28
        },
        "detected_field": "Biochemistry",
        "enrichment": {
            "citation_count": 88,
            "venue": "Nature Chemistry"
        }
    }
    
    tools = agent._build_tools(mock_parsed, mock_comprehensive, mock_metadata)
    assert len(tools) == 4
    tool_map = {t.name: t for t in tools}
    
    # 1. Test retrieve_paper_chunks
    chunk_res = tool_map["retrieve_paper_chunks"].invoke({"query": "picomolar affinity"})
    assert "Page 3" in chunk_res
    assert "Lanmodulin exhibits picomolar affinity" in chunk_res
    
    # Test page filter in retrieve_paper_chunks
    filtered_res = tool_map["retrieve_paper_chunks"].invoke({"query": "separation", "page_number": 7})
    assert "Page 7" in filtered_res
    assert "Page 3" not in filtered_res
    
    # Regression coverage: unmatched query
    unmatched_res = tool_map["retrieve_paper_chunks"].invoke({"query": "quantum superstring non-existent"})
    assert "No text passages found matching query" in unmatched_res
    
    # Regression coverage: absent page number
    absent_page_res = tool_map["retrieve_paper_chunks"].invoke({"query": "affinity", "page_number": 999})
    assert "No text passages found on Page 999" in absent_page_res

    # 2. Test lookup_analysis_report
    method_res = tool_map["lookup_analysis_report"].invoke({"section": "methodology"})
    assert "Rigorous isothermal calorimetry" in method_res
    assert "Fixed pH 5.5" in method_res
    
    verdict_res = tool_map["lookup_analysis_report"].invoke({"section": "verdict"})
    assert "Accepted with minor revisions" in verdict_res
    
    # 3. Test lookup_tables_and_figures
    table_res = tool_map["lookup_tables_and_figures"].invoke({"query": "Kd"})
    assert "Table on Page 5" in table_res
    assert "Nd | 12" in table_res
    
    fig_res = tool_map["lookup_tables_and_figures"].invoke({"query": "Titration"})
    assert "Figure on Page 6" in fig_res
    assert "Fluorescence intensity" in fig_res
    
    # 4. Test get_paper_metadata
    meta_res = tool_map["get_paper_metadata"].invoke({})
    assert "Lanmodulin Selectivity Portrait" in meta_res
    assert "Patrick Diep" in meta_res
    assert "Biochemistry" in meta_res
    assert "88" in meta_res


@pytest.mark.asyncio
async def test_analysis_manager_get_parsed_content_async_concurrent(tmp_path):
    """Test get_parsed_content_async handles concurrent cache misses with lock and cache recheck."""
    manager = AnalysisManager(str(tmp_path))
    analysis_id = "test-concurrent-parse"
    manager.create_analysis_directory(analysis_id, "paper.pdf")
    paper_path = os.path.join(manager.analyses_dir, analysis_id, "paper.pdf")
    with open(paper_path, "wb") as f:
        f.write(b"%PDF-1.4 dummy")

    parse_call_count = 0

    def mock_parse_pdf(path):
        nonlocal parse_call_count
        parse_call_count += 1
        return {
            "status": "success",
            "parsed_content": {
                "text_content": "Parsed async content",
                "chunks": [{"text": "Chunk 1", "page": 1}]
            }
        }

    with patch("app.agents.pdf_parser_agent.PDFParserAgent.parse_pdf", side_effect=mock_parse_pdf):
        import asyncio
        results = await asyncio.gather(
            manager.get_parsed_content_async(analysis_id),
            manager.get_parsed_content_async(analysis_id),
            manager.get_parsed_content_async(analysis_id)
        )
        
        for r in results:
            assert r is not None
            assert r["text_content"] == "Parsed async content"
        
        # Lock + cache recheck ensures parsing is only invoked ONCE across concurrent requests
        assert parse_call_count == 1


@pytest.mark.asyncio
async def test_knowledge_chat_agent_chat():
    """Test KnowledgeChatAgent.chat invoking agent and extracting verified citations."""
    agent = KnowledgeChatAgent("test-id")
    
    mock_parsed = {
        "chunks": [{"text": "Sample text", "page": 4}]
    }
    mock_comprehensive = {
        "comprehensive_analysis": {"executive_summary": "Summary"}
    }
    mock_metadata = {"paper_info": {"title": "Test Title"}}
    
    # Mock data loading
    agent._load_data = AsyncMock(return_value=(mock_parsed, mock_comprehensive, mock_metadata))
    
    # Mock create_react_agent
    mock_agent_runnable = MagicMock()
    mock_agent_runnable.ainvoke = AsyncMock(return_value={
        "messages": [
            MagicMock(content="--- [Page 99] ---\nUnreferenced tool passage"),
            AIMessage(content="According to the authors [Page 4], the binding affinity was confirmed. However, our Methodological Evaluation notes concerns about sample sizes [Page 8].")
        ]
    })
    
    with patch("app.agents.knowledge_chat_agent.create_react_agent", return_value=mock_agent_runnable):
        res = await agent.chat(
            message="What was the binding affinity?",
            history=[{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello!"}]
        )
        
        assert "answer" in res
        assert "sources" in res
        assert "Page 4" in res["answer"]
        
        sources = res["sources"]
        assert "Page 4" in sources
        assert "Page 8" in sources
        assert "Methodology Evaluation" in sources
        # Verify unreferenced tool output pages like Page 99 are NOT included in sources
        assert "Page 99" not in sources

    # Test with Gemini structured content block format (list of dicts with extras/signature)
    mock_agent_runnable.ainvoke = AsyncMock(return_value={
        "messages": [
            AIMessage(content=[
                {
                    "type": "text",
                    "text": "The methodology is robust [Methodology Evaluation].",
                    "extras": {"signature": "CtkCARFNMg9n09d5..."}
                }
            ])
        ]
    })
    with patch("app.agents.knowledge_chat_agent.create_react_agent", return_value=mock_agent_runnable):
        res = await agent.chat("Summarize methodology")
        assert res["answer"] == "The methodology is robust [Methodology Evaluation]."
        assert "extras" not in res["answer"]
        assert "Methodology Evaluation" in res["sources"]


def test_extract_text_content():
    """Verify _extract_text_content handles all Gemini block formats cleanly."""
    # 1. Plain string
    assert KnowledgeChatAgent._extract_text_content("Simple string") == "Simple string"
    
    # 2. List of dicts (Gemini standard)
    gemini_blocks = [
        {"type": "text", "text": "Hello ", "extras": {"signature": "123"}},
        {"type": "text", "text": "World!", "extras": {"signature": "456"}}
    ]
    assert KnowledgeChatAgent._extract_text_content(gemini_blocks) == "Hello World!"
    
    # 3. Stringified list representation
    str_repr = "[{'type': 'text', 'text': 'The methodology is robust.', 'extras': {'signature': 'xyz'}}]"
    assert KnowledgeChatAgent._extract_text_content(str_repr) == "The methodology is robust."
    
    # 4. None / Empty
    assert KnowledgeChatAgent._extract_text_content(None) == ""
    assert KnowledgeChatAgent._extract_text_content([]) == ""


def test_chat_api_endpoint(tmp_path):
    """Test POST /api/v1/analyses/{analysis_id}/chat endpoint."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.analysis_manager import analysis_manager
    
    client = TestClient(app)
    
    # Setup test analysis in temp directory
    analysis_id = "test-api-chat"
    analysis_manager.create_analysis_directory(analysis_id, "paper.pdf")
    paper_path = analysis_manager.get_analysis_file_path(analysis_id, "paper")
    with open(paper_path, "wb") as f:
        f.write(b"%PDF-1.4 dummy pdf content")
        
    analysis_manager.save_analysis_metadata(analysis_id, {
        "analysis_id": analysis_id,
        "paper_info": {"title": "Endpoint Test Paper"}
    })
    
    # Mock KnowledgeChatAgent.chat
    with patch.object(KnowledgeChatAgent, "chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "answer": "The transformer uses self-attention [Page 3].",
            "sources": ["Page 3"]
        }
        
        response = client.post(
            f"/api/v1/analyses/{analysis_id}/chat",
            json={"message": "How does attention work?", "history": []}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "The transformer uses self-attention [Page 3]."
        assert data["sources"] == ["Page 3"]
        
    # Non-existent paper returns 404
    resp_404 = client.post(
        "/api/v1/analyses/non-existent-id/chat",
        json={"message": "Hello"}
    )
    assert resp_404.status_code == 404


@pytest.mark.asyncio
async def test_granular_citations_and_source_details():
    """Verify granular citations with page and section titles produce structured source_details."""
    agent = KnowledgeChatAgent("test-granular-id")
    
    mock_parsed = {
        "chunks": [
            {
                "text": "SpyCI-LAMBS assay details...",
                "page": 2,
                "section": "Quantifying selectivity by SpyCI-LAMBS",
                "snippet": "Our goal was to miniaturize the column-based approach"
            },
            {
                "text": "LanM ortholog selectivity...",
                "page": 7,
                "section": "C5 LanMs reject lanthanum",
                "snippet": "Melba-LanM achieved 94.7 mol% La purity"
            }
        ]
    }
    agent._load_data = AsyncMock(return_value=(mock_parsed, {}, {}))
    
    mock_agent_runnable = MagicMock()
    mock_agent_runnable.ainvoke = AsyncMock(return_value={
        "messages": [
            AIMessage(content="We developed SpyCI-LAMBS [Page 2: Quantifying selectivity by SpyCI-LAMBS]. Melba-LanM rejected lanthanum [Page 7: C5 LanMs reject lanthanum]. Overall, the review is positive [Critical Review].")
        ]
    })
    
    with patch("app.agents.knowledge_chat_agent.create_react_agent", return_value=mock_agent_runnable):
        res = await agent.chat("Tell me about SpyCI-LAMBS")
        
        assert "sources" in res
        assert "source_details" in res
        
        sources = res["sources"]
        assert "Page 2: Quantifying selectivity by SpyCI-LAMBS" in sources
        assert "Page 7: C5 LanMs reject lanthanum" in sources
        assert "Critical Review" in sources
        
        details = res["source_details"]
        assert len(details) == 3
        
        p2_detail = next(d for d in details if d.get("page") == 2)
        assert p2_detail["section"] == "Quantifying selectivity by SpyCI-LAMBS"
        assert p2_detail["snippet"] == "Our goal was to miniaturize the column-based approach"
        assert p2_detail["type"] == "pdf"
        
        p7_detail = next(d for d in details if d.get("page") == 7)
        assert p7_detail["section"] == "C5 LanMs reject lanthanum"
        assert p7_detail["snippet"] == "Melba-LanM achieved 94.7 mol% La purity"
        assert p7_detail["type"] == "pdf"
        
        cr_detail = next(d for d in details if d.get("type") == "report")
        assert cr_detail["section"] == "Critical Review"

