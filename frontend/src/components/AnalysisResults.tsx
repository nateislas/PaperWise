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
  const comprehensive_analysis = analysis.analysis || analysis.comprehensive_analysis || analysis;
  const detectedField: string | undefined = analysis.field || comprehensive_analysis.field;
  const subfield: string | undefined = analysis.subfield || comprehensive_analysis.subfield;
  const conferences: string[] | undefined = analysis.conferences || comprehensive_analysis.conferences;
  const fieldConfidence: number | undefined = analysis.field_confidence || comprehensive_analysis.field_confidence;
  const figureAssets: Array<{ page: number; image_index: number; url: string; captions?: string[] }> = analysis.figures || comprehensive_analysis.figures || [];
  
  // Add defensive checks to prevent destructuring errors
  if (!comprehensive_analysis || typeof comprehensive_analysis !== 'object') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-600">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
          <p>Analysis data is not available or in an unexpected format.</p>
          <div className="mt-4 text-left">
            <p className="text-sm font-semibold">Debug Info:</p>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
              {JSON.stringify(analysis, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
  
  // Use safe destructuring with default values for new structure
  const { 
    executive_summary = null, 
    novelty_assessment = null,
    gap_analysis = null,
    methodological_evaluation = null,
    evidence_quality = null,
    impact_assessment = null,
    research_opportunities = null,
    implementation_guide = null,
    critical_review = null,
    // Legacy fields for backward compatibility
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

  // Generate table of contents for new structure
  const sections = [
    { id: 'executive-summary', title: 'Executive Summary', icon: BookOpen, color: 'text-primary-600', hasContent: !!executive_summary },
    { id: 'novelty-assessment', title: 'Novelty Assessment', icon: Zap, color: 'text-purple-600', hasContent: !!novelty_assessment },
    { id: 'gap-analysis', title: 'Gap Analysis', icon: Target, color: 'text-blue-600', hasContent: !!gap_analysis },
    { id: 'methodological-evaluation', title: 'Methodological Evaluation', icon: CheckCircle, color: 'text-green-600', hasContent: !!methodological_evaluation },
    { id: 'evidence-quality', title: 'Evidence Quality', icon: AlertTriangle, color: 'text-orange-600', hasContent: !!evidence_quality },
    { id: 'impact-assessment', title: 'Impact Assessment', icon: TrendingUp, color: 'text-indigo-600', hasContent: !!impact_assessment },
    { id: 'research-opportunities', title: 'Research Opportunities', icon: Lightbulb, color: 'text-yellow-600', hasContent: !!research_opportunities },
    { id: 'implementation-guide', title: 'Implementation Guide', icon: Users, color: 'text-gray-600', hasContent: !!implementation_guide },
    { id: 'critical-review', title: 'Critical Review', icon: AlertTriangle, color: 'text-red-600', hasContent: !!critical_review },
    // Legacy sections for backward compatibility
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
          {detectedField && (
            <div className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {detectedField.toUpperCase()}{subfield && ` (${subfield})`} {typeof fieldConfidence === 'number' && `(${Math.round(fieldConfidence * 100)}%)`}
              {conferences && conferences.length > 0 && (
                <div className="text-xs mt-1">
                  {conferences.slice(0, 2).join(', ')}
                </div>
              )}
            </div>
          )}
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
          <div className="prose prose-base max-w-none">
            <ReactMarkdown>{executive_summary}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Novelty Assessment */}
      {novelty_assessment && (
        <div id="novelty-assessment" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Novelty Assessment</h2>
          </div>
          <div className="space-y-4">
            {novelty_assessment.key_innovation && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Key Innovation</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{novelty_assessment.key_innovation}</ReactMarkdown>
                </div>
              </div>
            )}
            {novelty_assessment.incremental_advances && novelty_assessment.incremental_advances.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Incremental Advances</h3>
                <ul className="space-y-1">
                  {novelty_assessment.incremental_advances.map((advance: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {advance}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {novelty_assessment.novelty_score && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Novelty Score</div>
                  <div className="text-base font-medium text-gray-900">{novelty_assessment.novelty_score}</div>
                </div>
              )}
              {novelty_assessment.justification && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Justification</div>
                  <div className="text-base text-gray-800">{novelty_assessment.justification}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      {gap_analysis && (
        <div id="gap-analysis" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Target className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Gap Analysis</h2>
          </div>
          <div className="space-y-4">
            {gap_analysis.problem_statement && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Problem Statement</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{gap_analysis.problem_statement}</ReactMarkdown>
                </div>
              </div>
            )}
            {gap_analysis.motivation && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Motivation</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{gap_analysis.motivation}</ReactMarkdown>
                </div>
              </div>
            )}
            {gap_analysis.scope && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Scope Limitations</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{gap_analysis.scope}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Methodological Evaluation */}
      {methodological_evaluation && (
        <div id="methodological-evaluation" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Methodological Evaluation</h2>
          </div>
          <div className="space-y-4">
            {methodological_evaluation.approach_strength && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Approach Strengths</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{methodological_evaluation.approach_strength}</ReactMarkdown>
                </div>
              </div>
            )}
            {methodological_evaluation.potential_issues && methodological_evaluation.potential_issues.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Potential Issues</h3>
                <ul className="space-y-1">
                  {methodological_evaluation.potential_issues.map((issue: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {methodological_evaluation.rigor_assessment && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Rigor Assessment</div>
                  <div className="text-base font-medium text-gray-900">{methodological_evaluation.rigor_assessment}</div>
                </div>
              )}
              {methodological_evaluation.reproducibility && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Reproducibility</div>
                  <div className="text-base text-gray-800">{methodological_evaluation.reproducibility}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Evidence Quality */}
      {evidence_quality && (
        <div id="evidence-quality" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h2 className="text-xl font-semibold text-gray-900">Evidence Quality</h2>
          </div>
          <div className="space-y-4">
            {evidence_quality.empirical_support && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Empirical Support</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{evidence_quality.empirical_support}</ReactMarkdown>
                </div>
              </div>
            )}
            {evidence_quality.key_results && evidence_quality.key_results.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Key Results</h3>
                <ul className="space-y-1">
                  {evidence_quality.key_results.map((result: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {result}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {evidence_quality.statistical_significance && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Statistical Significance</div>
                  <div className="text-base text-gray-800">{evidence_quality.statistical_significance}</div>
                </div>
              )}
              {evidence_quality.baseline_comparison && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Baseline Comparison</div>
                  <div className="text-base text-gray-800">{evidence_quality.baseline_comparison}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Impact Assessment */}
      {impact_assessment && (
        <div id="impact-assessment" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Impact Assessment</h2>
          </div>
          <div className="space-y-4">
            {impact_assessment.theoretical_contribution && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Theoretical Contribution</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{impact_assessment.theoretical_contribution}</ReactMarkdown>
                </div>
              </div>
            )}
            {impact_assessment.practical_significance && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Practical Significance</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{impact_assessment.practical_significance}</ReactMarkdown>
                </div>
              </div>
            )}
            {impact_assessment.field_impact && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Field Impact</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{impact_assessment.field_impact}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Research Opportunities */}
      {research_opportunities && (
        <div id="research-opportunities" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Research Opportunities</h2>
          </div>
          <div className="space-y-4">
            {research_opportunities.immediate_extensions && research_opportunities.immediate_extensions.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Immediate Extensions</h3>
                <ul className="space-y-1">
                  {research_opportunities.immediate_extensions.map((extension: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {extension}</li>
                  ))}
                </ul>
              </div>
            )}
            {research_opportunities.broader_directions && research_opportunities.broader_directions.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Broader Directions</h3>
                <ul className="space-y-1">
                  {research_opportunities.broader_directions.map((direction: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {direction}</li>
                  ))}
                </ul>
              </div>
            )}
            {research_opportunities.open_questions && research_opportunities.open_questions.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Open Questions</h3>
                <ul className="space-y-1">
                  {research_opportunities.open_questions.map((question: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {question}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Implementation Guide */}
      {implementation_guide && (
        <div id="implementation-guide" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Implementation Guide</h2>
          </div>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {implementation_guide.complexity && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Complexity</div>
                  <div className="text-base font-medium text-gray-900">{implementation_guide.complexity}</div>
                </div>
              )}
              {implementation_guide.estimated_effort && (
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Estimated Effort</div>
                  <div className="text-base text-gray-800">{implementation_guide.estimated_effort}</div>
                </div>
              )}
            </div>
            {implementation_guide.requirements && implementation_guide.requirements.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Requirements</h3>
                <ul className="space-y-1">
                  {implementation_guide.requirements.map((req: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {req}</li>
                  ))}
                </ul>
              </div>
            )}
            {implementation_guide.missing_details && implementation_guide.missing_details.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Missing Details</h3>
                <ul className="space-y-1">
                  {implementation_guide.missing_details.map((detail: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {detail}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Critical Review */}
      {critical_review && (
        <div id="critical-review" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">Critical Review</h2>
          </div>
          <div className="space-y-4">
            {critical_review.major_strengths && critical_review.major_strengths.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Major Strengths</h3>
                <ul className="space-y-1">
                  {critical_review.major_strengths.map((strength: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {strength}</li>
                  ))}
                </ul>
              </div>
            )}
            {critical_review.major_concerns && critical_review.major_concerns.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Major Concerns</h3>
                <ul className="space-y-1">
                  {critical_review.major_concerns.map((concern: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {concern}</li>
                  ))}
                </ul>
              </div>
            )}
            {critical_review.alternative_approaches && critical_review.alternative_approaches.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Alternative Approaches</h3>
                <ul className="space-y-1">
                  {critical_review.alternative_approaches.map((approach: string, index: number) => (
                    <li key={index} className="text-base text-gray-700">• {approach}</li>
                  ))}
                </ul>
              </div>
            )}
            {critical_review.robustness && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Robustness Assessment</h3>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown>{critical_review.robustness}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Insights - Legacy */}
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
