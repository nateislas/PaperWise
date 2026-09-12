import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, MoreHorizontal, Trash2, FileText, BookOpen, ExternalLink } from 'lucide-react';
import { TrustDots, type Axis } from '../trust/TrustDots';
import type { TrustLevel } from '../../lib/variants';

export interface PaperCardModel {
  id: string;
  title: string;
  authorLine: string;
  venue?: string;
  year?: number;
  levels: Partial<Record<Axis, TrustLevel>>;
  concerns: string[];
  concernCount: number;
  openedAgo?: string;
  createdTimestamp?: number;
  state: 'ready' | 'running' | 'queued' | 'failed' | 'not_analyzed';
  stage?: string;
}

export function PaperCard({
  p,
  onDelete,
}: {
  p: PaperCardModel;
  onDelete?: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  return (
    <article className="group relative flex flex-col justify-between h-[220px] rounded-xl border border-[--border-subtle] bg-[--surface] p-5 transition-[border-color,box-shadow] duration-[--dur-instant] hover:border-[--border-strong] hover:shadow-xs">
      <Link
        to={`/paper/${p.id}`}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]"
      >
        <span className="sr-only">Open {p.title}</span>
      </Link>

      <div>
        <header className="flex items-start justify-between gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[--text-secondary]">
            {[p.venue, p.year].filter(Boolean).join(' · ') || 'Preprint'}
          </span>
          <div className="flex items-center gap-2">
            {p.state === 'ready' && <TrustDots levels={p.levels} />}
            <div className="relative z-10" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu((m) => !m);
                }}
                className="relative z-10 -m-1 rounded-md p-1 text-[--text-secondary] opacity-0 hover:bg-[--surface-hover] focus-visible:opacity-100 group-hover:opacity-100 transition-opacity"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showMenu && (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="absolute right-0 top-6 z-30 w-44 rounded-lg border border-[--border-subtle] bg-[--surface] p-1 shadow-md animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      navigate(`/paper/${p.id}`);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[--text-primary] hover:bg-[--surface-hover]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[--text-secondary]" />
                    <span>Open Verdict</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      navigate(`/paper/${p.id}?tab=paper`);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[--text-primary] hover:bg-[--surface-hover]"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-[--text-secondary]" />
                    <span>Read Paper</span>
                  </button>
                  <a
                    href={`/api/v1/analyses/${p.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setShowMenu(false)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[--text-primary] hover:bg-[--surface-hover]"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-[--text-secondary]" />
                    <span>Open PDF</span>
                  </a>
                  <div className="my-1 border-t border-[--border-subtle]" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete?.(p.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[--trust-failing-text] hover:bg-[--trust-failing-wash]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete paper</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-5 text-[--text-primary]">
          {p.title}
        </h3>
        <p className="mt-1 truncate text-xs text-[--text-secondary]">
          {p.authorLine || 'Unknown Authors'}
        </p>
      </div>

      <div className="mt-auto">
        {p.state === 'running' ? (
          <Progress stage={p.stage} />
        ) : p.state === 'ready' ? (
          <ConcernLine count={p.concernCount} tags={p.concerns} />
        ) : (
          <span className="text-xs text-[--text-disabled]">
            Analysis not run yet
          </span>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-[--border-subtle] pt-2.5">
          <span className="text-xs text-[--text-secondary]">
            {p.openedAgo ?? ''}
          </span>
          <span className="text-xs font-medium text-[--text-accent] opacity-0 transition-opacity group-hover:opacity-100">
            Read →
          </span>
        </div>
      </div>
    </article>
  );
}

function ConcernLine({ count, tags }: { count: number; tags: string[] }) {
  if (count === 0)
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-[--trust-strong-text]">
        <Check className="h-3.5 w-3.5" /> No major concerns raised
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-[--trust-weak-text]">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        <span className="tabular">{count}</span> open concern
        {count === 1 ? '' : 's'}
        {tags.length > 0 && (
          <span className="text-[--text-secondary]">
            {' '}
            · {tags.slice(0, 2).join(', ')}
          </span>
        )}
      </span>
    </span>
  );
}

function Progress({ stage }: { stage?: string }) {
  return (
    <div className="space-y-2">
      <div className="h-1 overflow-hidden rounded-full bg-[--surface-sunken]">
        <div className="h-full w-1/3 animate-indeterminate rounded-full bg-[--status-running]" />
      </div>
      <span className="text-xs text-[--text-secondary]">
        Analyzing · {stage ?? 'starting'}
      </span>
    </div>
  );
}
