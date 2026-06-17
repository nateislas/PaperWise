import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface Analysis {
  analysis_id: string;
  paper_info: {
    title: string;
    authors: string[];
    arxiv_id: string;
    upload_date: string;
  };
  analysis_info: {
    type: string;
    status: string;
    started_at: string;
    completed_at?: string;
  };
}

interface AnalysisCardProps {
  analysis: Analysis;
  onDelete: (analysisId: string) => void;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'processing':
        return 'bg-primary-50 text-primary-700 border-primary-200';
      case 'queued':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'error':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '⏳';
      case 'queued':
        return '⏸️';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this analysis? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysis.analysis_id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete(analysis.analysis_id);
      } else {
        alert('Failed to delete analysis');
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Failed to delete analysis');
    } finally {
      setIsDeleting(false);
    }
  };

  const truncateTitle = (title: string, maxLength: number = 60) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  return (
    <article 
      className="group bg-white rounded-2xl shadow-soft border border-slate-100 hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300"
      aria-labelledby={`title-${analysis.analysis_id}`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 min-w-0">
            <h3 
              id={`title-${analysis.analysis_id}`}
              className="text-lg font-bold text-slate-900 mb-2 leading-tight group-hover:text-primary-600 transition-colors"
            >
              {truncateTitle(analysis.paper_info?.title || 'Unknown Paper')}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              {analysis.paper_info?.authors && analysis.paper_info.authors.length > 0 
                ? analysis.paper_info.authors.slice(0, 2).join(', ') + 
                  (analysis.paper_info.authors.length > 2 ? ' et al.' : '')
                : 'Unknown Authors'
              }
            </p>
            {analysis.paper_info?.arxiv_id && (
              <p className="text-xs font-mono text-slate-400 mt-1 bg-slate-50 inline-block px-1.5 py-0.5 rounded">
                arXiv:{analysis.paper_info.arxiv_id}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <span 
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(analysis.analysis_info?.status || 'unknown')}`}
              role="status"
            >
              <span className="mr-1.5" aria-hidden="true">{getStatusIcon(analysis.analysis_info?.status || 'unknown')}</span>
              {analysis.analysis_info?.status || 'unknown'}
            </span>
          </div>
        </div>

        {/* Analysis Info */}
        <div className="space-y-3 mb-6 bg-slate-50/50 rounded-xl p-4">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Analysis Type</span>
            <span className="font-bold text-slate-700 capitalize">{analysis.analysis_info?.type || 'unknown'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Generated</span>
            <span className="font-medium text-slate-600">{analysis.analysis_info?.started_at ? formatDate(analysis.analysis_info.started_at) : 'N/A'}</span>
          </div>
          {analysis.analysis_info?.completed_at && (
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Time to Complete</span>
              <span className="font-medium text-slate-600">{formatDate(analysis.analysis_info.completed_at)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-5 border-t border-slate-100">
          <div className="flex space-x-3">
            <Link
              to={`/analysis/${analysis.analysis_id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-bold rounded-xl text-primary-700 bg-primary-50 hover:bg-primary-100 transition-all focus-ring shadow-sm"
            >
              View Results
            </Link>
            <a
              href={`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysis.analysis_id}/paper`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all focus-ring shadow-sm"
            >
              PDF
            </a>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-all focus-ring disabled:opacity-50"
            aria-label={`Delete analysis for ${analysis.paper_info?.title || 'this paper'}`}
          >
            {isDeleting ? '...' : 'Delete'}
          </button>
        </div>
      </div>
    </article>
  );
};

export default AnalysisCard;
