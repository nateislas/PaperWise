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
  const [metadata, setMetadata] = useState<any>(null);

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
      console.log('📊 Analysis status:', metadata.analysis_info.status);
      console.log('📋 Full metadata:', metadata);
      setAnalysisStatus(metadata.analysis_info.status);
      setMetadata(metadata);

      // Extract fileId from original_filename if analysis is in progress
      if (metadata.analysis_info.status === 'processing' || metadata.analysis_info.status === 'queued') {
        const originalFilename = metadata.paper_info.original_filename;
        console.log('🔍 Extracting fileId from:', originalFilename);
        if (originalFilename && originalFilename.includes('_')) {
          const extractedFileId = originalFilename.split('_')[0];
          console.log('✅ Extracted fileId:', extractedFileId);
          setFileId(extractedFileId);
        } else {
          console.log('⚠️ Could not extract fileId from filename:', originalFilename);
        }
        return; // Don't fetch results yet, let streaming handle it
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

        // Parse the comprehensive_analysis if it's a JSON string
        let parsedComprehensiveAnalysis = results.comprehensive_analysis;
        if (typeof parsedComprehensiveAnalysis === 'string') {
          try {
            // Remove markdown code blocks if present
            let cleanedAnalysis = parsedComprehensiveAnalysis.trim();
            if (cleanedAnalysis.startsWith('```json') && cleanedAnalysis.endsWith('```')) {
              cleanedAnalysis = cleanedAnalysis.slice(7, -3).trim();
            } else if (cleanedAnalysis.startsWith('```') && cleanedAnalysis.endsWith('```')) {
              cleanedAnalysis = cleanedAnalysis.slice(3, -3).trim();
            }
            parsedComprehensiveAnalysis = JSON.parse(cleanedAnalysis);
          } catch (parseError) {
            console.error('Failed to parse comprehensive_analysis:', parseError);
            // Keep as string if parsing fails
          }
        }

        // Combine metadata and results in the correct format
        setAnalysis({
          analysis_id: analysisId,
          field: results.field,
          subfield: results.subfield,
          conferences: results.conferences,
          field_confidence: results.field_confidence,
          sections: results.sections || [],
          figures: results.figures || [],
          comprehensive_analysis: parsedComprehensiveAnalysis,
          metadata: {
            analysis_timestamp: metadata.completed_at,
            analysis_confidence: 0.85, // Default confidence
            model_used: "Llama-4-Maverick-17B-128E-Instruct-FP8"
          },
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
  console.log('🎯 Render logic - analysisStatus:', analysisStatus);
  if (analysisStatus === 'processing' || analysisStatus === 'queued') {
    console.log('🔄 Showing streaming interface');
    console.log('📤 Passing fileId to StreamingAnalysisResults:', fileId);
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <StreamingAnalysisResults
            fileId={fileId || ''} // Use extracted fileId for streaming
            onComplete={(finalAnalysis) => {
              setAnalysis(finalAnalysis);
              setAnalysisStatus('completed');
            }}
            onError={(errorMessage) => {
              setError(errorMessage);
            }}
          />
        </div>
      </div>
    );
  }

  // If analysis is completed, show results
  if (analysis) {
    console.log('✅ Showing completed analysis results');
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
