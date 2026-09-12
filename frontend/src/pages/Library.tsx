import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  FileText,
  Plus,
} from 'lucide-react';
import { PaperCard, type PaperCardModel } from '../components/library/PaperCard';
import { TrustDots } from '../components/trust/TrustDots';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { AddPaperModal } from '../components/library/AddPaperModal';
import { cn } from '../lib/cn';
import { apiUrl } from '../config/api';
import { isFeatureEnabled } from '../config/features';
import type { TrustLevel } from '../lib/variants';

export function Library() {
  const location = useLocation();
  const navigate = useNavigate();
  const [papers, setPapers] = useState<PaperCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'concerns' | 'strong'>('all');
  const [sort, setSort] = useState<'newest' | 'opened' | 'concerns' | 'title'>('newest');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('pw.libraryView');
    return saved === 'grid' || saved === 'list' ? saved : 'grid';
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleViewChange = (newView: 'grid' | 'list') => {
    setView(newView);
    localStorage.setItem('pw.libraryView', newView);
  };

  // Check query string for ?add=1 redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('add') === '1') {
      setIsAddModalOpen(true);
    }
  }, [location.search]);

  const fetchPapers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/v1/analyses'));
      if (!res.ok) throw new Error('Failed to fetch analyses');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.analyses || [];
      
      const mapped: PaperCardModel[] = list.map((item: any) => {
        const id = item.analysis_id || item.id;
        const resObj = item.results || item;
        const paperInfo = resObj.paper_info || item.paper_info || {};

        // Extract levels: check for v2 schema fields first, then fallback to legacy mapper
        const methEval = resObj.methodological_evaluation || {};
        const novEval = resObj.novelty_assessment || {};

        const v2Methodology = resObj.methodology?.level;
        const v2Evidence = resObj.evidence?.level;
        const v2Reproducibility = resObj.reproducibility?.level;
        const v2Novelty = resObj.novelty?.level;

        /**
         * @deprecated Legacy text-to-level mapping for v1 analyses. Use AnalysisV2 enum levels.
         */
        const legacyLevels: Partial<Record<string, TrustLevel>> = {
          methodology: methEval.rigor_assessment === 'high' ? 'strong' : methEval.rigor_assessment === 'medium' ? 'adequate' : methEval.rigor_assessment === 'low' ? 'weak' : 'adequate',
          evidence: resObj.evidence_quality?.overall_quality === 'high' ? 'strong' : 'adequate',
          reproducibility: methEval.reproducibility === 'high' ? 'strong' : methEval.reproducibility === 'low' ? 'weak' : 'adequate',
          novelty: novEval.novelty_score >= 8 ? 'strong' : novEval.novelty_score >= 5 ? 'adequate' : 'weak',
          independent: 'unavailable',
        };

        const rawStatus = (item.analysis_info?.status || item.status || '').toLowerCase();
        const state: 'ready' | 'running' | 'queued' | 'failed' =
          rawStatus === 'completed' || rawStatus === 'ready'
            ? 'ready'
            : rawStatus === 'processing' || rawStatus === 'running'
            ? 'running'
            : rawStatus === 'pending' || rawStatus === 'queued'
            ? 'queued'
            : rawStatus === 'failed' || rawStatus === 'error'
            ? 'failed'
            : 'queued';

        const hasV2Levels = Boolean(v2Methodology || v2Evidence || v2Reproducibility || v2Novelty);
        const hasEvaluations = Boolean(
          hasV2Levels ||
          resObj.methodological_evaluation ||
          resObj.evidence_quality ||
          resObj.novelty_assessment
        );

        const unavailableLevels: Partial<Record<string, TrustLevel>> = {
          methodology: 'unavailable',
          evidence: 'unavailable',
          reproducibility: 'unavailable',
          novelty: 'unavailable',
          independent: 'unavailable',
        };

        const levels: Partial<Record<string, TrustLevel>> = (state === 'ready' && hasEvaluations)
          ? ((isFeatureEnabled('rubricV2') || hasV2Levels) && hasV2Levels
              ? {
                  methodology: (v2Methodology as TrustLevel) || 'adequate',
                  evidence: (v2Evidence as TrustLevel) || 'adequate',
                  reproducibility: (v2Reproducibility as TrustLevel) || 'adequate',
                  novelty: (v2Novelty as TrustLevel) || 'adequate',
                  independent: 'unavailable',
                }
              : legacyLevels)
          : unavailableLevels;

        // Check for v2 concerns (blocking + material only per DECISIONS.md D-04)
        const v2Concerns = resObj.concerns || item.concerns;
        let concernsList: any[] = [];
        if (state === 'ready' && hasEvaluations) {
          if (Array.isArray(v2Concerns) && v2Concerns.length > 0) {
            concernsList = v2Concerns.filter((c: any) => c.severity === 'blocking' || c.severity === 'material');
          } else {
            concernsList = methEval.potential_issues || resObj.critical_review?.major_concerns || [];
          }
        }

        const createdTs = item.created_at ? new Date(item.created_at).getTime() : 0;

        return {
          id,
          title: paperInfo.title || item.filename || 'Untitled Paper',
          authorLine: Array.isArray(paperInfo.authors) && paperInfo.authors.length > 0
            ? paperInfo.authors.join(', ')
            : 'Unknown Authors',
          venue: paperInfo.venue,
          year: paperInfo.year,
          levels,
          concerns: concernsList.map((c: any) => (typeof c === 'string' ? c : c.category || c.title || 'Methodology')),
          concernCount: concernsList.length,
          openedAgo: item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
          createdTimestamp: createdTs,
          state,
          stage: item.stage,
        };
      });

      setPapers(mapped);
      // Auto-switch to list view if item count exceeds 24 and user hasn't explicitly set preference (DECISIONS.md D-05)
      if (mapped.length > 24 && !localStorage.getItem('pw.libraryView')) {
        setView('list');
      }
    } catch (err) {
      console.error('Failed to load library papers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
    // Refetch on focus instead of aggressive 30s polling
    const onFocus = () => fetchPapers();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchPapers]);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    // Try direct /api/v1/analyze first
    let res = await fetch(apiUrl('/api/v1/analyze'), {
      method: 'POST',
      body: formData,
    });

    // If direct fails, fallback to /api/v1/upload + /api/v1/analyze/async
    if (!res.ok) {
      const uploadRes = await fetch(apiUrl('/api/v1/upload'), {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      if (!uploadData.file_id) throw new Error('Upload did not return a valid file ID');

      const asyncRes = await fetch(apiUrl('/api/v1/analyze/async'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: uploadData.file_id,
          analysis_type: 'comprehensive',
        }),
      });

      if (!asyncRes.ok) {
        const errData = await asyncRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to queue analysis');
      }

      const jobData = await asyncRes.json();
      await fetchPapers();
      const newId = jobData.job_id || jobData.analysis_id;
      if (newId) {
        navigate(`/paper/${newId}`);
      }
      return;
    }

    const data = await res.json();
    await fetchPapers();
    const newId = data.job_id || data.analysis_id;
    if (newId) {
      navigate(`/paper/${newId}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/v1/analyses/${id}`), { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Failed to delete paper (${res.status} ${res.statusText})`);
      }
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Filter & Sort logic
  const filtered = papers
    .filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.authorLine.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filter === 'concerns') return p.concernCount > 0;
      if (filter === 'strong') return p.concernCount === 0;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'concerns') return b.concernCount - a.concernCount;
      if (sort === 'opened' || sort === 'newest') {
        return (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
      }
      return 0;
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[--text-primary]">
            Research Library
          </h1>
          <p className="mt-1 text-xs text-[--text-secondary]">
            {papers.length} paper{papers.length === 1 ? '' : 's'} in library
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[--text-secondary]" />
            <Input
              type="text"
              placeholder="Filter papers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center rounded-lg border border-[--border-subtle] bg-[--surface] p-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                filter === 'all'
                  ? 'bg-[--surface-sunken] text-[--text-primary]'
                  : 'text-[--text-secondary] hover:text-[--text-primary]'
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('concerns')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                filter === 'concerns'
                  ? 'bg-[--surface-sunken] text-[--text-primary]'
                  : 'text-[--text-secondary] hover:text-[--text-primary]'
              )}
            >
              Concerns
            </button>
            <button
              type="button"
              onClick={() => setFilter('strong')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                filter === 'strong'
                  ? 'bg-[--surface-sunken] text-[--text-primary]'
                  : 'text-[--text-secondary] hover:text-[--text-primary]'
              )}
            >
              Clean
            </button>
          </div>

          <div className="flex items-center rounded-lg border border-[--border-subtle] bg-[--surface] p-1">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="bg-transparent text-xs font-medium text-[--text-secondary] hover:text-[--text-primary] px-2 py-1 outline-none cursor-pointer"
            >
              <option value="newest" className="bg-[--surface] text-[--text-primary]">Sort: Recent</option>
              <option value="opened" className="bg-[--surface] text-[--text-primary]">Recently opened</option>
              <option value="concerns" className="bg-[--surface] text-[--text-primary]">Most concerns</option>
              <option value="title" className="bg-[--surface] text-[--text-primary]">Title</option>
            </select>
          </div>

          <div className="flex items-center rounded-lg border border-[--border-subtle] bg-[--surface] p-1">
            <button
              type="button"
              onClick={() => handleViewChange('grid')}
              aria-label="Grid View"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                view === 'grid'
                  ? 'bg-[--surface-sunken] text-[--text-primary]'
                  : 'text-[--text-secondary] hover:text-[--text-primary]'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('list')}
              aria-label="List View"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                view === 'list'
                  ? 'bg-[--surface-sunken] text-[--text-primary]'
                  : 'text-[--text-secondary] hover:text-[--text-primary]'
              )}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[220px] w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-strong] bg-[--surface-sunken]/40 p-12 text-center">
          <FileText className="h-10 w-10 text-[--text-disabled]" />
          <h3 className="mt-4 text-sm font-semibold text-[--text-primary]">
            No papers found
          </h3>
          <p className="mt-1 text-xs text-[--text-secondary] max-w-sm">
            {search
              ? 'No papers match your search criteria. Try a different query.'
              : 'Your research library is empty. Add a paper to get started.'}
          </p>
          <Button
            variant="accent"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4"
          >
            <Plus className="h-4 w-4" />
            <span>Add paper</span>
          </Button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PaperCard key={p.id} p={p} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        /* List View */
        <div className="divide-y divide-[--border-subtle] rounded-xl border border-[--border-subtle] bg-[--surface]">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 p-4 hover:bg-[--surface-hover] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={`/paper/${p.id}`}
                  className="text-sm font-semibold text-[--text-primary] hover:text-[--text-accent] truncate block"
                >
                  {p.title}
                </a>
                <p className="text-xs text-[--text-secondary] truncate mt-0.5">
                  {p.authorLine}
                </p>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <TrustDots levels={p.levels} />
                <span className="text-xs text-[--text-secondary] w-24 text-right">
                  {p.concernCount > 0 ? (
                    <span className="text-[--trust-weak-text] font-medium">
                      {p.concernCount} concern{p.concernCount === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="text-[--trust-strong-text]">Clean</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Paper Modal */}
      <AddPaperModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUpload={handleUpload}
        onImportSuccess={fetchPapers}
      />
    </div>
  );
}
