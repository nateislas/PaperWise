import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import AnalysisResults from '../components/AnalysisResults';
import StreamingAnalysisResults from '../components/StreamingAnalysisResults';
import { repairTruncatedJson } from '../utils/jsonRepair';
import {
  PdfLoader,
  PdfHighlighter,
  TextHighlight,
  AreaHighlight,
  useHighlightContainerContext
} from 'react-pdf-highlighter-plus';
import 'react-pdf-highlighter-plus/style/style.css';
import 'pdfjs-dist/web/pdf_viewer.css';
import * as pdfjs from 'pdfjs-dist';

// Explicitly set the PDF.js worker to load from the local public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const SafePdfLoader = PdfLoader as any;
const SafePdfHighlighter = PdfHighlighter as any;
const SafeTextHighlight = TextHighlight as any;
const SafeAreaHighlight = AreaHighlight as any;

const COLOR_PRESETS = [
  { name: 'Yellow', highlightColor: 'rgba(250, 204, 21, 0.35)', underlineColor: 'rgba(234, 179, 8, 1)', solid: '#eab308' },
  { name: 'Green', highlightColor: 'rgba(74, 222, 128, 0.35)', underlineColor: 'rgba(34, 197, 94, 1)', solid: '#22c55e' },
  { name: 'Blue', highlightColor: 'rgba(96, 165, 250, 0.35)', underlineColor: 'rgba(59, 130, 246, 1)', solid: '#3b82f6' },
  { name: 'Pink', highlightColor: 'rgba(248, 113, 113, 0.35)', underlineColor: 'rgba(239, 68, 68, 1)', solid: '#ef4444' },
  { name: 'Purple', highlightColor: 'rgba(192, 132, 252, 0.35)', underlineColor: 'rgba(168, 85, 247, 1)', solid: '#a855f7' },
];

const HighlightComponent = ({ 
  onStyleChange, 
  onDelete 
}: { 
  onStyleChange: (id: string, color?: string, style?: string) => void;
  onDelete: (id: string) => void;
}) => {
  const { highlight, isScrolledTo } = useHighlightContainerContext();
  const isAreaHighlight = !highlight.position.rects || highlight.position.rects.length === 0;

  return isAreaHighlight ? (
    <SafeAreaHighlight
      highlight={highlight}
      isScrolledTo={isScrolledTo}
      onChange={(rect: any) => {}}
      highlightColor={(highlight as any).highlightColor}
      onStyleChange={(style: any) => {
        onStyleChange(highlight.id, style.highlightColor, undefined);
      }}
      onDelete={() => {
        onDelete(highlight.id);
      }}
    />
  ) : (
    <SafeTextHighlight
      highlight={highlight}
      isScrolledTo={isScrolledTo}
      onClick={() => {}}
      highlightColor={(highlight as any).highlightColor}
      highlightStyle={(highlight as any).highlightStyle}
      onStyleChange={(style: any) => {
        onStyleChange(highlight.id, style.highlightColor, style.highlightStyle);
      }}
      onDelete={() => {
        onDelete(highlight.id);
      }}
    />
  );
};

interface SelectionTipProps {
  onAnnotate: (selection: any) => void;
  onChat: (selection: any) => void;
  utilsRef: React.MutableRefObject<any>;
}

