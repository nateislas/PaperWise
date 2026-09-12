import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Highlighter, MessageSquare, X, ZoomIn, ZoomOut } from 'lucide-react';
import { VerdictPanel } from '../components/paper/VerdictPanel';
import { ReadPanel } from '../components/paper/ReadPanel';
import { ChatPanel } from '../components/paper/ChatPanel';
import { NotesPanel, type NoteItem } from '../components/paper/NotesPanel';
import { Skeleton } from '../components/ui/Skeleton';
import { resolveReportSectionId } from '../constants/sections';
import { cn } from '../lib/cn';
import { apiUrl } from '../config/api';
import * as pdfjs from 'pdfjs-dist';
import {
  PdfLoader,
  PdfHighlighter,
  TextHighlight,
  AreaHighlight,
} from 'react-pdf-highlighter-plus';
import 'react-pdf-highlighter-plus/style/style.css';
import 'pdfjs-dist/web/pdf_viewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const SafePdfLoader = PdfLoader as any;
const SafePdfHighlighter = PdfHighlighter as any;
const SafeTextHighlight = TextHighlight as any;
const SafeAreaHighlight = AreaHighlight as any;

const HighlightComponent = ({
  highlight,
  onDelete,
}: {
  highlight: any;
  onDelete: (id: string) => void;
}) => {
  const isAreaHighlight = !highlight.position?.rects || highlight.position.rects.length === 0;
  return isAreaHighlight ? (
    <SafeAreaHighlight
      highlight={highlight}
      onChange={() => {}}
      highlightColor="rgba(250, 204, 21, 0.35)"
      onDelete={() => onDelete(highlight.id)}
    />
  ) : (
    <SafeTextHighlight
      highlight={highlight}
      onClick={() => {}}
      highlightColor="rgba(250, 204, 21, 0.35)"
      highlightStyle="highlight"
      onDelete={() => onDelete(highlight.id)}
    />
  );
};

interface SelectionTipProps {
  onAnnotate: (selection: any) => void;
  onChat: (selection: any) => void;
  utilsRef: React.MutableRefObject<any>;
}

const SelectionTip: React.FC<SelectionTipProps> = ({ onAnnotate, onChat, utilsRef }) => {
  const selection = utilsRef.current?.getCurrentSelection();
  if (!selection) return null;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="bg-[--surface-inverse] text-[--text-inverse] rounded-xl shadow-md border border-[--border-subtle] p-1 flex items-center gap-1 z-50 text-xs font-semibold"
    >
      <button
        type="button"
        onClick={() => onAnnotate(selection)}
        className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-[--surface-hover] rounded-lg transition-colors text-[--text-inverse]"
      >
        <Highlighter className="h-3.5 w-3.5 text-[--text-accent]" />
        <span>Highlight & Note</span>
      </button>
      <div className="h-4 w-px bg-[--border-strong]" />
      <button
        type="button"
        onClick={() => onChat(selection)}
        className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-[--surface-hover] rounded-lg transition-colors text-[--text-inverse]"
      >
        <MessageSquare className="h-3.5 w-3.5 text-[--text-accent]" />
        <span>Ask AI</span>
      </button>
    </div>
  );
};

