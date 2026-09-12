import React from 'react';

export interface NoteItem {
  id: string;
  type: 'highlight' | 'manual';
  text: string;
  page?: number;
  timestamp: number;
}

export function NotesPanel({
  notes = [],
  onJumpToPdfPage,
  onDeleteNote,
}: {
  notes?: NoteItem[];
  onJumpToPdfPage?: (page: number) => void;
  onDeleteNote?: (id: string) => void;
}) {
  return (
    <div className="p-8 text-center space-y-3">
      <h3 className="text-base font-semibold text-text-primary">Notes & Highlights</h3>
      <p className="text-xs text-text-secondary">
        User highlights and notes will appear here.
      </p>
    </div>
  );
}
