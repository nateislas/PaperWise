import React, { useState } from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TrustDot } from './TrustDot';
import { TRUST, type TrustLevel } from '../../lib/variants';

export interface Evidence {
  page: number;
  section?: string;
  quote?: string;
}

export function ScorecardRow({
  axis,
  level,
  rationale,
  evidence = [],
  onJump,
}: {
  axis: string;
  level: TrustLevel;
  rationale?: string;
  evidence?: Evidence[];
  onJump: (e: Evidence) => void;
}) {
  const [open, setOpen] = useState(false);
  const v = TRUST[level] ?? TRUST.unavailable;
  const expandable = evidence.length > 0 || !!rationale;

  return (
    <div
      className={cn(
        'border-b border-[--border-subtle] last:border-0 transition-colors',
        open && v.wash
      )}
    >
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] focus-visible:ring-offset-1',
          expandable && 'hover:bg-[--surface-hover]'
        )}
      >
        <TrustDot level={level} />
        <span className="w-[140px] shrink-0 text-sm font-semibold text-[--text-primary]">
          {axis}
        </span>
        <span className={cn('w-[112px] shrink-0 text-sm font-semibold', v.text)}>
          {v.label}
        </span>
        <span className="line-clamp-1 flex-1 text-xs text-[--text-secondary]">
          {rationale}
        </span>
        {expandable && (
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-[--text-secondary] transition-transform duration-[--dur-fast]',
              open && 'rotate-90'
            )}
          />
        )}
      </button>

      {open && (
        <div className="space-y-2 px-4 pb-4 pl-[52px]">
          {rationale && (
            <p className="max-w-[68ch] text-sm leading-[22px] text-[--text-body]">
              {rationale}
            </p>
          )}
          {evidence.map((e, i) => (
            <button
              key={i}
              onClick={() => onJump(e)}
              className="group flex w-full items-start gap-2 rounded-lg border border-[--border-subtle] bg-[--surface] p-3 text-left hover:border-[--border-strong] transition-colors"
            >
              <span className="tabular mt-px shrink-0 rounded-md bg-[--surface-sunken] px-1.5 py-0.5 text-[11px] font-semibold text-[--text-secondary]">
                p.{e.page}
              </span>
              <span className="flex-1 text-xs leading-[18px] text-[--text-body]">
                {e.quote ?? e.section}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[--text-disabled] group-hover:text-[--text-accent]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
