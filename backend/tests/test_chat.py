import pytest
from unittest.mock import MagicMock, patch
import os
from langchain.schema import Document
from app.routers.chat import rank_chunks, ChatRequest

def test_rank_chunks():
    # Setup mock chunks
    chunks = [
        Document(page_content="The machine learning model achieved 95% accuracy.", metadata={"page": 1}),
        Document(page_content="Our baseline method used linear regression.", metadata={"page": 2}),
        Document(page_content="We analyzed the training data distribution.", metadata={"page": 3})
    ]
    
    # Query matching first chunk
    results = rank_chunks("machine learning accuracy", chunks, top_k=2)
    assert len(results) == 2
    assert "accuracy" in results[0].page_content
    
    # Query matching second chunk
    results_baseline = rank_chunks("linear regression baseline", chunks, top_k=1)
    assert len(results_baseline) == 1
    assert "regression" in results_baseline[0].page_content

@patch("app.routers.chat.settings")
@patch("app.routers.chat.OpenAI")
@patch("app.routers.chat.pdf_parser")
@patch("app.routers.chat.analysis_manager")
def test_local_chat_fallback(mock_analysis_manager, mock_pdf_parser, mock_openai, mock_settings):
    # Setup settings to disable PageIndex
    mock_settings.pageindex_api_key = None
    mock_settings.gemini_api_key = "fake-key"
    mock_settings.gemini_base_url = "http://fake-url"
    mock_settings.gemini_model = "fake-model"
    mock_settings.request_timeout = 10
    
    # Setup mocks
    mock_analysis_manager.get_analysis_file_path.return_value = "/fake/paper.pdf"
    os.path.exists = lambda path: True # mock existence check
    
    mock_pdf_parser.parse_pdf.return_value = {
        "status": "success",
        "documents": [
            Document(page_content="Deep neural networks are powerful models.", metadata={"page": 3})
        ]
    }
    
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    mock_completion = MagicMock()
    mock_completion.choices = [
        MagicMock(message=MagicMock(content="Neural networks are indeed powerful."))
    ]
    mock_client.chat.completions.create.return_value = mock_completion
    
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/analyses/test-id/chat",
        json={"message": "Are neural networks powerful?", "history": []}
    )
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["answer"] == "Neural networks are indeed powerful."
    assert "Page 3" in res_data["sources"]

@patch("app.routers.chat.settings")
@patch("pageindex.PageIndexClient")
@patch("app.routers.chat.analysis_manager")
def test_pageindex_chat_success(mock_analysis_manager, mock_pageindex_client_class, mock_settings):
    # Setup PageIndex active settings
    mock_settings.pageindex_api_key = "fake-pi-key"
    
    mock_analysis_manager.get_analysis_file_path.return_value = "/fake/paper.pdf"
    os.path.exists = lambda path: True # mock existence check
    
    mock_analysis_manager.get_analysis_metadata.return_value = {
        "pageindex_doc_id": "doc-abc-123"
    }
    
    # Setup mock PageIndex client
    mock_client = MagicMock()
    mock_pageindex_client_class.return_value = mock_client
    
    # Mock ready check and completion response with inline citations
    mock_client.is_retrieval_ready.return_value = True
    
    mock_completion_payload = {
        "choices": [
            {
                "message": {
                    "content": "The study shows that CNNs outperform other architectures <doc=paper.pdf;page=5> but require more computing power <doc=paper.pdf;page=8>."
                }
            }
        ]
    }
    mock_client.chat_completions.return_value = mock_completion_payload
    
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/analyses/test-id/chat",
        json={"message": "Do CNNs perform well?", "history": []}
    )
    
    assert response.status_code == 200
    res_data = response.json()
    
    # Check that citations are formatted as bracket footnotes [5] and [8]
    assert res_data["answer"] == "The study shows that CNNs outperform other architectures [5] but require more computing power [8]."
    # Check that cited pages are parsed into sources list
    assert "Page 5" in res_data["sources"]
    assert "Page 8" in res_data["sources"]
