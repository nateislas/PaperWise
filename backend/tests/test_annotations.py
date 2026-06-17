import pytest
import os
import json
from app.analysis_manager import analysis_manager

def test_annotations_endpoints(client, temp_analyses_dir):
    analysis_id = "test-analysis-123"
    
    # Pre-create the directory and metadata to satisfy check_if_analysis_exists
    analysis_manager.create_analysis_directory(analysis_id, "paper.pdf")
    analysis_manager.save_analysis_metadata(analysis_id, {
        "paper_info": {
            "original_filename": "paper.pdf",
            "title": "Test Paper"
        }
    })
    
    # 1. Get annotations when none exist (should return empty list)
    response = client.get(f"/api/v1/analyses/{analysis_id}/annotations")
    assert response.status_code == 200
    assert response.json() == {"annotations": []}
    
    # 2. Save new annotations
    new_annotations = [
        {"id": "note-1", "page": 2, "text": "This methodology is robust."},
        {"id": "note-2", "page": 4, "text": "Interesting results table."}
    ]
    payload = {"annotations": new_annotations}
    
    response = client.post(
        f"/api/v1/analyses/{analysis_id}/annotations",
        json=payload
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # 3. Retrieve them again and verify content match
    response = client.get(f"/api/v1/analyses/{analysis_id}/annotations")
    assert response.status_code == 200
    retrieved = response.json()["annotations"]
    assert len(retrieved) == 2
    assert retrieved[0]["id"] == "note-1"
    assert retrieved[0]["page"] == 2
    assert retrieved[0]["text"] == "This methodology is robust."
    
    # 4. Verify local file persistence
    file_path = os.path.join(temp_analyses_dir, analysis_id, "annotations.json")
    assert os.path.exists(file_path)
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        assert len(data) == 2
        assert data[0]["id"] == "note-1"