export function Paper() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'verdict';

  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [pdfScale, setPdfScale] = useState<number>(1.1);
  const [activeCitation, setActiveCitation] = useState<{
    page: number;
    section?: string;
    query?: string;
  } | null>(null);
  const [chatInitialContext, setChatInitialContext] = useState<string | null>(null);

  // Resizable split ratio state (default 58%)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pw.split');
      return saved ? parseFloat(saved) : 58;
    } catch (e) {
      return 58;
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const highlighterUtilsRef = useRef<any>(null);

  // Fetch analysis data & pdf url
  useEffect(() => {
    if (!analysisId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl(`/api/v1/analyses/${analysisId}`));
        if (!res.ok) throw new Error('Failed to fetch paper analysis');
        const data = await res.json();
        setAnalysis(data);

        // Fetch pdf blob
        const pdfRes = await fetch(apiUrl(`/api/v1/analyses/${analysisId}/paper`));
        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          setPdfUrl(URL.createObjectURL(blob));
        }

        // Fetch annotations
        const annotRes = await fetch(apiUrl(`/api/v1/analyses/${analysisId}/annotations`));
        if (annotRes.ok) {
          const annots = await annotRes.json();
          setNotes(
            (annots || []).map((a: any, idx: number) => ({
              id: a.id || `note-${idx}`,
              page: a.position?.pageNumber || a.page || 1,
              quote: a.content?.text || a.quote,
              comment: a.comment,
              color: a.color || 'yellow',
              position: a.position,
              createdAt: a.createdAt,
            }))
          );
        }
      } catch (err) {
        console.error('Error loading paper view:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [analysisId]);

  // Polling for live analysis updates until comprehensive results are ready
  useEffect(() => {
    if (!analysisId) return;

    const hasResults = Boolean(
      analysis?.results?.bottom_line ||
      analysis?.results?.methodological_evaluation ||
      analysis?.results?.critical_review?.major_concerns?.length
    );
    const isFailed = analysis?.status === 'failed' || analysis?.job?.state === 'error';
    if (hasResults || isFailed) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/analyses/${analysisId}`));
        if (!res.ok) return;
        const data = await res.json();
        setAnalysis(data);

        if (!pdfUrl) {
          const pdfRes = await fetch(apiUrl(`/api/v1/analyses/${analysisId}/paper`));
          if (pdfRes.ok) {
            const blob = await pdfRes.blob();
            setPdfUrl(URL.createObjectURL(blob));
          }
        }
      } catch (err) {
        console.error('Error polling paper analysis status:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [analysisId, analysis?.results, analysis?.status, analysis?.job?.state, pdfUrl]);

  // Tab change helper
  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  // Drag handler for resizable split
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const newRatio = Math.min(Math.max((e.clientX / windowWidth) * 100, 25), 75);
      setSplitRatio(newRatio);
      try {
        localStorage.setItem('pw.split', newRatio.toFixed(1));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const clearCitationHighlights = () => {
    setActiveCitation(null);
    try {
      highlighterUtilsRef.current?.search('', { highlightAll: false, caseSensitive: false });
    } catch (_) {}
  };

  // Jump to specific page in PDF viewer with search highlighting
  const handleJumpToPdfPage = useCallback((page: number, textSnippet?: string) => {
    if (highlighterUtilsRef.current && typeof highlighterUtilsRef.current.goToPage === 'function') {
      highlighterUtilsRef.current.goToPage(page);
    }

    setActiveCitation({
      page,
      section: textSnippet,
      query: textSnippet,
    });

    if (textSnippet) {
      const cleanSnippet = textSnippet.replace(/[*_#|`[\]]/g, '').trim();
      const searchQuery = cleanSnippet.split(/\s+/).slice(0, 8).join(' ');
      if (searchQuery.length >= 4) {
        [200, 600, 1200].forEach((delay) => {
          setTimeout(() => {
            try {
              highlighterUtilsRef.current?.search(searchQuery, {
                highlightAll: true,
                caseSensitive: false,
              });
            } catch (e) {
              console.warn('PDF search highlight error:', e);
            }
          }, delay);
        });
      }
    }
  }, []);

  const handleAnnotate = async (selection: any) => {
    if (!selection) return;
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      page: selection.position?.pageNumber || 1,
      quote: selection.content?.text || '',
      comment: '',
      color: 'yellow',
      position: selection.position,
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    handleTabChange('notes');

    if (highlighterUtilsRef.current) {
      highlighterUtilsRef.current.setTip(null);
    }

    try {
      await fetch(apiUrl(`/api/v1/analyses/${analysisId}/annotations`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annotations: updatedNotes.map((n) => ({
            id: n.id,
            page: n.page,
            position: n.position,
            content: { text: n.quote },
            comment: n.comment,
            color: n.color,
            createdAt: n.createdAt,
          })),
        }),
      });
    } catch (err) {
      console.error('Failed to persist annotation:', err);
    }
  };

  const handleChatWithSelection = (selection: any) => {
    if (!selection) return;
    const quote = selection.content?.text || '';
    setChatInitialContext(quote);
    handleTabChange('chat');
    if (highlighterUtilsRef.current) {
      highlighterUtilsRef.current.setTip(null);
    }
  };

  const handleDeleteNote = async (id: string) => {
    const updatedNotes = notes.filter((n) => n.id !== id);
    setNotes(updatedNotes);
    try {
      await fetch(apiUrl(`/api/v1/analyses/${analysisId}/annotations`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annotations: updatedNotes.map((n) => ({
            id: n.id,
            page: n.page,
            position: n.position,
            content: { text: n.quote },
            comment: n.comment,
            color: n.color,
            createdAt: n.createdAt,
          })),
        }),
      });
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  };

  const resObj = analysis?.results?.comprehensive_analysis || analysis?.results || analysis || {};
  const paperInfo = resObj?.paper_info || analysis?.paper_info || {};
  const title = paperInfo.title || analysis?.filename || 'Paper Analysis';
  const authorLine = Array.isArray(paperInfo.authors)
    ? paperInfo.authors.join(', ')
    : paperInfo.authors || paperInfo.author || '';
  const concerns =
    resObj?.critical_review?.major_concerns ||
    resObj?.methodological_evaluation?.potential_issues ||
    [];

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] w-full items-center justify-center bg-[--canvas]">
        <div className="space-y-4 text-center">
          <Skeleton className="h-10 w-64 mx-auto rounded-lg" />
          <p className="text-xs text-[--text-secondary]">Loading methodology verdict & PDF viewer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full bg-[--canvas] overflow-hidden">
      {/* Paper Top Chrome Bar (48px) */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[--border-subtle] bg-[--surface] px-4">
        {/* Left: Back + Paper Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            to="/"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[--border-subtle] text-[--text-secondary] hover:bg-[--surface-hover] transition-colors shrink-0"
            title="Back to Library"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="truncate min-w-0">
            <h1 className="text-xs font-bold text-[--text-primary] truncate">{title}</h1>
            {authorLine && <p className="text-[10px] text-[--text-secondary] truncate">{authorLine}</p>}
          </div>
        </div>

        {/* Center: Tabs Switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-[--surface-sunken] p-1">
          {[
            { id: 'verdict', label: 'Verdict' },
            { id: 'read', label: 'Read' },
            { id: 'chat', label: 'Chat' },
            { id: 'notes', label: `Notes (${notes.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                activeTab === t.id
                  ? 'bg-[--surface] text-[--text-primary] shadow-xs'
                  : 'text-[--text-secondary] hover:text-[--text-primary]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-1 w-full overflow-hidden relative">
        {/* Left Pane: PDF Viewer */}
        <div style={{ width: `${splitRatio}%` }} className="h-full border-r border-[--border-subtle] bg-slate-900 relative overflow-hidden">
          {/* Floating Citation Banner */}
          {activeCitation && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-[--border-accent]/40 bg-[--surface]/95 px-3.5 py-1.5 shadow-md backdrop-blur-xs text-xs">
              <span className="font-semibold text-[--text-accent]">
                📄 Page {activeCitation.page}
                {activeCitation.section ? ` · ${activeCitation.section}` : ''}
              </span>
              <button
                type="button"
                onClick={clearCitationHighlights}
                className="rounded-md p-0.5 text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--surface-hover] transition-colors"
                title="Dismiss citation highlight"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {pdfUrl ? (
            <div className="h-full w-full relative">
              <SafePdfLoader
                document={pdfUrl}
                url={pdfUrl}
                workerSrc="/pdf.worker.min.mjs"
                onError={(err: any) => console.warn('PDF document load error:', err)}
                errorMessage={(err: any) => (
                  <div className="flex h-full w-full items-center justify-center p-8 text-center text-xs text-slate-400">
                    Failed to load PDF: {err?.message || 'Unknown error'}
                  </div>
                )}
                beforeLoad={() => <Skeleton className="h-full w-full" />}
              >
                {(pdfDocument: any) => (
                  <SafePdfHighlighter
                    pdfDocument={pdfDocument}
                    pdfScaleValue={pdfScale}
                    enableAreaSelection={(event: any) => event.altKey}
                    onScrollChange={() => {}}
                    scrollTransform={() => {}}
                    utilsRef={(utils: any) => {
                      highlighterUtilsRef.current = utils;
                    }}
                    selectionTip={
                      <SelectionTip
                        onAnnotate={handleAnnotate}
                        onChat={handleChatWithSelection}
                        utilsRef={highlighterUtilsRef}
                      />
                    }
                    highlights={notes.filter((n: any) => n.position)}
                    highlightTransform={(highlight: any) => (
                      <HighlightComponent
                        key={highlight.id}
                        highlight={highlight}
                        onDelete={handleDeleteNote}
                      />
                    )}
                  />
                )}
              </SafePdfLoader>

              {/* Floating Zoom Controls */}
              <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 bg-[--surface-inverse] text-[--text-inverse] px-2.5 py-1 rounded-xl shadow-md border border-[--border-subtle] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPdfScale((s) => Math.max(0.6, Math.round((s - 0.1) * 10) / 10))}
                  className="p-1 hover:bg-[--surface-hover] rounded-lg transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="tabular font-mono text-[11px] min-w-[36px] text-center">
                  {Math.round(pdfScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPdfScale((s) => Math.min(2.5, Math.round((s + 0.1) * 10) / 10))}
                  className="p-1 hover:bg-[--surface-hover] rounded-lg transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-8 text-center text-xs text-slate-400">
              PDF file not available for display.
            </div>
          )}
        </div>

        {/* Drag Handle Divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 hover:w-2 bg-[--border-subtle] hover:bg-[--accent] cursor-col-resize transition-all shrink-0 z-20"
        />

        {/* Right Pane: Workspace Panels */}
        <div style={{ width: `${100 - splitRatio}%` }} className="h-full bg-[--surface] overflow-y-auto">
          {activeTab === 'verdict' && (
            <VerdictPanel analysis={analysis} onJumpToPdfPage={handleJumpToPdfPage} />
          )}
          {activeTab === 'read' && (
            <ReadPanel markdownContent={analysis?.parsed_markdown} paperInfo={paperInfo} />
          )}
          {activeTab === 'chat' && (
            <ChatPanel
              analysisId={analysisId!}
              initialContext={chatInitialContext}
              concerns={concerns}
              onJumpToPdfPage={handleJumpToPdfPage}
              onJumpToReportSection={(sec) => {
                handleTabChange('verdict');
                const targetId = resolveReportSectionId(sec) || sec;
                setTimeout(() => {
                  const el = document.getElementById(targetId) || document.querySelector(`[data-section="${targetId}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
              }}
            />
          )}
          {activeTab === 'notes' && (
            <NotesPanel
              notes={notes}
              onJumpToNote={(n) => handleJumpToPdfPage(n.page, n.quote)}
              onDeleteNote={handleDeleteNote}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Paper;