const SelectionTip: React.FC<SelectionTipProps> = ({ onAnnotate, onChat, utilsRef }) => {
  const selection = utilsRef.current?.getCurrentSelection();
  if (!selection) return null;

  return (
    <div 
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-soft-lg border border-slate-800 p-1 flex items-center space-x-1 animate-fade-in z-50"
    >
      <button
        type="button"
        onClick={() => onAnnotate(selection)}
        className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-slate-800 rounded-lg transition-colors focus-ring text-xs font-bold text-slate-100 hover:text-white"
      >
        <span>📝</span>
        <span>Annotate</span>
      </button>
      <div className="h-4 w-[1px] bg-slate-800" />
      <button
        type="button"
        onClick={() => onChat(selection)}
        className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-slate-800 rounded-lg transition-colors focus-ring text-xs font-bold text-slate-100 hover:text-white"
      >
        <span>💬</span>
        <span>Ask AI</span>
      </button>
    </div>
  );
};

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
  const [selectedStyle, setSelectedStyle] = useState<'highlight' | 'underline'>('highlight');
  const [selectedColorName, setSelectedColorName] = useState<string>('Yellow');
  const [pdfScale, setPdfScale] = useState<number>(1.1);
  const [chatContext, setChatContext] = useState<{ page: number; text: string } | null>(null);

  const [chatMessages, setChatMessages] = useState<Array<{ 
    role: 'user' | 'assistant', 
    content: string, 
    sources?: string[], 
    contextText?: string, 
    fullContent?: string 
  }>>([
    { role: 'assistant', content: 'Hello! I am your PaperWise AI assistant. Ask me anything about this paper!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showPdf, setShowPdf] = useState<boolean>(true);

  // Native PDF highlights states & refs
  const [pendingPosition, setPendingPosition] = useState<any | null>(null);
  const [pendingHideTip, setPendingHideTip] = useState<(() => void) | null>(null);
  const scrollViewerTo = useRef<((highlight: any) => void) | null>(null);
  const highlighterUtilsRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const el = document.querySelector('.PdfHighlighter');
      const innerWrapper = el?.parentElement;
      const leftCol = innerWrapper?.parentElement;
      const mainLayout = leftCol?.parentElement;
      const pageRoot = mainLayout?.parentElement;
      const appMain = pageRoot?.parentElement;
      const appRoot = appMain?.parentElement;

      const getStyleInfo = (node: Element | null | undefined, name: string) => {
        if (!node) return `${name}: NULL`;
        const style = window.getComputedStyle(node);
        return `${name} [${node.tagName.toLowerCase()}.${node.className.split(' ').join('.')}] -> height: ${style.height}, offsetHeight: ${(node as HTMLElement).offsetHeight}px, display: ${style.display}, position: ${style.position}`;
      };

      console.log('📊 COMPREHENSIVE LAYOUT HIERARCHY CHECK:');
      console.log(getStyleInfo(appRoot, '1. App Root'));
      console.log(getStyleInfo(appMain, '2. App Main'));
      console.log(getStyleInfo(pageRoot, '3. Page Root'));
      console.log(getStyleInfo(mainLayout, '4. Main Layout'));
      console.log(getStyleInfo(leftCol, '5. Left Column'));
      console.log(getStyleInfo(innerWrapper, '6. Inner Wrapper'));
      console.log(getStyleInfo(el, '7. PdfHighlighter'));
      
      const viewer = document.querySelector('.pdfViewer');
      if (viewer) {
        console.log(`8. pdfViewer -> height: ${window.getComputedStyle(viewer).height}, offsetHeight: ${(viewer as HTMLElement).offsetHeight}px`);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectionFinished = (selection: any) => {
    if (!selection) return;
    setActiveTab('annotations');
    setNewAnnotation({
      page: selection.position?.pageNumber || 1,
      text: selection.content?.text || '',
      note: ''
    });
    setPendingPosition(selection.position);
    setPendingHideTip(() => () => {
      window.getSelection()?.removeAllRanges();
    });
  };

  const handleAnnotate = (selection: any) => {
    handleSelectionFinished(selection);
    if (highlighterUtilsRef.current) {
      highlighterUtilsRef.current.setTip(null);
    }
  };

  const handleChat = (selection: any) => {
    setActiveTab('chat');
    setChatContext({
      page: selection.position?.pageNumber || 1,
      text: selection.content?.text || ''
    });
    setChatInput('');
    
    window.getSelection()?.removeAllRanges();
    if (highlighterUtilsRef.current) {
      highlighterUtilsRef.current.setTip(null);
    }

    setTimeout(() => {
      const input = document.querySelector('input[placeholder*="Ask the AI"]') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  };

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

    const userMsg = { 
      role: 'user' as const, 
      content: text,
      contextText: chatContext ? `Page ${chatContext.page}: "${chatContext.text}"` : undefined,
      fullContent: chatContext 
        ? `Context from page ${chatContext.page} of the paper:\n"${chatContext.text}"\n\nQuestion: ${text}`
        : text
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    const currentContext = chatContext;
    setChatContext(null);
    setIsChatLoading(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        content: (m as any).fullContent || m.content
      }));

      const payloadMessage = currentContext
        ? `Context from page ${currentContext.page} of the paper:\n"${currentContext.text}"\n\nQuestion: ${text}`
        : text;

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: payloadMessage, history })
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
    
    const preset = COLOR_PRESETS.find(p => p.name === selectedColorName) || COLOR_PRESETS[0];
    const item: any = {
      id: Math.random().toString(36).substr(2, 9),
      page: newAnnotation.page,
      text: newAnnotation.text,
      note: newAnnotation.note || '',
      created_at: new Date().toISOString(),
      // Add position and content if we have a pending highlight selection
      position: pendingPosition || undefined,
      content: pendingPosition ? { text: newAnnotation.text } : undefined,
      comment: { text: newAnnotation.note || '' },
      highlightColor: selectedStyle === 'highlight' ? preset.highlightColor : preset.underlineColor,
      highlightStyle: selectedStyle,
      colorName: selectedColorName
    };
    
    const updated = [...annotations, item];
    setAnnotations(updated);
    setNewAnnotation({ page: 1, text: '', note: '' });
    setSelectedStyle('highlight');
    setSelectedColorName('Yellow');
    setPendingPosition(null);
    if (pendingHideTip) {
      pendingHideTip();
      setPendingHideTip(null);
    }

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

  const handleUpdateAnnotationStyle = async (id: string, color?: string, style?: string) => {
    const updated = annotations.map(ann => {
      if (ann.id === id) {
        return {
          ...ann,
          highlightColor: color ?? ann.highlightColor,
          highlightStyle: style ?? ann.highlightStyle
        };
      }
      return ann;
    });
    setAnnotations(updated);
    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyses/${analysisId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotations: updated })
      });
    } catch (err) {
      console.error('Failed to update annotation style', err);
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
    <div className="min-h-screen bg-slate-50/30">
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
      <main 
        className="flex overflow-hidden" 
        style={{ height: 'calc(100vh - 160px)' }}
      >
        {/* Left Side: PDF Viewer */}
        {showPdf && (
          <div 
            className="w-1/2 border-r border-slate-200 bg-slate-100/50 relative"
            style={{ height: '100%' }}
          >
            <div 
              className="bg-white rounded-2xl shadow-soft overflow-hidden border border-slate-200"
              style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', bottom: '1rem' }}
            >
              <SafePdfLoader document={pdfUrl} workerSrc="/pdf.worker.min.mjs" beforeLoad={() => <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div><p className="ml-3 text-slate-500 font-medium">Loading document...</p></div>}>
                {(pdfDocument: any) => {
                  console.log("📄 pdfDocument loaded successfully:", pdfDocument);
                  return (
                    <SafePdfHighlighter
                      pdfDocument={pdfDocument}
                      pdfScaleValue={pdfScale}
                      enableAreaSelection={(event: any) => event.altKey}
                      onScrollChange={() => {}}
                      utilsRef={(utils: any) => {
                        highlighterUtilsRef.current = utils;
                        scrollViewerTo.current = utils.scrollToHighlight;
                      }}
                      onSelection={() => {}}
                      selectionTip={
                        <SelectionTip
                          onAnnotate={handleAnnotate}
                          onChat={handleChat}
                          utilsRef={highlighterUtilsRef}
                        />
                      }
                      highlights={annotations.filter(ann => ann.position)}
                    >
                      <HighlightComponent 
                        onStyleChange={handleUpdateAnnotationStyle}
                        onDelete={handleDeleteAnnotation}
                      />
                    </SafePdfHighlighter>
                  );
                }}
              </SafePdfLoader>
            </div>
            
            {/* Floating Zoom Controls */}
            <div className="absolute bottom-6 right-6 z-30 flex items-center bg-slate-900/95 backdrop-blur-md text-white px-3 py-1.5 rounded-xl shadow-soft-lg border border-slate-800 space-x-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPdfScale(prev => Math.max(0.5, prev - 0.1))}
                className="hover:bg-slate-800 p-1.5 rounded-lg transition-colors focus-ring text-slate-300 hover:text-white"
                title="Zoom Out"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>
              <span className="min-w-[45px] text-center select-none font-mono">{Math.round(pdfScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setPdfScale(prev => Math.min(3.0, prev + 0.1))}
                className="hover:bg-slate-800 p-1.5 rounded-lg transition-colors focus-ring text-slate-300 hover:text-white"
                title="Zoom In"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
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
                  
                  {/* Style & Color Selector */}
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-3">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Style Type</span>
                      <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/30">
                        <button
                          type="button"
                          onClick={() => setSelectedStyle('highlight')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all focus-ring ${
                            selectedStyle === 'highlight'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/10'
                              : 'text-slate-500 hover:text-slate-750'
                          }`}
                        >
                          🖊️ Highlight
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedStyle('underline')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all focus-ring ${
                            selectedStyle === 'underline'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/10'
                              : 'text-slate-500 hover:text-slate-750'
                          }`}
                        >
                          ⎯ Underline
                        </button>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Color Preset</span>
                      <div className="flex items-center space-x-2.5 h-[42px]">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setSelectedColorName(preset.name)}
                            title={preset.name}
                            className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 focus-ring ${
                              selectedColorName === preset.name
                                ? 'border-slate-800 shadow-sm scale-110'
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: preset.solid }}
                          />
                        ))}
                      </div>
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
                      <p className="text-sm font-medium text-slate-400">No notes yet. Select text in the document or type below to annotate!</p>
                    </div>
                  ) : (
                    annotations.map(ann => (
                      <div 
                        key={ann.id} 
                        onClick={() => {
                          if (ann.position && scrollViewerTo.current) {
                            scrollViewerTo.current(ann);
                          } else if (ann.page && highlighterUtilsRef.current) {
                            highlighterUtilsRef.current.goToPage(ann.page);
                          }
                        }}
                        className="bg-white border border-slate-100 rounded-2xl p-6 shadow-soft relative group hover:border-primary-200 transition-colors cursor-pointer border-l-4 border-l-primary-500"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent trigger scrolling
                            handleDeleteAnnotation(ann.id);
                          }}
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
                          {ann.position && <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">📝 PDF Link</span>}
                          {ann.highlightStyle && (
                            <span 
                              className="text-[10px] font-bold px-2 py-1 rounded-md uppercase"
                              style={{ 
                                backgroundColor: ann.highlightStyle === 'highlight' 
                                  ? (ann.highlightColor ? ann.highlightColor.replace('0.35', '0.15').replace('0.3', '0.15') : 'rgba(250, 204, 21, 0.15)') 
                                  : 'rgba(241, 245, 249, 0.7)',
                                color: ann.highlightStyle === 'highlight' 
                                  ? '#1e293b' 
                                  : (ann.highlightColor || '#ef4444'),
                                border: ann.highlightStyle === 'underline' 
                                  ? `1px solid ${ann.highlightColor || '#ef4444'}` 
                                  : 'none'
                              }}
                            >
                              {ann.highlightStyle === 'highlight' ? '🖊️ Highlight' : '⎯ Underline'}
                            </span>
                          )}
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
                          {msg.contextText && (
                            <div className="mb-2.5 p-2.5 bg-black/10 border-l-2 border-white/45 rounded-lg text-[11px] font-medium text-white/90 truncate italic">
                              {msg.contextText}
                            </div>
                          )}
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
                    className="p-4 bg-white border-t border-slate-100 flex flex-col space-y-3"
                  >
                    {/* Selected Context Attachment */}
                    {chatContext && (
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 animate-fade-in shadow-sm">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="shrink-0 font-bold px-1.5 py-0.5 bg-slate-200/70 text-slate-700 rounded-md">Page {chatContext.page}</span>
                          <span className="truncate italic font-medium">"{chatContext.text}"</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChatContext(null)}
                          className="text-slate-400 hover:text-slate-600 ml-2 focus-ring rounded-full p-0.5 hover:bg-slate-200/50 transition-colors"
                          title="Remove context"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
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
                    </div>
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
