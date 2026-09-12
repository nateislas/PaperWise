import React from 'react';
import { ScorecardRow, type Evidence } from './ScorecardRow';
import type { TrustLevel } from '../../lib/variants';
import { AXES, AXIS_LABEL, type Axis } from './TrustDots';

export interface ScorecardAxisData {
  level: TrustLevel;
  rationale?: string;
  evidence?: Evidence[];
}

export function TrustScorecard({
  axesData,
  onJumpToEvidence,
}: {
  axesData: Partial<Record<Axis, ScorecardAxisData>>;
  onJumpToEvidence: (e: Evidence) => void;
}) {
  return (
    <div className="rounded-xl border border-[--border-subtle] bg-[--surface] overflow-hidden shadow-xs">
      <div className="border-b border-[--border-subtle] bg-[--surface-sunken] px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[--text-secondary]">
          Trust Scorecard
        </h3>
      </div>

      <div className="divide-y divide-[--border-subtle]">
        {AXES.map((axis) => {
          const item = axesData[axis] || {
            level: 'unavailable',
            rationale: 'Not evaluated for this paper',
          };
          return (
            <ScorecardRow
              key={axis}
              axis={AXIS_LABEL[axis]}
              level={item.level}
              rationale={item.rationale}
              evidence={item.evidence}
              onJump={onJumpToEvidence}
            />
          );
        })}
      </div>
    </div>
  );
}
