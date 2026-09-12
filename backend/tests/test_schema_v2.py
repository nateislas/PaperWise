import pytest
from app.schemas.schema_v2 import (
    AnalysisV2,
    AxisScore,
    Concern,
    Level,
    Severity,
    Category,
    Evidence,
    RUBRIC_VERSION,
    rank_concerns,
    reconcile,
)

def test_rubric_v2_schema_instantiation():
    analysis = AnalysisV2(
        rubric_version=RUBRIC_VERSION,
        bottom_line="This paper presents a strong novel approach to protein design with minor limitations in baseline comparison.",
        field="Biotechnology",
        subfield="Protein Engineering",
        field_confidence=0.95,
        methodology=AxisScore(
            level=Level.STRONG,
            one_line="Robust experimental setup with clear controls.",
            confidence=0.9,
            evidence=[Evidence(page=3, section="Methods", quote="Controlled at 25C")],
        ),
        evidence=AxisScore(
            level=Level.ADEQUATE,
            one_line="Sufficient experimental data.",
            confidence=0.85,
        ),
        reproducibility=AxisScore(
            level=Level.WEAK,
            one_line="Source code repository not provided.",
            confidence=0.9,
        ),
        novelty=AxisScore(
            level=Level.STRONG,
            one_line="Highly novel backbone sampling algorithm.",
            confidence=0.95,
        ),
        concerns=[
            Concern(
                severity=Severity.MATERIAL,
                category=Category.REPRODUCIBILITY,
                title="Missing Source Code Link",
                detail="The paper mentions custom scripts but provides no GitHub URL.",
                affects_axis="reproducibility",
            ),
            Concern(
                severity=Severity.BLOCKING,
                category=Category.BASELINES,
                title="Missing Key Baseline Comparison",
                detail="Does not compare against RFdiffusion baseline.",
                affects_axis="methodology",
            ),
        ],
        what_they_did="Designed novel alpha-helical barrels",
        what_they_found="Achieved sub-angstrom RMSD",
        why_it_matters="Enables custom ligand binder design",
        where_this_could_go="In vivo therapeutic targeting",
        full_summary="Full summary of the paper...",
        confidence=0.92,
    )

    assert analysis.rubric_version == "2026.09"
    assert len(analysis.concerns) == 2

    # Test concern ranking (blocking first)
    ranked = rank_concerns(analysis.concerns)
    assert ranked[0].severity == Severity.BLOCKING
    assert ranked[0].rank == 0
    assert ranked[1].rank == 1

    # Test reconciliation
    reconciled = reconcile(analysis)
    assert reconciled.methodology.level == Level.WEAK  # Upgraded due to blocking concern

    # Test backward compatibility dict and executive_summary property
    assert analysis.executive_summary == "Full summary of the paper..."
    comp_dict = analysis.to_comprehensive_dict()
    assert comp_dict["rubric_version"] == "2026.09"
    assert comp_dict["executive_summary"] == "Full summary of the paper..."
    assert comp_dict["methodological_evaluation"]["rigor_assessment"] == "weak"
    assert comp_dict["evidence_quality"]["overall_quality"] == "adequate"
    assert comp_dict["novelty_assessment"]["novelty_score"] == "strong"
    assert len(comp_dict["critical_review"]["major_concerns"]) == 2


@pytest.mark.asyncio
async def test_synthesis_node_with_analysis_v2():
    from unittest.mock import AsyncMock, patch
    from app.agents.graph.nodes.synthesis import synthesis_node
    
    mock_v2_report = AnalysisV2(
        rubric_version=RUBRIC_VERSION,
        bottom_line="Evidence robustly supports primary findings.",
        field="Computer Science",
        subfield="Artificial Intelligence",
        field_confidence=0.99,
        methodology=AxisScore(
            level=Level.STRONG,
            one_line="Rigorous evaluation on standard benchmarks.",
            confidence=0.9,
            evidence=[Evidence(page=5, section="Experiments", quote="Tested on 5 seeds")],
        ),
        evidence=AxisScore(
            level=Level.STRONG,
            one_line="Statistically significant improvement.",
            confidence=0.9,
        ),
        reproducibility=AxisScore(
            level=Level.ADEQUATE,
            one_line="Code and weights released.",
            confidence=0.85,
        ),
        novelty=AxisScore(
            level=Level.STRONG,
            one_line="First demonstrated application to graph routing.",
            confidence=0.95,
        ),
        concerns=[
            Concern(
                severity=Severity.MINOR,
                category=Category.STATISTICS,
                title="Error bars omitted on figure 4",
                detail="Figure 4 shows means without standard deviation.",
            ),
            Concern(
                severity=Severity.BLOCKING,
                category=Category.METHODOLOGY,
                title="Data leakage in cross-validation split",
                detail="Test split was leaked during preprocessing.",
                affects_axis="methodology",
            ),
        ],
        what_they_did="Introduced GraphRoute architecture",
        what_they_found="Achieved 14% speedup",
        why_it_matters="Reduces GPU memory footprints",
        where_this_could_go="Hardware accelerator compilers",
        full_summary="GraphRoute optimizes graph transformations on device.",
        confidence=0.95,
    )

    dummy_state = {
        "file_path": "paper.pdf",
        "user_query": None,
        "parsed_content": {"metadata": {"title": "GraphRoute"}},
        "methodology_analysis": "Strong methodology.",
        "results_analysis": "Good results.",
        "context_analysis": "Novel context.",
        "status_updates": [],
        "errors": [],
        "node_provenance": [],
    }

    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = mock_v2_report

    with patch("app.agents.graph.nodes.synthesis.ChatGoogleGenerativeAI") as mock_cls:
        mock_instance = mock_cls.return_value
        mock_instance.with_structured_output.return_value = mock_llm

        res = await synthesis_node(dummy_state)
        
        assert "final_report" in res
        final_rep = res["final_report"]
        assert isinstance(final_rep, AnalysisV2)
        # Verify concern ranking was executed (blocking first)
        assert final_rep.concerns[0].severity == Severity.BLOCKING
        assert final_rep.concerns[0].rank == 0
        # Verify reconciliation was executed
        assert final_rep.methodology.level == Level.WEAK
        assert res["node_provenance"][0]["status"] == "success"

