import React from 'react';

export function ChatPanel({
  analysisId,
  paperInfo,
  onJumpToPdfPage,
}: {
  analysisId: string;
  paperInfo?: any;
  onJumpToPdfPage?: (page: number, quote?: string) => void;
}) {
  return (
    <div className="p-8 text-center space-y-3">
      <h3 className="text-base font-semibold text-text-primary">Knowledge Chat</h3>
      <p className="text-xs text-text-secondary">
        Interactive deep agent chat with citations will load here.
      </p>
    </div>
  );
}
