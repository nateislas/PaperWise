import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  TrendingUp, 
  Target, 
  Lightbulb, 
  AlertTriangle,
  CheckCircle,
  Loader,
  Play,
  FileText,
  Sparkles,
  Clock,
  Layers,
  RefreshCw,
  Award,
  ChevronDown,
  ChevronUp,
  Bot
} from 'lucide-react';
import AnalysisResults from './AnalysisResults';
import { repairTruncatedJson } from '../utils/jsonRepair';

interface StreamingAnalysisResultsProps {
  fileId: string;
  onComplete?: (analysis: any) => void;
  onError?: (error: string) => void;
}

interface StreamChunk {
  type: string;
  stage?: string;
  analysis_id?: string;
  message?: string;
  content?: string;
  progress?: number;
  analysis?: any;
  elapsed_time?: number;
}

const STAGES = [
  {
    id: 'parsing',
    title: 'Extraction & OCR',
    subtitle: 'Extracting text, figures & tables',
    icon: FileText,
    minProgress: 0,
    maxProgress: 25
  },
  {
    id: 'classification',
    title: 'Field Calibration',
    subtitle: 'Classifying domain & rubrics',
    icon: Layers,
    minProgress: 25,
    maxProgress: 35
  },
  {
    id: 'round_1_debate',
    title: 'Round 1 Drafts',
    subtitle: 'Parallel expert evaluations',
    icon: Sparkles,
    minProgress: 35,
    maxProgress: 60
  },
  {
    id: 'round_2_debate',
    title: 'Peer Review & Debate',
    subtitle: 'Cross-agent critique & revision',
    icon: RefreshCw,
    minProgress: 60,
    maxProgress: 90
  },
  {
    id: 'synthesis',
    title: 'Final Synthesis',
    subtitle: 'Structured verdict & insights',
    icon: Award,
    minProgress: 90,
    maxProgress: 100
  }
];

