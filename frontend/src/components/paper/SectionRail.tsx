import React from 'react';
import type { ReportSectionId } from '../../constants/sections';
import { cn } from '../../lib/cn';

export interface SectionRailItem {
  id: ReportSectionId;
  label: string;
  present: boolean;
}

export function SectionRail({
  sections,
  activeSection,
  onSectionClick,
}: {
  sections: SectionRailItem[];
  activeSection?: string;
  onSectionClick: (id: ReportSectionId) => void;
}) {
  const presentSections = sections.filter((s) => s.present);

  if (presentSections.length === 0) return null;

  return (
    <nav className="rounded-xl border border-[--border-subtle] bg-[--surface] p-3 shadow-xs">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[--text-secondary] mb-2 px-2">
        Report Sections
      </h4>
      <div className="space-y-0.5">
        {presentSections.map((s) => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionClick(s.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left',
                isActive
                  ? 'bg-[--surface-selected] text-[--text-accent] font-semibold'
                  : 'text-[--text-secondary] hover:bg-[--surface-hover] hover:text-[--text-primary]'
              )}
            >
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
