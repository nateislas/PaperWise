import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.agents.orchestrator_agent import OrchestratorAgent
from app.config import settings

@pytest.mark.asyncio
async def test_orchestrator_completion_uses_settings_model():
    """Verify orchestrator stream formats final_output using settings without NameError."""
    orchestrator = OrchestratorAgent()
    
    mock_report = MagicMock()
    mock_report.model_dump.return_value = {
        "executive_summary": "Test Summary",
        "verdict": "Solid"
    }
    
    # Mock analysis_graph.astream to simulate graph execution completing with final_report
    mock_events = [
        {"synthesize": {"final_report": mock_report}},
        {"enrich_context": {"enrichment_data": {"citations": 42}}}
    ]
    
    async def mock_astream(*args, **kwargs):
        for ev in mock_events:
            yield ev

    with patch("app.agents.orchestrator_agent.analysis_graph.astream", side_effect=mock_astream):
        chunks = []
        async for chunk in orchestrator.analyze_paper_stream("dummy_path.pdf"):
            chunks.append(chunk)

        complete_chunk = next((c for c in chunks if c.get("type") == "complete"), None)
        assert complete_chunk is not None, f"Expected 'complete' chunk, got: {chunks}"
        assert complete_chunk["status"] == "success"
        
        analysis = complete_chunk["analysis"]
        assert "metadata" in analysis
        # Verify model_used was populated correctly from settings.gemini_model without NameError
        assert analysis["metadata"]["model_used"] == settings.gemini_model
        assert analysis["enrichment"]["citations"] == 42
        assert "parsed_content" not in analysis
        assert "_parsed_content" in complete_chunk


def test_worker_analyze_job_error_handling_does_not_corrupt_celery_state():
    """Verify worker error handling re-raises exception cleanly without calling update_state(state='FAILURE')."""
    from app.worker import analyze_job

    with patch("app.worker.set_state") as mock_set_state, \
         patch("app.worker.publish_update") as mock_publish_update, \
         patch("app.worker.OrchestratorAgent") as mock_orchestrator_cls, \
         patch.object(analyze_job, "update_state") as mock_update_state:

        # Force orchestrator to raise an error during stream
        mock_orch = MagicMock()
        async def failing_stream(*args, **kwargs):
            yield {"type": "error", "message": "Analysis failed: connection timed out"}
        mock_orch.analyze_paper_stream = failing_stream
        mock_orchestrator_cls.return_value = mock_orch

        with patch("os.path.exists", return_value=True):
            with pytest.raises(RuntimeError) as exc_info:
                analyze_job({"job_id": "test-job-123", "file_path": "/app/uploads/test.pdf"})
            
            assert "connection timed out" in str(exc_info.value)
            
            # Verify set_state and publish_update received informative error message
            mock_set_state.assert_called_with("test-job-123", state="error", stage="failed", error="Analysis failed: connection timed out")
            mock_publish_update.assert_called_with("test-job-123", {"type": "error", "error": "Analysis failed: connection timed out"})
            
            # CRITICAL: self.update_state(state='FAILURE') MUST NOT be called because it corrupts Celery's Redis result backend
            failure_calls = [c for c in mock_update_state.call_args_list if c.kwargs.get("state") == "FAILURE"]
            assert len(failure_calls) == 0, f"update_state(state='FAILURE') should not be called, but was called: {failure_calls}"


def test_analysis_manager_update_analysis_status(tmp_path):
    """Verify AnalysisManager.update_analysis_status updates metadata.json with status and timestamp."""
    from app.analysis_manager import AnalysisManager

    manager = AnalysisManager(str(tmp_path))
    analysis_id = "test-analysis-456"
    init_meta = {
        "analysis_id": analysis_id,
        "analysis_info": {"status": "processing"}
    }
    manager.create_analysis_directory(analysis_id, "paper.pdf")
    manager.save_analysis_metadata(analysis_id, init_meta)
    
    success = manager.update_analysis_status(analysis_id, "completed")
    assert success is True
    
    updated = manager.get_analysis_metadata(analysis_id)
    assert updated["analysis_info"]["status"] == "completed"
    assert "completed_at" in updated["analysis_info"]

