import pytest
from unittest.mock import MagicMock, patch
import os
import tempfile

@patch("app.routers.local_papers.settings")
def test_scan_local_papers_success(mock_settings):
    # Create temporary directory with some fake PDFs
    with tempfile.TemporaryDirectory() as temp_dir:
        mock_settings.papers_dir = temp_dir
        
        # Create a mock PDF file
        pdf_path = os.path.join(temp_dir, "machine_learning_paper.pdf")
        with open(pdf_path, 'wb') as f:
            f.write(b"%PDF-1.4 mock content")
            
        # Create a non-PDF file to ensure filtering works
        txt_path = os.path.join(temp_dir, "notes.txt")
        with open(txt_path, 'w') as f:
            f.write("some notes")
            
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        
        # Query list local papers endpoint
        response = client.get("/api/v1/local-papers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["filename"] == "machine_learning_paper.pdf"
        assert data[0]["size_bytes"] > 0
        assert data[0]["absolute_path"] == pdf_path

@patch("app.routers.local_papers.shutil")
@patch("app.routers.local_papers.analysis_manager")
def test_import_local_paper_endpoint(mock_analysis_manager, mock_shutil):
    with tempfile.TemporaryDirectory() as temp_dir:
        pdf_path = os.path.join(temp_dir, "import_paper.pdf")
        with open(pdf_path, 'wb') as f:
            f.write(b"%PDF-1.4 mock content")
            
        mock_analysis_manager.analyses_dir = temp_dir
        mock_analysis_manager.list_analyses.return_value = []
        mock_analysis_manager.create_analysis_directory.return_value = "/fake/workspace"
        mock_analysis_manager.save_analysis_metadata.return_value = "/fake/workspace/metadata.json"
        mock_analysis_manager.save_analysis_result.return_value = "/fake/workspace/result.json"
        # Prevent actual file copy
        mock_shutil.copy2.return_value = None
        
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        
        # Query post import local paper endpoint
        response = client.post(
            "/api/v1/local-papers/open",
            json={"absolute_path": pdf_path}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "opened"
        assert "analysis_id" in data
        assert data["message"] == "Paper opened successfully"

