import React, { useState } from 'react';
import { Bookmark, Trash2, ArrowUpRight, Download, FileText, Code } from 'lucide-react';
import { Button } from '../ui/Button';

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

export interface NotesPanelProps {
  notes?: NoteItem[];
  onJumpToNote?: (note: NoteItem) => void;
  onJumpToPdfPage?: (page: number, quote?: string) => void;
  onDeleteNote?: (id: string) => void;
  onExportNotes?: (format: 'markdown' | 'json', notes: NoteItem[]) => void;
}

export function NotesPanel({
  notes = [],
  onJumpToNote,
  onJumpToPdfPage,
  onDeleteNote,
  onExportNotes,
}: NotesPanelProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleJump = (n: NoteItem) => {
    if (onJumpToNote) {
      onJumpToNote(n);
    } else if (onJumpToPdfPage) {
      onJumpToPdfPage(n.page, n.quote || n.text);
    }
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: 'markdown' | 'json') => {
    setShowExportMenu(false);
    if (onExportNotes) {
      onExportNotes(format, notes);
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === 'markdown') {
      const mdContent = [
        `# Paper Notes & Highlights`,
        `Exported on ${new Date().toLocaleDateString()}`,
        `Total notes: ${notes.length}`,
        '',
        ...notes.map((n, idx) => {
          const lines = [`### Note ${idx + 1} (Page ${n.page})`];
          if (n.quote || n.text) {
            lines.push(`> "${n.quote || n.text}"`);
            lines.push('');
          }
          if (n.comment) {
            lines.push(`**Comment**: ${n.comment}`);
            lines.push('');
          }
          if (n.createdAt) {
            lines.push(`*Created: ${new Date(n.createdAt).toLocaleString()}*`);
            lines.push('');
          }
          return lines.join('\n');
        }),
      ].join('\n');
      downloadFile(`paper-notes-${timestamp}.md`, mdContent, 'text/markdown;charset=utf-8;');
    } else {
      const jsonContent = JSON.stringify(notes, null, 2);
      downloadFile(`paper-notes-${timestamp}.json`, jsonContent, 'application/json;charset=utf-8;');
    }
  };

  if (notes.length === 0) {
    return (
      <div className="p-8 text-center space-y-2">
        <Bookmark className="h-8 w-8 mx-auto text-[--text-disabled]" />
        <h4 className="text-xs font-semibold text-[--text-primary]">No notes or highlights yet</h4>
        <p className="text-xs text-[--text-secondary] max-w-xs mx-auto">
          Highlight text directly in the PDF viewer on the left to capture quotes and add your notes.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[--text-secondary]">
          Saved Highlights & Notes ({notes.length})
        </h3>
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 text-xs py-1 px-2.5 h-auto"
            aria-label="Export notes"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </Button>

          {showExportMenu && (
            <div className="absolute right-0 mt-1 w-36 rounded-lg border border-[--border-subtle] bg-[--surface] py-1 shadow-lg z-10 text-xs">
              <button
                type="button"
                onClick={() => handleExport('markdown')}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[--text-body] hover:bg-[--surface-hover] transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-[--text-secondary]" />
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('json')}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[--text-body] hover:bg-[--surface-hover] transition-colors"
              >
                <Code className="h-3.5 w-3.5 text-[--text-secondary]" />
                <span>JSON (.json)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {notes.map((n) => (
          <div
            key={n.id}
            className="group rounded-xl border border-[--border-subtle] bg-[--surface] p-4 transition-colors hover:border-[--border-strong]"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleJump(n)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[--surface-sunken] px-2 py-0.5 text-xs font-semibold text-[--text-secondary] hover:text-[--text-accent] cursor-pointer"
              >
                <span>Page {n.page}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>

              {onDeleteNote && (
                <button
                  type="button"
                  onClick={() => onDeleteNote(n.id)}
                  className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-[--text-secondary] hover:text-[--trust-failing-text] hover:bg-[--trust-failing-wash] transition-all cursor-pointer"
                  aria-label="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {(n.quote || n.text) && (
              <blockquote className="mt-2.5 border-l-2 border-[--border-accent] pl-3 italic text-xs text-[--text-body]">
                "{n.quote || n.text}"
              </blockquote>
            )}

            {n.comment && (
              <p className="mt-2 text-xs font-medium text-[--text-primary]">
                {n.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotesPanel;