const StreamingAnalysisResults: React.FC<StreamingAnalysisResultsProps> = ({
  fileId,
  onComplete,
  onError
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(5);
  const [status, setStatus] = useState('Extracting document structure & high-resolution figures...');
  const [currentStage, setCurrentStage] = useState('parsing');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'methodology' | 'results' | 'context'>('methodology');
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(true);

  const [streamingContent, setStreamingContent] = useState({
    methodology: '',
    results: '',
    contextualization: '',
    synthesis: ''
  });

  const contentRef = useRef({
    methodology: '',
    results: '',
    contextualization: '',
    synthesis: ''
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const analysisIdRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);

  // Live timer while streaming is active
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isStreaming) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isStreaming]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStreamChunk = useCallback((chunk: StreamChunk) => {
    if (chunk.stage) {
      setCurrentStage(chunk.stage);
    }

    switch (chunk.type) {
      case 'status':
        setStatus(chunk.message || '');
        if (chunk.progress !== undefined) {
          setProgress(chunk.progress);
        }
        if (chunk.analysis_id) {
          analysisIdRef.current = chunk.analysis_id;
        }
        break;

      case 'methodology_chunk':
        contentRef.current.methodology = chunk.content || contentRef.current.methodology;
        setStreamingContent({ ...contentRef.current });
        if (chunk.progress) setProgress(chunk.progress);
        if (chunk.stage) setCurrentStage(chunk.stage);
        break;

      case 'results_chunk':
        contentRef.current.results = chunk.content || contentRef.current.results;
        setStreamingContent({ ...contentRef.current });
        if (chunk.progress) setProgress(chunk.progress);
        if (chunk.stage) setCurrentStage(chunk.stage);
        break;

      case 'contextualization_chunk':
        contentRef.current.contextualization = chunk.content || contentRef.current.contextualization;
        setStreamingContent({ ...contentRef.current });
        if (chunk.progress) setProgress(chunk.progress);
        if (chunk.stage) setCurrentStage(chunk.stage);
        break;

      case 'synthesis_chunk':
        contentRef.current.synthesis = chunk.content || contentRef.current.synthesis;
        setStreamingContent({ ...contentRef.current });
        if (chunk.progress) setProgress(chunk.progress);
        break;

      case 'complete':
        let parsedAnalysis = chunk.analysis;
        if (parsedAnalysis && parsedAnalysis.comprehensive_analysis && typeof parsedAnalysis.comprehensive_analysis === 'string') {
          try {
            const repaired = repairTruncatedJson(parsedAnalysis.comprehensive_analysis);
            const parsedComprehensiveAnalysis = JSON.parse(repaired);
            parsedAnalysis = {
              ...parsedAnalysis,
              comprehensive_analysis: parsedComprehensiveAnalysis
            };
          } catch (parseError) {
            console.error('⚠️ Failed to parse comprehensive_analysis in complete callback:', parseError);
          }
        }
        
        setAnalysis(parsedAnalysis);
        setProgress(100);
        setCurrentStage('synthesis');
        setStatus('Multi-round debate analysis complete');
        onComplete?.(parsedAnalysis);
        break;

      case 'error':
        setError(chunk.message || 'Analysis failed');
        onError?.(chunk.message || 'Analysis failed');
        break;
    }
  }, [onComplete, onError]);

  const startStreaming = useCallback(async () => {
    if (isStreaming || isStreamingRef.current) return;
    
    setIsStreaming(true);
    isStreamingRef.current = true;
    setError(null);
    setProgress(5);
    setElapsedSeconds(0);
    setCurrentStage('parsing');
    setStatus('Extracting document structure & high-resolution figures...');
    setStreamingContent({
      methodology: '',
      results: '',
      contextualization: '',
      synthesis: ''
    });
    
    contentRef.current = {
      methodology: '',
      results: '',
      contextualization: '',
      synthesis: ''
    };

    try {
      const streamUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyze/stream`;
        
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          file_id: fileId,
          analysis_type: 'comprehensive'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamChunk(data);
            } catch (e) {
              console.warn('Failed to parse stream chunk:', line);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Streaming failed');
      onError?.(err.message || 'Streaming failed');
    } finally {
      setIsStreaming(false);
      isStreamingRef.current = false;
    }
  }, [fileId, isStreaming, onError, handleStreamChunk]);

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    isStreamingRef.current = false;
    setStatus('Analysis stopped');
  };

  useEffect(() => {
    if (fileId && !isStreaming && !analysis) {
      startStreaming();
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fileId, isStreaming, analysis, startStreaming]);

  // Stage helper
  const getStageStatus = (stage: typeof STAGES[0], index: number) => {
    if (progress >= stage.maxProgress || (index === STAGES.length - 1 && progress === 100)) {
      return 'completed';
    }
    if (progress >= stage.minProgress && progress < stage.maxProgress) {
      return 'active';
    }
    return 'pending';
  };

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-red-200 p-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-900">Analysis Error</h2>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
        <button
          onClick={startStreaming}
          className="mt-4 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm shadow-soft transition-all focus-ring"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (analysis) {
    const parseComprehensiveAnalysis = (comprehensiveAnalysis: any) => {
      if (typeof comprehensiveAnalysis === 'object' && comprehensiveAnalysis !== null) {
        return comprehensiveAnalysis;
      }
      try {
        let cleaned = (comprehensiveAnalysis || '').trim();
        if (cleaned.startsWith('```json') && cleaned.endsWith('```')) {
          cleaned = cleaned.slice(7, -3).trim();
        } else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
          cleaned = cleaned.slice(3, -3).trim();
        }
        return JSON.parse(cleaned);
      } catch (e) {
        return {
          executive_summary: comprehensiveAnalysis,
          detailed_analysis: { research_problem: comprehensiveAnalysis }
        };
      }
    };

    const structuredAnalysis = {
      analysis_id: analysis.analysis_id,
      field: analysis.field,
      field_confidence: analysis.field_confidence,
      sections: analysis.sections || [],
      analysis: parseComprehensiveAnalysis(analysis.comprehensive_analysis),
      metadata: analysis.metadata
    };

    return (
      <div className="space-y-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-emerald-950 font-bold text-base">Multi-Round Debate Analysis Complete</span>
                <p className="text-emerald-700 text-xs mt-0.5">All expert agents finalized revisions & consensus synthesis</p>
              </div>
            </div>
            {analysis.metadata?.elapsed_time && (
              <span className="text-emerald-800 text-xs font-mono font-bold bg-emerald-100/70 px-3 py-1.5 rounded-lg">
                ⏱️ {analysis.metadata.elapsed_time.toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <AnalysisResults analysis={structuredAnalysis} isLoading={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-7">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 shadow-sm relative">
              {isStreaming ? (
                <>
                  <Loader className="h-6 w-6 animate-spin" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-600"></span>
                  </span>
                </>
              ) : (
                <Play className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Multi-Agent Research Analysis
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100 uppercase tracking-wide">
                  {STAGES.find(s => s.id === currentStage)?.title || 'Multi-Agent Debate'}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-1 flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{status}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-600 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
            {isStreaming && (
              <button
                onClick={stopStreaming}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors focus-ring"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Multi-Color Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-slate-100 rounded-full h-3 p-0.5 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-primary-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out shadow-sm relative overflow-hidden"
              style={{ width: `${Math.max(progress, 6)}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse-slow"></div>
            </div>
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-400">
            <span>Overall Progress</span>
            <span className="text-primary-600 font-mono">{progress}%</span>
          </div>
        </div>
      </div>

      {/* 5-Stage Visual Stepper */}
      <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-7">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
          Pipeline Stages
        </h3>

        <div className="grid grid-cols-5 gap-3">
          {STAGES.map((stage, idx) => {
            const stageStatus = getStageStatus(stage, idx);
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`relative rounded-2xl p-4 transition-all duration-300 border ${
                  stageStatus === 'completed'
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 shadow-sm'
                    : stageStatus === 'active'
                    ? 'bg-primary-50/70 border-primary-300 text-primary-950 shadow-soft ring-2 ring-primary-500/20'
                    : 'bg-slate-50/50 border-slate-200/60 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      stageStatus === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : stageStatus === 'active'
                        ? 'bg-primary-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {stageStatus === 'completed' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">
                    0{idx + 1}
                  </span>
                </div>

                <h4 className="text-xs font-bold leading-tight mb-1 truncate">
                  {stage.title}
                </h4>
                <p className="text-[11px] font-medium leading-snug line-clamp-2 opacity-80">
                  {stage.subtitle}
                </p>

                {stageStatus === 'active' && (
                  <div className="mt-3 flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-ping"></span>
                    <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider">In Progress</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Parallel Agents & Live Thought Stream */}
      <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Active Multi-Agent Stream
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Live thoughts and critique outputs from specialized agents
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span>{isInspectorExpanded ? 'Collapse' : 'Expand'}</span>
            {isInspectorExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isInspectorExpanded && (
          <div className="p-6 space-y-6">
            {/* Agent Selector Tabs */}
            <div className="grid grid-cols-3 gap-4">
              {/* Methodology Agent Card */}
              <button
                type="button"
                onClick={() => setActiveTab('methodology')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  activeTab === 'methodology'
                    ? 'border-primary-500 bg-primary-50/40 shadow-soft ring-1 ring-primary-500/30'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Methodology Agent</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                    streamingContent.methodology ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {streamingContent.methodology ? 'Drafted' : progress >= 35 ? 'Drafting...' : 'Queued'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                  Experimental design, baselines, and controls
                </p>
              </button>

              {/* Results Agent Card */}
              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  activeTab === 'results'
                    ? 'border-primary-500 bg-primary-50/40 shadow-soft ring-1 ring-primary-500/30'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Results & Evidence</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                    streamingContent.results ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {streamingContent.results ? 'Drafted' : progress >= 35 ? 'Drafting...' : 'Queued'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                  Statistical rigor & metric verification
                </p>
              </button>

              {/* Context Agent Card */}
              <button
                type="button"
                onClick={() => setActiveTab('context')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  activeTab === 'context'
                    ? 'border-primary-500 bg-primary-50/40 shadow-soft ring-1 ring-primary-500/30'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">Context & Novelty</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                    streamingContent.contextualization ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {streamingContent.contextualization ? 'Drafted' : progress >= 35 ? 'Drafting...' : 'Queued'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                  Prior art, theoretical gap & implications
                </p>
              </button>
            </div>

            {/* Live Streaming Content Inspector */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/70 min-h-[180px] max-h-[360px] overflow-y-auto custom-scrollbar">
              {activeTab === 'methodology' && (
                streamingContent.methodology ? (
                  <div className="prose prose-sm max-w-none text-slate-700">
                    <ReactMarkdown>{streamingContent.methodology}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                    <Target className="w-8 h-8 mb-2 opacity-50 animate-bounce" />
                    <p className="text-xs font-bold">Methodology Agent is preparing analysis...</p>
                    <p className="text-[11px] mt-1">Reviewing experimental protocols & datasets</p>
                  </div>
                )
              )}

              {activeTab === 'results' && (
                streamingContent.results ? (
                  <div className="prose prose-sm max-w-none text-slate-700">
                    <ReactMarkdown>{streamingContent.results}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                    <TrendingUp className="w-8 h-8 mb-2 opacity-50 animate-bounce" />
                    <p className="text-xs font-bold">Results Agent is preparing evaluation...</p>
                    <p className="text-[11px] mt-1">Scrutinizing statistical significance & baselines</p>
                  </div>
                )
              )}

              {activeTab === 'context' && (
                streamingContent.contextualization ? (
                  <div className="prose prose-sm max-w-none text-slate-700">
                    <ReactMarkdown>{streamingContent.contextualization}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                    <Lightbulb className="w-8 h-8 mb-2 opacity-50 animate-bounce" />
                    <p className="text-xs font-bold">Context Agent is preparing literature mapping...</p>
                    <p className="text-[11px] mt-1">Comparing novelty against state of the art</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamingAnalysisResults;
