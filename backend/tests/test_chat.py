import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.routers.chat import ChatRequest, ChatResponse
from app.agents.knowledge_chat_agent import KnowledgeChatAgent

def test_chat_models():
    """Verify ChatRequest and ChatResponse schemas."""
    req = ChatRequest(message="Hello", history=[{"role": "user", "content": "Hi"}])
    assert req.message == "Hello"
    assert len(req.history) == 1
    
    res = ChatResponse(answer="Answer here", sources=["Page 1", "Page 2"])
    assert res.answer == "Answer here"
    assert len(res.sources) == 2


def test_chat_endpoint_delegation(tmp_path):
    """Verify router delegates chat requests to KnowledgeChatAgent."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.analysis_manager import analysis_manager
    
    client = TestClient(app)
    analysis_id = "test-chat-delegation"
    analysis_manager.create_analysis_directory(analysis_id, "paper.pdf")
    paper_path = analysis_manager.get_analysis_file_path(analysis_id, "paper")
    with open(paper_path, "wb") as f:
        f.write(b"%PDF dummy")
        
    analysis_manager.save_analysis_metadata(analysis_id, {
        "analysis_id": analysis_id,
        "paper_info": {"title": "Delegation Test Paper"}
    })
    
    with patch.object(KnowledgeChatAgent, "chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "answer": "Test answer from agent",
            "sources": ["Page 4"]
        }
        
        response = client.post(
            f"/api/v1/analyses/{analysis_id}/chat",
            json={"message": "What is the key takeaway?", "history": []}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "Test answer from agent"
        assert data["sources"] == ["Page 4"]
