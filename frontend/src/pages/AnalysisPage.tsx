import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function AnalysisPage() {
  const { analysisId } = useParams<{ analysisId: string }>();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="max-w-md w-full rounded-xl border border-[--border-subtle] bg-[--surface] p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[--surface-sunken] text-[--accent]">
          <FileText className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-[--text-primary]">
          Loading Paper Workspace
        </h2>
        <p className="mt-1 text-xs text-[--text-secondary]">
          {analysisId ? `Analysis ID: ${analysisId}` : 'Initializing research analysis workspace...'}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[--text-secondary]">
          <Loader2 className="h-4 w-4 animate-spin text-[--accent]" />
          <span>Connecting to PaperWise analysis engine...</span>
        </div>

        <div className="mt-6 pt-4 border-t border-[--border-subtle]">
          <Link to="/">
            <Button variant="secondary" size="sm" className="w-full flex items-center justify-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Library</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
