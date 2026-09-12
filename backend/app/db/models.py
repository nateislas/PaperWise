import uuid
from datetime import date, datetime, timezone
from typing import Optional, List, Any
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Integer,
    BigInteger,
    Float,
    Numeric,
    DateTime,
    Date,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    onboarded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

class Niche(Base):
    __tablename__ = "niches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="waitlist")
    sources: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

class UserNiche(Base):
    __tablename__ = "user_niches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    niche_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("niches.id"), nullable=False)
    keywords: Mapped[List[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    exclude_terms: Mapped[List[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    seed_paper_ids: Mapped[List[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    __table_args__ = (UniqueConstraint("user_id", "niche_id", name="uq_user_niche"),)

class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visibility: Mapped[str] = mapped_column(String, nullable=False, default="private")
    owner_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    doi: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    arxiv_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    biorxiv_doi: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    content_sha256: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    authors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    venue: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    abstract: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    code_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

class LibraryItem(Base):
    __tablename__ = "library_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    added_via: Mapped[str] = mapped_column(String, nullable=False, default="upload")
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    last_opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    __table_args__ = (UniqueConstraint("user_id", "paper_id", name="uq_user_paper_library"),)

class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    rubric_version: Mapped[str] = mapped_column(String, nullable=False, default="2026.09")
    status: Mapped[str] = mapped_column(String, nullable=False)
    stage: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bottom_line: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    field: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    subfield: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    field_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    cost_cents: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

class VerdictSnapshot(Base):
    __tablename__ = "verdict_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    rubric_version: Mapped[str] = mapped_column(String, nullable=False)
    levels: Mapped[dict] = mapped_column(JSONB, nullable=False)
    concern_counts: Mapped[dict] = mapped_column(JSONB, nullable=False)
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

class Outcome(Base):
    __tablename__ = "outcomes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (UniqueConstraint("paper_id", "kind", "source_url", name="uq_paper_outcome"),)


class PaperFile(Base):
    __tablename__ = "paper_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # 'pdf' | 'parsed' | 'figure' | 'thumbnail'
    storage_key: Mapped[str] = mapped_column(String, nullable=False)  # s3 key or local path
    filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    sha256: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    page: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # figures only
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class AxisScoreModel(Base):
    __tablename__ = "axis_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    axis: Mapped[str] = mapped_column(String, nullable=False)  # 'methodology'|'evidence'|'reproducibility'|'novelty'|'independent'
    level: Mapped[str] = mapped_column(String, nullable=False)
    one_line: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    evidence: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    __table_args__ = (UniqueConstraint("analysis_id", "axis", name="uq_analysis_axis"),)


class ConcernModel(Base):
    __tablename__ = "concerns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)  # 'blocking' | 'material' | 'minor'
    category: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    affects_axis: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    evidence: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (Index("idx_concerns_by_analysis", "analysis_id", "rank"),)


class AnnotationModel(Base):
    __tablename__ = "annotations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[dict] = mapped_column(JSONB, nullable=False)
    quote: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String, nullable=False, default="yellow")
    style: Mapped[str] = mapped_column(String, nullable=False, default="highlight")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("idx_annotations_user_paper", "user_id", "paper_id", "page"),)


class ChatThreadModel(Base):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # 'user' | 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    context: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class FeedItemModel(Base):
    __tablename__ = "feed_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    niche_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("niches.id"), nullable=False)
    relevance: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    surfaced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    state: Mapped[str] = mapped_column(String, nullable=False, default="new")  # 'new'|'seen'|'saved'|'dismissed'

    __table_args__ = (
        UniqueConstraint("user_id", "paper_id", name="uq_user_paper_feed"),
        Index("idx_feed_user_new", "user_id", "surfaced_at"),
    )


# Convenience Aliases
AxisScore = AxisScoreModel
Concern = ConcernModel
Annotation = AnnotationModel
ChatThread = ChatThreadModel
ChatMessage = ChatMessageModel
FeedItem = FeedItemModel
