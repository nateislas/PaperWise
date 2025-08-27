import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  TrendingUp, 
  Target, 
  Lightbulb, 
  AlertTriangle,
  CheckCircle,
  Loader,
  Play
} from 'lucide-react';
import AnalysisResults from './AnalysisResults';

interface StreamingAnalysisResultsProps {
  fileId: string;
  userQuery?: string;
  onComplete?: (analysis: any) => void;
  onError?: (error: string) => void;
}

interface StreamChunk {
  type: string;
  analysis_id?: string;
  message?: string;
  content?: string;
  progress?: number;
  analysis?: any;
  elapsed_time?: number;
}

const StreamingAnalysisResults: React.FC<StreamingAnalysisResultsProps> = ({
  fileId,
  userQuery,
  onComplete,
  onError
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState({
    methodology: '',
    results: '',
    contextualization: '',
    synthesis: ''
  });
  
  // Use a ref to track content updates for better performance
  const contentRef = useRef({
    methodology: '',
    results: '',
    contextualization: '',
    synthesis: ''
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const analysisIdRef = useRef<string | null>(null);

  const handleStreamChunk = useCallback((chunk: StreamChunk) => {
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
        contentRef.current.methodology += chunk.content || '';
        setStreamingContent({
          ...contentRef.current
        });
        break;

      case 'results_chunk':
        contentRef.current.results += chunk.content || '';
        setStreamingContent({
          ...contentRef.current
        });
        break;

      case 'contextualization_chunk':
        contentRef.current.contextualization += chunk.content || '';
        setStreamingContent({
          ...contentRef.current
        });
        break;

      case 'synthesis_chunk':
        contentRef.current.synthesis += chunk.content || '';
        setStreamingContent({
          ...contentRef.current
        });
        break;

      case 'complete':
        setAnalysis(chunk.analysis);
        setProgress(100);
        setStatus('Analysis completed successfully');
        onComplete?.(chunk.analysis);
        break;

      case 'error':
        setError(chunk.message || 'Analysis failed');
        onError?.(chunk.message || 'Analysis failed');
        break;
    }
  }, [onComplete, onError]);

  const startStreaming = useCallback(async () => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    setError(null);
    setProgress(0);
    setStatus('Initializing analysis...');
    setStreamingContent({
      methodology: '',
      results: '',
      contextualization: '',
      synthesis: ''
    });
    
    // Reset the content ref
    contentRef.current = {
      methodology: '',
      results: '',
      contextualization: '',
      synthesis: ''
    };

    try {
      const response = await fetch('/api/v1/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          query: userQuery || undefined,
          analysis_type: 'comprehensive'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
        
        buffer += decoder.decode(value, { stream: true });
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
    }
  }, [fileId, userQuery, isStreaming, onError, handleStreamChunk]);

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setStatus('Analysis stopped');
  };

  useEffect(() => {
    // Auto-start streaming when component mounts
    if (fileId && !isStreaming && !analysis) {
      startStreaming();
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fileId, isStreaming, analysis, startStreaming]);

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-xl font-semibold text-red-900">Analysis Error</h2>
        </div>
        <p className="text-red-700">{error}</p>
        <button
          onClick={startStreaming}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (analysis) {
    // Parse the comprehensive analysis to extract structured sections
    const parseComprehensiveAnalysis = (comprehensiveAnalysis: string) => {
      console.log('🔍 DEBUG: Raw comprehensive analysis from backend:');
      console.log(comprehensiveAnalysis);
      console.log('🔍 DEBUG: Analysis length:', comprehensiveAnalysis.length);
      
      try {
        // Clean the input - remove markdown code blocks if present
        let cleanedAnalysis = comprehensiveAnalysis.trim();
        
        // Remove markdown code block fences (```json ... ```)
        if (cleanedAnalysis.startsWith('```json') && cleanedAnalysis.endsWith('```')) {
          cleanedAnalysis = cleanedAnalysis.slice(7, -3).trim(); // Remove ```json and ```
        } else if (cleanedAnalysis.startsWith('```') && cleanedAnalysis.endsWith('```')) {
          cleanedAnalysis = cleanedAnalysis.slice(3, -3).trim(); // Remove ``` and ```
        }
        
        console.log('🔍 DEBUG: Cleaned analysis for JSON parsing:', cleanedAnalysis.substring(0, 200) + '...');
        
        // Try to parse as JSON
        const jsonData = JSON.parse(cleanedAnalysis);
        console.log('✅ Successfully parsed as JSON');
        
        return {
          executive_summary: jsonData.executive_summary || '',
          key_insights: jsonData.key_insights || [],
          detailed_analysis: {
            research_problem: jsonData.detailed_analysis?.research_problem || '',
            methodology: jsonData.detailed_analysis?.methodology || '',
            key_findings: jsonData.detailed_analysis?.key_findings || '',
            context: jsonData.detailed_analysis?.context || '',
            strengths_limitations: jsonData.detailed_analysis?.strengths_limitations || '',
            future_directions: jsonData.detailed_analysis?.future_directions || ''
          },
          recommendations: jsonData.recommendations || null
        };
      } catch (error) {
        console.log('⚠️ Failed to parse as JSON, falling back to markdown parsing');
        
        // Fallback to the old markdown parsing logic for backward compatibility
        const sections: {
          executive_summary: string;
          key_insights: string[];
          detailed_analysis: {
            research_problem: string;
            methodology: string;
            key_findings: string;
            context: string;
            strengths_limitations: string;
            future_directions: string;
          };
                  recommendations: {
          for_researchers: string[];
          for_practitioners: string[];
        } | null;
        } = {
          executive_summary: '',
          key_insights: [],
          detailed_analysis: {
            research_problem: '',
            methodology: '',
            key_findings: '',
            context: '',
            strengths_limitations: '',
            future_directions: ''
          },
          recommendations: null
        };

        // Fallback: treat the whole text as detailed analysis
        sections.detailed_analysis.research_problem = comprehensiveAnalysis;
        console.log('⚠️ Using fallback parsing');

        return sections;
      }
    };

    // Create structured analysis object
    const structuredAnalysis = {
      analysis_id: analysis.analysis_id,
      analysis: parseComprehensiveAnalysis(analysis.comprehensive_analysis),
      metadata: analysis.metadata
    };

    return (
      <div className="space-y-6">
        {/* Analysis Complete - Show final results */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">Analysis Complete</span>
            {analysis.metadata?.elapsed_time && (
              <span className="text-green-600 text-sm">
                (Completed in {analysis.metadata.elapsed_time.toFixed(1)}s)
              </span>
            )}
          </div>
        </div>

        {/* Use the structured AnalysisResults component */}
        <AnalysisResults analysis={structuredAnalysis} isLoading={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {isStreaming ? (
              <Loader className="h-6 w-6 text-primary-600 animate-spin" />
            ) : (
              <Play className="h-6 w-6 text-primary-600" />
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isStreaming ? 'Analyzing Research Paper' : 'Starting Analysis...'}
              </h2>
              <p className="text-gray-600">{status}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isStreaming && !analysis && (
              <button
                onClick={startStreaming}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                Start Analysis
              </button>
            )}
            {isStreaming && (
              <button
                onClick={stopStreaming}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="text-sm text-gray-600 mt-2">
          Progress: {progress}%
        </div>
      </div>

      {/* Streaming Content Preview */}
      {isStreaming && (
        <div className="space-y-4">
          {/* Methodology Analysis */}
          {streamingContent.methodology && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Target className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-gray-900">Methodology Analysis</h3>
              </div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{streamingContent.methodology}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Results Analysis */}
          {streamingContent.results && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-3">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <h3 className="font-medium text-gray-900">Results Analysis</h3>
              </div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{streamingContent.results}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Contextualization Analysis */}
          {streamingContent.contextualization && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Lightbulb className="h-4 w-4 text-yellow-600" />
                <h3 className="font-medium text-gray-900">Context & Implications</h3>
              </div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{streamingContent.contextualization}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Synthesis */}
          {streamingContent.synthesis && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-3">
                <BookOpen className="h-4 w-4 text-purple-600" />
                <h3 className="font-medium text-gray-900">Comprehensive Analysis</h3>
              </div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{streamingContent.synthesis}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StreamingAnalysisResults;
