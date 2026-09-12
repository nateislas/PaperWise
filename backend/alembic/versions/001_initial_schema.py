"""Initial schema migration for PaperWise V1 redesign

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-12 13:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision: str = '001_initial_schema'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('external_id', sa.String(), nullable=False, unique=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('onboarded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('settings', JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 2. niches
    op.create_table(
        'niches',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('slug', sa.String(), nullable=False, unique=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='waitlist'),
        sa.Column('sources', JSONB(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 3. user_niches
    op.create_table(
        'user_niches',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('niche_id', UUID(as_uuid=True), sa.ForeignKey('niches.id'), nullable=False),
        sa.Column('keywords', ARRAY(sa.String()), nullable=False, server_default='{}'),
        sa.Column('exclude_terms', ARRAY(sa.String()), nullable=False, server_default='{}'),
        sa.Column('seed_paper_ids', ARRAY(UUID(as_uuid=True)), nullable=False, server_default='{}'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'niche_id', name='uq_user_niche'),
    )

    # 4. papers
    op.create_table(
        'papers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('visibility', sa.String(), nullable=False, server_default='private'),
        sa.Column('owner_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('doi', sa.String(), nullable=True),
        sa.Column('arxiv_id', sa.String(), nullable=True),
        sa.Column('biorxiv_doi', sa.String(), nullable=True),
        sa.Column('content_sha256', sa.String(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('authors', JSONB(), nullable=False, server_default='[]'),
        sa.Column('venue', sa.String(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('published_at', sa.Date(), nullable=True),
        sa.Column('abstract', sa.Text(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('source_url', sa.Text(), nullable=True),
        sa.Column('code_url', sa.Text(), nullable=True),
        sa.Column('data_url', sa.Text(), nullable=True),
        sa.Column('metadata', JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 5. library_items
    op.create_table(
        'library_items',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('added_via', sa.String(), nullable=False, server_default='upload'),
        sa.Column('added_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tags', ARRAY(sa.String()), nullable=False, server_default='{}'),
        sa.UniqueConstraint('user_id', 'paper_id', name='uq_user_paper_library'),
    )

    # 6. analyses
    op.create_table(
        'analyses',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rubric_version', sa.String(), nullable=False, server_default='2026.09'),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('stage', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('bottom_line', sa.Text(), nullable=True),
        sa.Column('field', sa.String(), nullable=True),
        sa.Column('subfield', sa.String(), nullable=True),
        sa.Column('field_confidence', sa.Float(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('payload', JSONB(), nullable=False, server_default='{}'),
        sa.Column('cost_cents', sa.Numeric(10, 3), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 7. verdict_snapshots
    op.create_table(
        'verdict_snapshots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rubric_version', sa.String(), nullable=False),
        sa.Column('levels', JSONB(), nullable=False),
        sa.Column('concern_counts', JSONB(), nullable=False),
        sa.Column('taken_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 8. outcomes
    op.create_table(
        'outcomes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('source_url', sa.Text(), nullable=True),
        sa.Column('detail', JSONB(), nullable=False, server_default='{}'),
        sa.UniqueConstraint('paper_id', 'kind', 'source_url', name='uq_paper_outcome'),
    )

    # 9. paper_files
    op.create_table(
        'paper_files',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('storage_key', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('bytes', sa.BigInteger(), nullable=True),
        sa.Column('sha256', sa.String(), nullable=True),
        sa.Column('page', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 10. axis_scores
    op.create_table(
        'axis_scores',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('axis', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('one_line', sa.Text(), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('evidence', JSONB(), nullable=False, server_default='[]'),
        sa.UniqueConstraint('analysis_id', 'axis', name='uq_analysis_axis'),
    )

    # 11. concerns
    op.create_table(
        'concerns',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('title', sa.String(80), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('affects_axis', sa.String(), nullable=True),
        sa.Column('evidence', JSONB(), nullable=False, server_default='[]'),
        sa.Column('rank', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('idx_concerns_by_analysis', 'concerns', ['analysis_id', 'rank'])

    # 12. annotations
    op.create_table(
        'annotations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('page', sa.Integer(), nullable=False),
        sa.Column('position', JSONB(), nullable=False),
        sa.Column('quote', sa.Text(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('color', sa.String(), nullable=False, server_default='yellow'),
        sa.Column('style', sa.String(), nullable=False, server_default='highlight'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_annotations_user_paper', 'annotations', ['user_id', 'paper_id', 'page'])

    # 13. chat_threads
    op.create_table(
        'chat_threads',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 14. chat_messages
    op.create_table(
        'chat_messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('thread_id', UUID(as_uuid=True), sa.ForeignKey('chat_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('sources', JSONB(), nullable=False, server_default='[]'),
        sa.Column('context', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 15. feed_items
    op.create_table(
        'feed_items',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('niche_id', UUID(as_uuid=True), sa.ForeignKey('niches.id'), nullable=False),
        sa.Column('relevance', sa.Float(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('surfaced_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('state', sa.String(), nullable=False, server_default='new'),
        sa.UniqueConstraint('user_id', 'paper_id', name='uq_user_paper_feed'),
    )
    op.create_index('idx_feed_user_new', 'feed_items', ['user_id', 'surfaced_at'])


def downgrade() -> None:
    op.drop_index('idx_feed_user_new', table_name='feed_items')
    op.drop_table('feed_items')
    op.drop_table('chat_messages')
    op.drop_table('chat_threads')
    op.drop_index('idx_annotations_user_paper', table_name='annotations')
    op.drop_table('annotations')
    op.drop_index('idx_concerns_by_analysis', table_name='concerns')
    op.drop_table('concerns')
    op.drop_table('axis_scores')
    op.drop_table('paper_files')
    op.drop_table('outcomes')
    op.drop_table('verdict_snapshots')
    op.drop_table('analyses')
    op.drop_table('library_items')
    op.drop_table('papers')
    op.drop_table('user_niches')
    op.drop_table('niches')
    op.drop_table('users')
