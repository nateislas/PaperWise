import pytest
import uuid
from datetime import datetime, timezone
from app.db.models import (
    User,
    Niche,
    UserNiche,
    Paper,
    PaperFile,
    LibraryItem,
    Analysis,
    AxisScoreModel,
    AxisScore,
    ConcernModel,
    Concern,
    AnnotationModel,
    Annotation,
    ChatThreadModel,
    ChatThread,
    ChatMessageModel,
    ChatMessage,
    FeedItemModel,
    FeedItem,
    VerdictSnapshot,
    Outcome,
)

def test_db_models_instantiation():
    u_id = uuid.uuid4()
    u = User(
        id=u_id,
        external_id="user_clerk_123",
        email="researcher@example.com",
        display_name="Dr. Jane Doe",
    )
    assert u.external_id == "user_clerk_123"

    p_id = uuid.uuid4()
    p = Paper(
        id=p_id,
        visibility="public",
        doi="10.1038/s41589-026-0001-x",
        title="Selective lanthanide binding by LanM",
        content_sha256="abc123hash",
    )
    assert p.visibility == "public"

    n_id = uuid.uuid4()
    n = Niche(
        id=n_id,
        slug="comp-protein-science",
        name="Computational protein science",
        status="live",
    )
    assert n.slug == "comp-protein-science"

    un = UserNiche(
        user_id=u_id,
        niche_id=n_id,
        keywords=["lanmodulin", "rare-earth"],
        exclude_terms=["review"],
    )
    assert un.keywords == ["lanmodulin", "rare-earth"]

    pf = PaperFile(
        paper_id=p_id,
        kind="pdf",
        storage_key="papers/paper.pdf",
        filename="paper.pdf",
        bytes=1048576,
    )
    assert pf.kind == "pdf"
    assert pf.bytes == 1048576

    li = LibraryItem(
        user_id=u_id,
        paper_id=p_id,
        added_via="upload",
        tags=["lanthanides", "favorites"],
    )
    assert li.added_via == "upload"

    a_id = uuid.uuid4()
    a = Analysis(
        id=a_id,
        paper_id=p_id,
        rubric_version="2026.09",
        status="completed",
        bottom_line="Paper presents strong evidence.",
        payload={},
    )
    assert a.rubric_version == "2026.09"

    ax = AxisScore(
        analysis_id=a_id,
        axis="methodology",
        level="strong",
        one_line="Robust experimental design with appropriate negative controls.",
        confidence=0.92,
        evidence=[{"page": 3, "section": "Methods", "quote": "Control titrations"}],
    )
    assert ax.level == "strong"
    assert isinstance(ax, AxisScoreModel)

    c = Concern(
        analysis_id=a_id,
        severity="material",
        category="statistics",
        title="Sample size underpowered for subtle affinity shifts",
        detail="Only n=2 biological replicates reported for Fig 3b.",
        affects_axis="evidence",
        rank=1,
    )
    assert c.severity == "material"
    assert isinstance(c, ConcernModel)

    an = Annotation(
        user_id=u_id,
        paper_id=p_id,
        page=4,
        position={"boundingRect": {"x1": 10, "y1": 20, "x2": 100, "y2": 40}},
        quote="LanM exhibits femtomolar affinity",
        note="Check dissociation rate constant in supplement",
        color="yellow",
        style="highlight",
    )
    assert an.page == 4
    assert isinstance(an, AnnotationModel)

    ct_id = uuid.uuid4()
    ct = ChatThread(
        id=ct_id,
        user_id=u_id,
        paper_id=p_id,
    )
    assert ct.user_id == u_id
    assert isinstance(ct, ChatThreadModel)

    cm = ChatMessage(
        thread_id=ct_id,
        role="user",
        content="What was the selectivity ratio against calcium?",
        sources=[],
    )
    assert cm.role == "user"
    assert isinstance(cm, ChatMessageModel)

    fi = FeedItem(
        user_id=u_id,
        paper_id=p_id,
        niche_id=n_id,
        relevance=0.95,
        reason="matches: LanM, selectivity assay",
        state="new",
    )
    assert fi.relevance == 0.95
    assert isinstance(fi, FeedItemModel)

    v = VerdictSnapshot(
        analysis_id=a_id,
        paper_id=p_id,
        rubric_version="2026.09",
        levels={"methodology": "strong", "evidence": "adequate"},
        concern_counts={"blocking": 0, "material": 1},
    )
    assert v.rubric_version == "2026.09"

    o = Outcome(
        paper_id=p_id,
        kind="code_released",
        source="github",
        source_url="https://github.com/diep-lab/lanm-selectivity",
    )
    assert o.kind == "code_released"


def test_alembic_offline_sql_generation(capsys):
    import os
    from alembic.config import Config
    from alembic import command
    
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ini_path = os.path.join(backend_dir, "alembic.ini")
    assert os.path.exists(ini_path), f"alembic.ini missing at {ini_path}"
    
    cfg = Config(ini_path)
    command.upgrade(cfg, "head", sql=True)
    captured = capsys.readouterr()
    
    assert "CREATE TABLE users" in captured.out
    assert "CREATE TABLE papers" in captured.out
    assert "CREATE TABLE analyses" in captured.out
    assert "CREATE TABLE concerns" in captured.out
    assert "001_initial_schema" in captured.out


