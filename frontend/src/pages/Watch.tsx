import React from 'react';
import { StubBlock } from '../components/ui/StubBlock';
import { Pill } from '../components/ui/Pill';

export function Watch() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="flex items-center justify-between border-b border-[--border-subtle] pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[--text-primary]">
              Watch Feed
            </h1>
            <Pill tone="accent">Launch Niche</Pill>
          </div>
          <p className="mt-1 text-xs text-[--text-secondary]">
            Pre-triaged preprint stream for Computational Protein Science
          </p>
        </div>
      </div>

      <StubBlock title="Automated arXiv & bioRxiv Ingestion">
        Watch feed materialization will go live in Milestone M5. It ingests new preprints daily, scores them against your niche parameters, and surfaces items with methodology verdicts directly to your inbox and home screen.
      </StubBlock>

      <div className="mt-8 space-y-4">
        <h3 className="text-sm font-semibold text-[--text-primary]">
          Preview Feed Item Format
        </h3>

        <div className="rounded-xl border border-[--border-subtle] bg-[--surface] p-5 opacity-75">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[--text-secondary]">
              bioRxiv · Sep 11, 2026
            </span>
            <Pill tone="neutral">Sample Feed Row</Pill>
          </div>
          <h4 className="mt-2 text-sm font-semibold text-[--text-primary]">
            De novo design of all-alpha helical barrels with custom ligand binding cavities
          </h4>
          <p className="mt-1 text-xs text-[--text-secondary]">
            Jane Doe, John Smith, et al. · Baker Lab
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-[--border-subtle] pt-3">
            <span className="text-xs text-[--trust-weak-text] font-medium">
              1 potential baseline issue flagged
            </span>
            <span className="text-xs font-semibold text-[--text-accent]">
              Preview →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
