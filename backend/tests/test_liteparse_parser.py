import pytest
import os
from unittest.mock import patch, MagicMock
from app.agents.pdf_parser_agent import PDFParserAgent
from app.agents.graph.nodes.parser import parse_pdf_node
from app.config import settings

SAMPLE_PDF = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads", "d2850446-6915-4e79-b5d9-76645c9a9e1d_Attention_Is_All_You_Need.pdf")
)

@pytest.mark.skipif(not os.path.exists(SAMPLE_PDF), reason="Sample PDF not present on disk")
def test_liteparse_extracts_markdown_from_pdf():
    """Verify LiteParse parses digital research paper into markdown chunks with page metadata."""
    agent = PDFParserAgent()
    result = agent.parse_pdf(SAMPLE_PDF)

    assert result["status"] == "success"
    assert result["metadata"]["parser_engine"] == "liteparse"
    assert len(result["documents"]) > 0

    # Validate that page metadata is correctly indexed (1-based)
    for doc in result["documents"]:
        assert "page" in doc.metadata
        assert doc.metadata["page"] >= 1
        assert len(doc.page_content) > 0

    # Validate markdown formatting (headings / table pipes preserved)
    text = result["parsed_content"]["text_content"]
    assert "--- Page 1 ---" in text
    assert "# Attention Is All You Need" in text or "Attention Is All You Need" in text
    assert "|" in text  # Markdown table syntax


@pytest.mark.skipif(not os.path.exists(SAMPLE_PDF), reason="Sample PDF not present on disk")
def test_liteparse_disabled_falls_back_to_pymupdf():
    """Verify parser gracefully falls back to PyMuPDF when LiteParse is disabled in settings."""
    with patch.object(settings, "enable_liteparse", False):
        agent = PDFParserAgent()
        result = agent.parse_pdf(SAMPLE_PDF)

        assert result["status"] == "success"
        assert result["metadata"]["parser_engine"] == "pymupdf"
        assert len(result["documents"]) > 0
        assert "--- Page 1 ---" in result["parsed_content"]["text_content"]


@pytest.mark.skipif(not os.path.exists(SAMPLE_PDF), reason="Sample PDF not present on disk")
def test_liteparse_exception_falls_back_to_pymupdf():
    """Verify parser gracefully falls back to PyMuPDF if LiteParse raises an unexpected error."""
    with patch("liteparse.LiteParse.parse", side_effect=RuntimeError("Simulated Rust panic")):
        agent = PDFParserAgent()
        result = agent.parse_pdf(SAMPLE_PDF)

        assert result["status"] == "success"
        assert result["metadata"]["parser_engine"] == "pymupdf"
        assert len(result["documents"]) > 0


@pytest.mark.asyncio
@pytest.mark.skipif(not os.path.exists(SAMPLE_PDF), reason="Sample PDF not present on disk")
async def test_parse_pdf_node_provenance_and_speed():
    """Verify the LangGraph node parse_pdf_node records LiteParse provenance and completes rapidly."""
    state = {"file_path": SAMPLE_PDF}
    result = await parse_pdf_node(state)

    assert "documents" in result
    assert "parsed_content" in result
    assert "status_updates" in result
    assert "node_provenance" in result

    prov = result["node_provenance"][0]
    assert prov["node"] == "parse_pdf"
    assert prov["status"] == "success"
    assert prov["metadata"]["engine"] == "liteparse"
    assert prov["elapsed_seconds"] < 60.0  # LiteParse OCR on local CPU finishes in < 60s
