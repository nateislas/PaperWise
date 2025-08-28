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
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    if (!confirm('Are you sure you want to delete this analysis? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/analyses/${analysis.analysis_id}`, {
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
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {truncateTitle(analysis.paper_info.title)}
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              {analysis.paper_info.authors.length > 0 
                ? analysis.paper_info.authors.slice(0, 2).join(', ') + 
                  (analysis.paper_info.authors.length > 2 ? ' et al.' : '')
                : 'Unknown Authors'
              }
            </p>
            {analysis.paper_info.arxiv_id && (
              <p className="text-xs text-gray-500">
                arXiv: {analysis.paper_info.arxiv_id}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(analysis.analysis_info.status)}`}>
              <span className="mr-1">{getStatusIcon(analysis.analysis_info.status)}</span>
              {analysis.analysis_info.status}
            </span>
          </div>
        </div>

        {/* Analysis Info */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Type:</span>
            <span className="text-gray-900 capitalize">{analysis.analysis_info.type}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Started:</span>
            <span className="text-gray-900">{formatDate(analysis.analysis_info.started_at)}</span>
          </div>
          {analysis.analysis_info.completed_at && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Completed:</span>
              <span className="text-gray-900">{formatDate(analysis.analysis_info.completed_at)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <div className="flex space-x-2">
            <Link
              to={`/analysis/${analysis.analysis_id}`}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
            >
              View Results
            </Link>
            <a
              href={`/api/v1/analyses/${analysis.analysis_id}/paper`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Download PDF
            </a>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center px-2 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50 transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisCard;
