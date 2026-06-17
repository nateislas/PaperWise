import pytest
from fastapi.testclient import TestClient
import os
import shutil
import tempfile

# Configure mock settings before importing app
os.environ["GEMINI_API_KEY"] = "fake-api-key"
os.environ["GEMINI_API_KEY"] = "fake-api-key"

from app.main import app
from app.config import settings
from app.analysis_manager import analysis_manager

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def temp_analyses_dir():
    # Setup temporary directory for analysis manager to isolate filesystem edits
    temp_dir = tempfile.mkdtemp()
    original_dir = analysis_manager.analyses_dir
    original_temp = analysis_manager.temp_dir
    
    analysis_manager.analyses_dir = temp_dir
    analysis_manager.temp_dir = os.path.join(temp_dir, "temp")
    os.makedirs(analysis_manager.temp_dir, exist_ok=True)
    
    yield temp_dir
    
    # Cleanup
    shutil.rmtree(temp_dir)
    analysis_manager.analyses_dir = original_dir
    analysis_manager.temp_dir = original_temp
