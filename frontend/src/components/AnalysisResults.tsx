import React from 'react';
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
  Zap
} from 'lucide-react';

interface AnalysisResultsProps {
  analysis: any;
  isLoading: boolean;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis, isLoading }) => {
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

  const { comprehensive_analysis } = analysis;
  const { 
    executive_summary, 
    detailed_analysis, 
    key_insights, 
    recommendations 
  } = comprehensive_analysis;

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Executive Summary</h2>
        </div>
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{executive_summary}</ReactMarkdown>
        </div>
      </div>

      {/* Key Insights */}
      {key_insights && key_insights.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Key Insights</h2>
          </div>
          <div className="space-y-3">
            {key_insights.map((insight: string, index: number) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-700">{index + 1}</span>
                </div>
                <p className="text-gray-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Detailed Analysis</h2>
        </div>
        <div className="prose prose-sm max-w-none markdown-content">
          <ReactMarkdown>{detailed_analysis}</ReactMarkdown>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* For Future Studies */}
            {recommendations.for_future_studies && recommendations.for_future_studies.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <h3 className="font-medium text-gray-900">For Future Studies</h3>
                </div>
                <ul className="space-y-2">
                  {recommendations.for_future_studies.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
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
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* For Policy Makers */}
            {recommendations.for_policy_makers && recommendations.for_policy_makers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <h3 className="font-medium text-gray-900">For Policy Makers</h3>
                </div>
                <ul className="space-y-2">
                  {recommendations.for_policy_makers.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
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
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Analysis ID: {analysis.analysis_id}</span>
            <span>Confidence: {Math.round(comprehensive_analysis.metadata?.analysis_confidence * 100)}%</span>
          </div>
          <span>Generated: {new Date(comprehensive_analysis.metadata?.analysis_timestamp).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResults;
