import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Pill } from '../ui/Pill';

export type ConcernSeverity = 'blocking' | 'material' | 'minor';

export interface ConcernItem {
  id: string;
  severity: ConcernSeverity | 'critical' | 'moderate';
  title: string;
  description: string;
  category?: string;
  page?: number;
  section?: string;
}

export function ConcernList({
  concerns = [],
  onJumpToCitation,
}: {
  concerns: ConcernItem[];
  onJumpToCitation: (c: ConcernItem) => void;
}) {
  if (concerns.length === 0) {
    return (
      <div className="rounded-xl border border-[--border-subtle] bg-[--surface] p-6 text-center shadow-xs">
        <p className="text-xs font-semibold text-[--trust-strong-text]">
          ✓ No major methodology or baseline concerns identified
        </p>
      </div>
    );
  }

  const getTone = (severity: string): 'failing' | 'weak' | 'neutral' => {
    if (severity === 'blocking' || severity === 'critical') return 'failing';
    if (severity === 'material' || severity === 'moderate') return 'weak';
    return 'neutral';
  };

  const getDisplaySeverity = (severity: string): string => {
    if (severity === 'critical') return 'BLOCKING';
    if (severity === 'moderate') return 'MATERIAL';
    return severity.toUpperCase();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[--text-secondary]">
          Open Concerns ({concerns.length})
        </h3>
      </div>

      <div className="space-y-2.5">
        {concerns.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-[--border-subtle] bg-[--surface] p-4 transition-colors hover:border-[--border-strong] shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Pill tone={getTone(c.severity)}>
                  {getDisplaySeverity(c.severity)}
                </Pill>
                <h4 className="text-xs font-bold text-[--text-primary]">
                  {c.title}
                </h4>
              </div>

              {c.page && (
                <button
                  type="button"
                  onClick={() => onJumpToCitation(c)}
                  className="group flex items-center gap-1 shrink-0 rounded-md bg-[--surface-sunken] px-2 py-0.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-accent] transition-colors cursor-pointer"
                >
                  <span>p.{c.page}</span>
                  <ArrowUpRight className="h-3 w-3 text-[--text-disabled] group-hover:text-[--text-accent]" />
                </button>
              )}
            </div>

            <p className="mt-2 text-xs leading-5 text-[--text-body]">
              {c.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConcernList;
