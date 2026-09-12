import React from 'react';

export function VerdictPanel({
  analysis,
  onJumpToPdfPage,
}: {
  analysis: any;
  onJumpToPdfPage?: (page: number, quote?: string) => void;
}) {
  return (
    <div className="p-8 text-center space-y-3">
      <h3 className="text-base font-semibold text-text-primary">Verdict Panel</h3>
      <p className="text-xs text-text-secondary">
        Analysis evaluation and trust scorecard will load here.
      </p>
    </div>
  );
}
