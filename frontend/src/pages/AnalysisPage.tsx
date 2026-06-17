import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AnalysisResults from '../components/AnalysisResults';
import StreamingAnalysisResults from '../components/StreamingAnalysisResults';

interface AnalysisPageProps {}

function repairTruncatedJson(jsonStr: string): string {
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (e) {}

  let repaired = jsonStr.trim();
  if (repaired.startsWith('```json')) {
    repaired = repaired.slice(7).trim();
  } else if (repaired.startsWith('```')) {
    repaired = repaired.slice(3).trim();
  }
  if (repaired.endsWith('```')) {
    repaired = repaired.slice(0, -3).trim();
  }

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  if (inString) {
    repaired += '"';
  }

  while (stack.length > 0) {
    const closingChar = stack.pop();
    repaired += closingChar;
  }

  return repaired;
}

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
      const status = metadata.analysis_info?.status || 'unknown';
      console.log('📊 Analysis status:', status);
      console.log('📋 Full metadata:', metadata);
      setAnalysisStatus(status);

      // Extract fileId from original_filename if analysis is in progress
      if (status === 'processing' || status === 'queued') {
        const originalFilename = metadata.paper_info?.original_filename;
        console.log('🔍 Extracting fileId from:', originalFilename);
        let extractedFileId = '';
        if (originalFilename && originalFilename.includes('_')) {
          extractedFileId = originalFilename.split('_')[0];
          console.log('✅ Extracted fileId:', extractedFileId);
          setFileId(extractedFileId);
        } else {
          console.log('⚠️ Could not extract fileId from filename:', originalFilename);
        }
        
        // Set basic metadata so the page layout shows the PDF viewer immediately
        setAnalysis({
          analysis_id: analysisId,
          paper_info: metadata.paper_info,
          analysis_info: metadata.analysis_info
        });
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
            const repaired = repairTruncatedJson(parsedComprehensiveAnalysis);
            parsedComprehensiveAnalysis = JSON.parse(repaired);
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

  // Early return for streaming interface removed. Live analysis now streams inside the tabbed layout.



  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8081';
  const pdfUrl = `${apiBaseUrl}/api/v1/analyses/${analysisId}/paper`;

  const isPlaceholder = 
    analysis?.analysis?.executive_summary?.includes("run the full multi-agent AI") ||
    analysis?.comprehensive_analysis?.executive_summary?.includes("run the full multi-agent AI");

  if (!analysis) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-bold tracking-tight">Synchronizing library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/30 flex flex-col">
      {/* Sub-header controls */}
      <header className="sticky top-20 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/50 px-8 py-4 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900 truncate">
              {analysis?.paper_info?.title || 'Research Paper Analysis'}
            </h2>
          </div>
          <div className="flex items-center space-x-4 shrink-0">
            {isPlaceholder && (
              <button
                onClick={() => {
                  setAnalysisStatus('processing');
                  setFileId(analysisId || null);
                  setAnalysis(null);
                }}
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-bold rounded-xl text-white bg-primary-600 hover:bg-primary-700 shadow-soft hover:shadow-soft-lg transition-all focus-ring animate-pulse-slow"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Run Multi-Agent Analysis
              </button>
            )}
            <button
              onClick={() => setShowPdf(!showPdf)}
              className="inline-flex items-center px-5 py-2.5 border border-slate-200 text-sm font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all focus-ring"
              aria-expanded={showPdf}
            >
              <svg className="h-4 w-4 mr-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {showPdf ? 'Hide Document' : 'View Document'}
            </button>
          </div>
        </div>
      </header>

      {/* Layout container */}
      <main className="flex-1 flex overflow-hidden h-[calc(100vh-144px)]">
        {/* Left Side: PDF Viewer */}
        {showPdf && (
          <div className="w-1/2 h-full border-r border-slate-200 bg-slate-100/50 p-4">
            <div className="w-full h-full bg-white rounded-2xl shadow-soft overflow-hidden border border-slate-200">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="Academic Paper Viewer"
              />
            </div>
          </div>
        )}

        {/* Right Side: Tabbed Workspace */}
        <div className={`${showPdf ? 'w-1/2' : 'w-full'} h-full flex flex-col bg-white`}>
          {/* Tabs */}
          <nav className="bg-slate-50 border-b border-slate-200 flex px-6" aria-label="Analysis Workspace">
            {[
              { id: 'analysis', label: 'AI Insights' },
              { id: 'annotations', label: `Annotations (${annotations.length})` },
              { id: 'chat', label: 'Knowledge Chat' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-6 text-sm font-bold border-b-2 transition-all focus-ring ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'analysis' && (
              <div className="animate-fade-in">
                {analysisStatus === 'processing' || analysisStatus === 'queued' ? (
                  <StreamingAnalysisResults
                    fileId={fileId || ''}
                    onComplete={(finalAnalysis) => {
                      setAnalysis(finalAnalysis);
                      setAnalysisStatus('completed');
                    }}
                    onError={(errorMessage) => {
                      setError(errorMessage);
                    }}
                  />
                ) : (
                  <AnalysisResults analysis={analysis} isLoading={false} />
                )}
              </div>
            )}

            {activeTab === 'annotations' && (
              <div className="space-y-10 animate-fade-in max-w-3xl mx-auto">
                <header>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Paper Annotations</h3>
                  <p className="text-sm font-medium text-slate-500 mt-1">Keep track of your thoughts and citations</p>
                </header>
                
                {/* Add Annotation Form */}
                <form onSubmit={handleAddAnnotation} className="bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Create New Note</h4>
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-2">
                      <label htmlFor="page-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Page</label>
                      <input
                        id="page-input"
                        type="number"
                        min="1"
                        value={newAnnotation.page}
                        onChange={e => setNewAnnotation({ ...newAnnotation, page: parseInt(e.target.value) || 1 })}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus-ring bg-white text-slate-800"
                      />
                    </div>
                    <div className="col-span-4">
                      <label htmlFor="ref-text" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Reference Text</label>
                      <input
                        id="ref-text"
                        type="text"
                        placeholder="Snippet from paper..."
                        value={newAnnotation.text}
                        onChange={e => setNewAnnotation({ ...newAnnotation, text: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus-ring bg-white text-slate-800"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="note-text" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Personal Insight</label>
                    <textarea
                      id="note-text"
                      rows={4}
                      placeholder="Why is this important? Any related papers?"
                      value={newAnnotation.note}
                      onChange={e => setNewAnnotation({ ...newAnnotation, note: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus-ring bg-white text-slate-800"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all shadow-soft focus-ring"
                  >
                    Save Annotation
                  </button>
                </form>

                {/* List of Annotations */}
                <div className="space-y-4">
                  {annotations.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-sm font-medium text-slate-400">No notes yet. Be the first to annotate this paper!</p>
                    </div>
                  ) : (
                    annotations.map(ann => (
                      <div key={ann.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-soft relative group hover:border-primary-200 transition-colors">
                        <button
                          onClick={() => handleDeleteAnnotation(ann.id)}
                          className="absolute top-4 right-4 text-slate-300 hover:text-rose-600 transition-colors hidden group-hover:block"
                          aria-label="Delete annotation"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <div className="flex items-center space-x-3 mb-4">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-primary-50 text-primary-700 uppercase">Page {ann.page}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(ann.created_at).toLocaleDateString()}</span>
                        </div>
                        <blockquote className="border-l-4 border-slate-200 pl-4 italic text-sm text-slate-600 mb-4 py-1">
                          "{ann.text}"
                        </blockquote>
                        {ann.note && (
                          <p className="text-sm font-medium text-slate-800 leading-relaxed">{ann.note}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-full animate-fade-in max-w-3xl mx-auto">
                <div className="flex-1 bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden shadow-inner flex flex-col">
                  {/* Chat messages area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-soft ${
                          msg.role === 'user'
                            ? 'bg-primary-600 text-white rounded-br-none'
                            : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</p>
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-100/20 flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sources:</span>
                              {msg.sources.map((src, sidx) => (
                                <span key={sidx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-200">
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
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none p-4 shadow-soft flex items-center space-x-3 text-sm text-slate-500 font-bold">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                          <span>Assistant is reflecting...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suggestion Prompts */}
                  <div className="px-6 py-4 bg-white/50 backdrop-blur-sm border-t border-slate-100 flex flex-wrap gap-2">
                    {['Summarize methodology', 'Key findings', 'Practical applications'].map((prompt, pidx) => (
                      <button
                        key={pidx}
                        type="button"
                        onClick={() => handleSendChatMessage(prompt)}
                        disabled={analysisStatus === 'processing' || analysisStatus === 'queued'}
                        className="text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-primary-50 text-slate-500 hover:text-primary-600 border border-slate-200 hover:border-primary-200 px-3 py-1.5 rounded-lg transition-all shadow-sm focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="p-4 bg-white border-t border-slate-100 flex items-center space-x-3"
                  >
                    <input
                      type="text"
                      placeholder={analysisStatus === 'processing' || analysisStatus === 'queued' ? "Chat will be available once analysis is complete..." : "Ask the AI about this paper..."}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isChatLoading || analysisStatus === 'processing' || analysisStatus === 'queued'}
                      className="flex-1 border border-slate-200 rounded-xl px-5 py-3 text-sm focus-ring bg-slate-50 text-slate-800 placeholder-slate-400 disabled:opacity-50 font-medium"
                      aria-label="Chat input"
                    />
                    <button
                      type="submit"
                      disabled={isChatLoading || !chatInput.trim() || analysisStatus === 'processing' || analysisStatus === 'queued'}
                      className="bg-primary-600 hover:bg-primary-700 text-white rounded-xl p-3 transition-all shadow-soft disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                      aria-label="Send message"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AnalysisPage;
