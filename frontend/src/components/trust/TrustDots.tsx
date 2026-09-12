import React from 'react';
import { TrustDot } from './TrustDot';
import type { TrustLevel } from '../../lib/variants';

export const AXES = [
  'methodology',
  'evidence',
  'reproducibility',
  'novelty',
  'independent',
] as const;

export type Axis = typeof AXES[number];

export const AXIS_LABEL: Record<Axis, string> = {
  methodology: 'Methodology',
  evidence: 'Evidence',
  reproducibility: 'Reproducibility',
  novelty: 'Novelty',
  independent: 'Independent signals',
};

export function TrustDots({
  levels,
  size = 8,
}: {
  levels: Partial<Record<Axis, TrustLevel>>;
  size?: number;
}) {
  const summary = AXES.map(
    (a) => `${AXIS_LABEL[a]}: ${levels[a] ?? 'unavailable'}`
  ).join('. ');

  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={summary}
      title={summary}
    >
      {AXES.map((a) => (
        <TrustDot key={a} level={levels[a] ?? 'unavailable'} size={size} />
      ))}
    </span>
  );
}
