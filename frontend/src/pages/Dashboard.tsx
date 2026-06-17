import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAnalyses, setFilteredAnalyses] = useState<Analysis[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [localPapers, setLocalPapers] = useState<any[]>([]);
  const [localPathInput, setLocalPathInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scannedPathRef = useRef('');

  const fetchAnalyses = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses?limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch analyses');
      }
      const data = await response.json();
      setAnalyses(data.analyses || []);
    } catch (error) {
      console.error('Failed to fetch analyses:', error);
      setAnalyses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/stats/summary`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats(null);
    }
  }, []);

  const fetchLocalPapers = useCallback(async (path?: string) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const url = new URL(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/local-papers`);
      const activePath = path !== undefined ? path : scannedPathRef.current;
      if (activePath) {
        url.searchParams.append('path', activePath);
      }
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to scan directory');
      }
      const data = await response.json();
      setLocalPapers(Array.isArray(data) ? data : []);
      if (path !== undefined) {
        scannedPathRef.current = path;
      }
    } catch (err: any) {
      setScanError(err.message || 'Failed to scan laptop directory');
      setLocalPapers([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
    fetchStats();
    fetchLocalPapers();
    
    // Set up polling every 30 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing dashboard...');
      fetchAnalyses();
      fetchStats();
      fetchLocalPapers();
    }, 30000); // 30 seconds
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fetchAnalyses, fetchStats, fetchLocalPapers]);

  useEffect(() => {
    // Filter analyses based on search query
    if (!searchQuery.trim()) {
      setFilteredAnalyses(analyses);
    } else {
      const filtered = analyses.filter(analysis => {
        const title = (analysis.paper_info?.title || '').toLowerCase();
        const authors = (analysis.paper_info?.authors || []).join(' ').toLowerCase();
        const arxivId = (analysis.paper_info?.arxiv_id || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        
        return title.includes(query) || 
               authors.includes(query) || 
               arxivId.includes(query);
      });
      setFilteredAnalyses(filtered);
    }
  }, [searchQuery, analyses]);

  const handleAnalysisDeleted = (analysisId: string) => {
    setAnalyses(prev => prev.filter(a => a.analysis_id !== analysisId));
    fetchStats(); // Refresh stats
  };

  const handleUploadSuccess = () => {
    fetchAnalyses(); // Refresh analyses list
    fetchStats(); // Refresh stats
  };

  const handleOpenLocalPaper = async (absolutePath: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/local-papers/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absolute_path: absolutePath })
      });
      if (!response.ok) {
        throw new Error('Failed to open local paper');
      }
      const data = await response.json();
      // Redirect to the analysis page for this paper
      navigate(`/analysis/${data.analysis_id}`);
    } catch (err) {
      console.error('Error opening local paper:', err);
      alert('Failed to open local paper.');
    }
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
    <main className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Research Library
          </h1>
          <p className="text-lg font-medium text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Manage your academic knowledge base with AI-powered insights. 
            Upload papers to extract methodology, findings, and critical gaps automatically.
          </p>
        </div>

        {/* Stats Section */}
        {stats && stats.by_status && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16" aria-label="Quick Stats">
            <StatsCard
              title="Total Analyses"
              value={stats.total_analyses || 0}
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
          </section>
        )}

        {/* Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Upload Area */}
          <section className="bg-white rounded-3xl shadow-soft border border-slate-100 p-8 flex flex-col justify-between" aria-labelledby="upload-heading">
            <div className="mb-6">
              <h2 id="upload-heading" className="text-xl font-bold text-slate-900 mb-2">New Analysis</h2>
              <p className="text-sm font-medium text-slate-500">Add a new PDF to your research library</p>
            </div>
            <UploadArea onUploadSuccess={handleUploadSuccess} />
          </section>

          {/* Local Directory Scan Area */}
          <section className="bg-white rounded-3xl shadow-soft border border-slate-100 p-8 flex flex-col" aria-labelledby="scan-heading">
            <div className="mb-6">
              <h2 id="scan-heading" className="text-xl font-bold text-slate-900 mb-2">Laptop Scanner</h2>
              <p className="text-sm font-medium text-slate-500 mb-6">
                Scan your local directories to import papers instantly.
              </p>
              
              <form onSubmit={(e) => { e.preventDefault(); fetchLocalPapers(localPathInput); }} className="flex space-x-3 mb-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    id="path-input"
                    placeholder="Enter folder path..."
                    value={localPathInput}
                    onChange={(e) => setLocalPathInput(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus-ring bg-slate-50/50 text-slate-800 placeholder-slate-400"
                    aria-label="Local folder path"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isScanning}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 py-2.5 text-sm font-bold transition-all disabled:opacity-50 shadow-soft focus-ring"
                >
                  {isScanning ? 'Scanning...' : 'Scan'}
                </button>
              </form>

              {scanError && (
                <div className="text-rose-600 text-xs mb-3 bg-rose-50 p-3 rounded-xl border border-rose-100 font-medium" role="alert">{scanError}</div>
              )}
            </div>

            {/* List of scanned local papers */}
            <div className="flex-1 max-h-64 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/30 p-4 space-y-3 custom-scrollbar">
              {localPapers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                  <svg className="w-12 h-12 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm font-medium">{isScanning ? 'Scanning library...' : 'No PDF papers found'}</p>
                </div>
              ) : (
                localPapers.map((paper, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:border-primary-200 transition-colors group">
                    <div className="truncate pr-4 flex-1">
                      <div className="text-sm font-bold text-slate-800 truncate" title={paper.filename}>{paper.filename}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{(paper.size_bytes / (1024*1024)).toFixed(2)} MB</div>
                    </div>
                    <button
                      onClick={() => handleOpenLocalPaper(paper.absolute_path)}
                      className={`text-xs px-4 py-2 rounded-lg font-bold transition-all focus-ring ${
                        paper.already_analyzed
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'
                          : 'bg-primary-600 text-white hover:bg-primary-700 shadow-soft'
                      }`}
                    >
                      {paper.already_analyzed ? 'Open' : 'Analyze'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Search and Header Section */}
        <section className="mb-10" aria-labelledby="recent-heading">
          <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 mb-8">
            <div className="flex items-center space-x-4">
              <h2 id="recent-heading" className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Recent Analyses
              </h2>
              <button
                onClick={() => {
                  setRefreshing(true);
                  fetchAnalyses();
                  fetchStats();
                }}
                disabled={refreshing}
                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all focus-ring"
                aria-label="Refresh analyses list"
              >
                <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search library..."
            />
          </div>

          {/* Analyses Grid */}
          <div className="relative" aria-live="polite">
            {filteredAnalyses.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Your library is empty</h3>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto font-medium">
                  Begin your research journey by uploading your first paper or scanning a local folder.
                </p>
                <Link
                  to="/upload"
                  className="inline-flex items-center px-8 py-3 border border-transparent text-sm font-bold rounded-2xl text-white bg-primary-600 hover:bg-primary-700 shadow-soft hover:shadow-soft-lg transition-all focus-ring"
                >
                  Start First Analysis
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredAnalyses.map((analysis) => (
                  <AnalysisCard
                    key={analysis.analysis_id}
                    analysis={analysis}
                    onDelete={handleAnalysisDeleted}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Load More Button */}
          {analyses.length >= 20 && (
            <div className="text-center mt-12">
              <button className="bg-white border border-slate-200 text-slate-600 font-bold px-8 py-3 rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all focus-ring shadow-sm">
                Load More Papers
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default Dashboard;
