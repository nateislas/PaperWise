import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  TrendingUp, 
  Target, 
  Lightbulb, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Zap,
  Menu,
  X,
  ArrowUp
} from 'lucide-react';

interface AnalysisResultsProps {
  analysis: any;
  isLoading: boolean;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis, isLoading }) => {
  const [showTableOfContents, setShowTableOfContents] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Handle scroll events for back to top button - MUST be before any conditional returns
  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="text-lg text-gray-600">Analyzing your research paper...</span>
        </div>
        <div className="mt-4 text-center text-sm text-gray-500">
          This may take a few minutes depending on the paper length
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  // Handle the response structure from the backend
  // Backend returns: { analysis_id, status, message, analysis: { comprehensive_analysis_data } }
  const comprehensive_analysis = analysis.analysis || analysis.comprehensive_analysis || analysis;
  
  // Add defensive checks to prevent destructuring errors
  if (!comprehensive_analysis || typeof comprehensive_analysis !== 'object') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-600">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
          <p>Analysis data is not available or in an unexpected format.</p>
        </div>
      </div>
    );
  }
  
  // Use safe destructuring with default values
  const { 
    executive_summary = null, 
    detailed_analysis = null, 
    key_insights = [], 
    recommendations = null 
  } = comprehensive_analysis || {};

  // Handle both old string format and new structured format for detailed_analysis
  const detailedAnalysisSections: {
    research_problem: string;
    methodology: string;
    key_findings: string;
    context: string;
    strengths_limitations: string;
    future_directions: string;
  } = typeof detailed_analysis === 'string' 
    ? { research_problem: detailed_analysis, methodology: '', key_findings: '', context: '', strengths_limitations: '', future_directions: '' }
    : detailed_analysis || { research_problem: '', methodology: '', key_findings: '', context: '', strengths_limitations: '', future_directions: '' };

  // Generate table of contents
  const sections = [
    { id: 'executive-summary', title: 'Executive Summary', icon: BookOpen, color: 'text-primary-600', hasContent: !!executive_summary },
    { id: 'key-insights', title: 'Key Insights', icon: Lightbulb, color: 'text-yellow-600', hasContent: key_insights && key_insights.length > 0 },
    { id: 'detailed-analysis', title: 'Detailed Analysis', icon: Target, color: 'text-primary-600', hasContent: !!detailed_analysis && Object.values(detailedAnalysisSections).some((section: string) => section.length > 0) },
    { id: 'recommendations', title: 'Recommendations', icon: TrendingUp, color: 'text-green-600', hasContent: !!recommendations }
  ].filter(section => section.hasContent);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* Header with Table of Contents Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Research Paper Analysis</h1>
          <button
            onClick={() => setShowTableOfContents(!showTableOfContents)}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {showTableOfContents ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>{showTableOfContents ? 'Hide' : 'Show'} Contents</span>
          </button>
        </div>

        {/* Table of Contents */}
        {showTableOfContents && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Table of Contents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="flex items-center space-x-2 text-left p-2 hover:bg-white rounded-md transition-colors group"
                >
                  <section.icon className={`h-4 w-4 ${section.color}`} />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{section.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Executive Summary */}
      {executive_summary && (
        <div id="executive-summary" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <BookOpen className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Executive Summary</h2>
          </div>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{executive_summary}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Key Insights */}
      {key_insights && key_insights.length > 0 && (
        <div id="key-insights" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Key Insights</h2>
          </div>
          <div className="space-y-3">
            {key_insights.map((insight: string, index: number) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-yellow-700">{index + 1}</span>
                </div>
                <p className="text-gray-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analysis */}
      {detailed_analysis && Object.values(detailedAnalysisSections).some(section => section.length > 0) && (
        <div id="detailed-analysis" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Target className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Detailed Analysis</h2>
          </div>
          
          <div className="space-y-6">
            {/* Research Problem and Motivation */}
            {detailedAnalysisSections.research_problem && (
              <div className="analysis-methodology">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Research Problem and Motivation</h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{detailedAnalysisSections.research_problem}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Methodology and Experimental Design */}
            {detailedAnalysisSections.methodology && (
              <div className="analysis-methodology">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Methodology and Experimental Design</h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{detailedAnalysisSections.methodology}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Key Findings and Statistical Significance */}
            {detailedAnalysisSections.key_findings && (
              <div className="analysis-results">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Key Findings and Statistical Significance</h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{detailedAnalysisSections.key_findings}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Context within the Broader Field */}
            {detailedAnalysisSections.context && (
              <div className="analysis-insight">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Context within the Broader Field</h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{detailedAnalysisSections.context}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Strengths and Limitations */}
            {detailedAnalysisSections.strengths_limitations && (
              <div className="analysis-recommendation">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Strengths and Limitations</h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{detailedAnalysisSections.strengths_limitations}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Future Research Directions */}
            {detailedAnalysisSections.future_directions && (
              <div className="analysis-recommendation">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Future Research Directions</h3>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{detailedAnalysisSections.future_directions}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && (
        <div id="recommendations" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Recommendations</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* For Researchers */}
            {recommendations.for_researchers && recommendations.for_researchers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium text-gray-900">For Researchers</h3>
                </div>
                <ul className="space-y-2">
                  {recommendations.for_researchers.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2 p-2 bg-blue-50 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* For Practitioners */}
            {recommendations.for_practitioners && recommendations.for_practitioners.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-orange-600" />
                  <h3 className="font-medium text-gray-900">For Practitioners</h3>
                </div>
                <ul className="space-y-2">
                  {recommendations.for_practitioners.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2 p-2 bg-orange-50 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Metadata */}
      {comprehensive_analysis.metadata && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Analysis ID: {analysis.analysis_id || 'N/A'}</span>
              <span>Confidence: {Math.round((comprehensive_analysis.metadata?.analysis_confidence || 0) * 100)}%</span>
            </div>
            <span>Generated: {new Date(comprehensive_analysis.metadata?.analysis_timestamp || Date.now()).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition-all duration-200 z-50"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default AnalysisResults;
