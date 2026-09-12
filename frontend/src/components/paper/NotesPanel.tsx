import React from 'react';

export interface NoteItem {
  id: string;
  type?: 'highlight' | 'manual';
  text?: string;
  page: number;
  timestamp?: number;
  quote?: string;
  comment?: any;
  color?: string;
  position?: any;
  createdAt?: string;
}

export function NotesPanel({
  notes = [],
  onJumpToNote,
  onJumpToPdfPage,
  onDeleteNote,
}: {
  notes?: NoteItem[];
  onJumpToNote?: (note: NoteItem) => void;
  onJumpToPdfPage?: (page: number, quote?: string) => void;
  onDeleteNote?: (id: string) => void;
}) {
  return (
    <div className="p-8 text-center space-y-3">
      <h3 className="text-base font-semibold text-[--text-primary]">Notes & Highlights</h3>
      <p className="text-xs text-[--text-secondary]">
        {notes.length === 0
          ? 'No highlights or notes yet. Select text in the PDF to add highlights.'
          : `${notes.length} note${notes.length === 1 ? '' : 's'} recorded.`}
      </p>
    </div>
  );
}
