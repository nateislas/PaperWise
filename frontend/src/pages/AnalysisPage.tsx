import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AnalysisResults from '../components/AnalysisResults';
import StreamingAnalysisResults from '../components/StreamingAnalysisResults';

interface AnalysisPageProps {}

const AnalysisPage: React.FC<AnalysisPageProps> = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('unknown');
  const [fileId, setFileId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'analysis' | 'annotations' | 'chat'>('analysis');
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [newAnnotation, setNewAnnotation] = useState({ page: 1, text: '', note: '' });

  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, sources?: string[] }>>([
    { role: 'assistant', content: 'Hello! I am your PaperWise AI assistant. Ask me anything about this paper!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showPdf, setShowPdf] = useState<boolean>(true);

  const fetchAnnotations = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}/annotations`);
      if (response.ok) {
        const data = await response.json();
        setAnnotations(data.annotations || []);
      }
    } catch (err) {
      console.error('Failed to fetch annotations', err);
    }
  }, [analysisId]);

  const fetchAnalysis = useCallback(async () => {
    try {
      setError(null);

      // First, get the analysis metadata
      const metadataResponse = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}`
      );

      if (!metadataResponse.ok) {
        throw new Error('Analysis not found');
      }

      const metadata = await metadataResponse.json();
      console.log('📊 Analysis status:', metadata.analysis_info.status);
      console.log('📋 Full metadata:', metadata);
      setAnalysisStatus(metadata.analysis_info.status);

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
          `${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}/results/comprehensive`
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
            model_used: metadata.analysis_info?.model || "gemini-2.5-flash"
          },
          paper_info: metadata.paper_info
        });
      }

    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    }
  }, [analysisId]);

  useEffect(() => {
    if (analysisId) {
      fetchAnalysis();
      fetchAnnotations();
    }
  }, [analysisId, fetchAnalysis, fetchAnnotations]);

  const handleSendChatMessage = async (messageToSend?: string) => {
    const text = messageToSend || chatInput;
    if (!text.trim() || isChatLoading) return;

    const userMsg = { role: 'user' as const, content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history })
      });

      if (!response.ok) {
        throw new Error('Failed to query paper chatbot');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message || 'Unable to connect to the assistant.'}`
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleAddAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnotation.text.trim()) return;
    const item = {
      id: Math.random().toString(36).substr(2, 9),
      page: newAnnotation.page,
      text: newAnnotation.text,
      note: newAnnotation.note,
      created_at: new Date().toISOString()
    };
    const updated = [...annotations, item];
    setAnnotations(updated);
    setNewAnnotation({ page: newAnnotation.page, text: '', note: '' });

    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotations: updated })
      });
    } catch (err) {
      console.error('Failed to save annotation', err);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    const updated = annotations.filter(ann => ann.id !== id);
    setAnnotations(updated);
    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotations: updated })
      });
    } catch (err) {
      console.error('Failed to delete annotation', err);
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
    const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8081';
    const pdfUrl = `${apiBaseUrl}/api/v1/analyses/${analysisId}/paper`;

    const isPlaceholder = 
      analysis.analysis?.executive_summary?.includes("run the full multi-agent AI") ||
      analysis.comprehensive_analysis?.executive_summary?.includes("run the full multi-agent AI");

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Sub-header controls */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-800 truncate max-w-xl">
              {analysis.paper_info?.title || 'Research Paper Analysis'}
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            {isPlaceholder && (
              <button
                onClick={() => {
                  setAnalysisStatus('processing');
                  setFileId(analysisId || null);
                  setAnalysis(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors mr-2 animate-pulse"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Run AI Analysis
              </button>
            )}
            <button
              onClick={() => setShowPdf(!showPdf)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {showPdf ? 'Hide PDF' : 'Show PDF'}
            </button>
          </div>
        </div>

        {/* Layout container */}
        <div className="flex-1 flex overflow-hidden h-[calc(100vh-125px)]">
          {/* Left Side: PDF Viewer */}
          {showPdf && (
            <div className="w-1/2 h-full border-r border-gray-200 bg-gray-100 flex flex-col">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="Paper PDF Viewer"
              />
            </div>
          )}

          {/* Right Side: Tabbed Workspace */}
          <div className={`${showPdf ? 'w-1/2' : 'w-full'} h-full flex flex-col`}>
            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 flex">
              <button
                onClick={() => setActiveTab('analysis')}
                className={`flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'analysis'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AI Analysis
              </button>
              <button
                onClick={() => setActiveTab('annotations')}
                className={`flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'annotations'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Annotations & Notes ({annotations.length})
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'chat'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Chat Box
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'analysis' && (
                <AnalysisResults analysis={analysis} isLoading={false} />
              )}

              {activeTab === 'annotations' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">Paper Annotations</h3>
                  
                  {/* Add Annotation Form */}
                  <form onSubmit={handleAddAnnotation} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Add Annotation / Note</h4>
                    <div className="grid grid-cols-6 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Page</label>
                        <input
                          type="number"
                          min="1"
                          value={newAnnotation.page}
                          onChange={e => setNewAnnotation({ ...newAnnotation, page: parseInt(e.target.value) || 1 })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Reference/Highlighted Text (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Section 2.1 description of models"
                          value={newAnnotation.text}
                          onChange={e => setNewAnnotation({ ...newAnnotation, text: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">My Note / Explanation</label>
                      <textarea
                        rows={3}
                        placeholder="Write your note or thoughts here..."
                        value={newAnnotation.note}
                        onChange={e => setNewAnnotation({ ...newAnnotation, note: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold transition-colors shadow-sm"
                    >
                      Save Annotation
                    </button>
                  </form>

                  {/* List of Annotations */}
                  <div className="space-y-3">
                    {annotations.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
                        No annotations yet. Reference text and take notes on specific sections.
                      </p>
                    ) : (
                      annotations.map(ann => (
                        <div key={ann.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative group">
                          <button
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 transition-colors hidden group-hover:block"
                            title="Delete note"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-600 mb-1">
                            <span>Page {ann.page}</span>
                            <span>•</span>
                            <span className="text-gray-400">{new Date(ann.created_at).toLocaleDateString()}</span>
                          </div>
                          <blockquote className="border-l-2 border-blue-200 pl-3 italic text-sm text-gray-600 mb-2 bg-gray-50 py-1 rounded-r">
                            "{ann.text}"
                          </blockquote>
                          {ann.note && (
                            <p className="text-sm text-gray-800 leading-relaxed">{ann.note}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="flex flex-col h-[calc(100vh-230px)] bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  {/* Chat messages area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2 pt-1 border-t border-gray-100 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                              <span className="font-semibold text-gray-700">Sources:</span>
                              {msg.sources.map((src, sidx) => (
                                <span key={sidx} className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium text-gray-600">
                                  {src}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none p-3 shadow-sm flex items-center space-x-2 text-sm text-gray-500">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span>Assistant is reading & thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suggestion Prompts */}
                  <div className="px-4 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-2">
                    {['Summarize findings', 'Identify limitations', 'Explain methodology'].map((prompt, pidx) => (
                      <button
                        key={pidx}
                        type="button"
                        onClick={() => handleSendChatMessage(prompt)}
                        className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded transition-colors shadow-2xs font-medium"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {/* Chat input form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChatMessage();
                    }}
                    className="p-3 bg-white border-t border-gray-200 flex items-center space-x-2"
                  >
                    <input
                      type="text"
                      placeholder="Ask a question about this paper..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isChatLoading}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isChatLoading || !chatInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
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
