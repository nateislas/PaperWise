import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AnalysisResults from '../components/AnalysisResults';
import StreamingAnalysisResults from '../components/StreamingAnalysisResults';

interface AnalysisPageProps {}

const AnalysisPage: React.FC<AnalysisPageProps> = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('unknown');
  const [fileId, setFileId] = useState<string | null>(null);

  useEffect(() => {
    if (analysisId) {
      fetchAnalysis();
    }
  }, [analysisId]);

  const fetchAnalysis = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First, get the analysis metadata
      const metadataResponse = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/analyses/${analysisId}`
      );

      if (!metadataResponse.ok) {
        throw new Error('Analysis not found');
      }

      const metadata = await metadataResponse.json();
      setAnalysisStatus(metadata.analysis_info.status);

      // If analysis is still in progress, we need to start streaming
      if (metadata.analysis_info.status === 'processing' || metadata.analysis_info.status === 'queued') {
        // For now, we'll show a loading state and let the user know to wait
        setError('Analysis is still in progress. Please wait for it to complete.');
        setIsLoading(false);
        return;
      }

      // If analysis is completed, get the results
      if (metadata.analysis_info.status === 'completed') {
        const resultsResponse = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/analyses/${analysisId}/results/comprehensive`
        );

        if (!resultsResponse.ok) {
          throw new Error('Analysis results not found');
        }

        const results = await resultsResponse.json();

        // Combine metadata and results
        setAnalysis({
          ...results,
          analysis_id: analysisId,
          metadata: metadata.analysis_info,
          paper_info: metadata.paper_info
        });
      }

    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setIsLoading(false);
    }
  };

  if (error && analysisStatus !== 'processing' && analysisStatus !== 'queued') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analysis</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchAnalysis}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If analysis is still in progress, show streaming interface
  if (analysisStatus === 'processing' || analysisStatus === 'queued') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Analysis in Progress</h2>
              <p className="text-gray-600 mb-4">
                Your paper is being analyzed. This may take a few minutes.
              </p>
              <p className="text-sm text-gray-500">
                Status: {analysisStatus === 'queued' ? 'Queued' : 'Processing'}
              </p>
              <button
                onClick={fetchAnalysis}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Check Status
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If analysis is completed, show results
  if (analysis) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnalysisResults analysis={analysis} isLoading={false} />
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading analysis...</p>
      </div>
    </div>
  );
};

export default AnalysisPage;
