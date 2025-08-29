import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AnalysisCard from '../components/AnalysisCard';
import UploadArea from '../components/UploadArea';
import SearchBar from '../components/SearchBar';
import StatsCard from '../components/StatsCard';

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

interface Stats {
  total_analyses: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

const Dashboard: React.FC = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAnalyses, setFilteredAnalyses] = useState<Analysis[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalyses();
    fetchStats();
    
    // Set up polling every 30 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing dashboard...');
      fetchAnalyses();
      fetchStats();
    }, 30000); // 30 seconds
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter analyses based on search query
    if (!searchQuery.trim()) {
      setFilteredAnalyses(analyses);
    } else {
      const filtered = analyses.filter(analysis => {
        const title = analysis.paper_info.title.toLowerCase();
        const authors = analysis.paper_info.authors.join(' ').toLowerCase();
        const arxivId = analysis.paper_info.arxiv_id.toLowerCase();
        const query = searchQuery.toLowerCase();
        
        return title.includes(query) || 
               authors.includes(query) || 
               arxivId.includes(query);
      });
      setFilteredAnalyses(filtered);
    }
  }, [searchQuery, analyses]);

  const fetchAnalyses = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/analyses?limit=20`);
      const data = await response.json();
      setAnalyses(data.analyses || []);
    } catch (error) {
      console.error('Failed to fetch analyses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/analyses/stats/summary`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleAnalysisDeleted = (analysisId: string) => {
    setAnalyses(prev => prev.filter(a => a.analysis_id !== analysisId));
    fetchStats(); // Refresh stats
  };

  const handleUploadSuccess = () => {
    fetchAnalyses(); // Refresh analyses list
    fetchStats(); // Refresh stats
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your analyses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Centered Blurb */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">AI-Powered Research Paper Analysis</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Upload your research paper to PaperWise and get instant, in-depth analysis. Our AI agent goes beyond a simple summary, providing you with a critical breakdown of the methodology, key findings, and contributions to the field—just like a fellow researcher would.
          </p>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              setRefreshing(true);
              fetchAnalyses();
              fetchStats();
            }}
            disabled={refreshing}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
              refreshing 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Refresh analyses"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatsCard
              title="Total Analyses"
              value={stats.total_analyses}
              icon="📊"
              color="blue"
            />
            <StatsCard
              title="Completed"
              value={stats.by_status.completed || 0}
              icon="✅"
              color="green"
            />
            <StatsCard
              title="In Progress"
              value={stats.by_status.processing || 0}
              icon="⏳"
              color="yellow"
            />
          </div>
        )}

        {/* Upload Area */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload New Paper</h2>
          <UploadArea onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
            Recent Analyses
          </h2>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by title, authors, or arXiv ID..."
          />
        </div>

        {/* Analyses Grid */}
        {filteredAnalyses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses yet</h3>
            <p className="text-gray-500 mb-6">
              Upload your first research paper to get started with AI-powered analysis.
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Upload Your First Paper
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAnalyses.map((analysis) => (
              <AnalysisCard
                key={analysis.analysis_id}
                analysis={analysis}
                onDelete={handleAnalysisDeleted}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {analyses.length >= 20 && (
          <div className="text-center mt-8">
            <button className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Load More Analyses
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
