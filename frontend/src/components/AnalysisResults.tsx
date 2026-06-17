import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  TrendingUp, 
  Target, 
  Lightbulb, 
  AlertTriangle,
  CheckCircle,
  Users,
  Zap,
  Menu,
  X,
  ArrowUp
} from 'lucide-react';
import { repairTruncatedJson } from '../utils/jsonRepair';

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
  let comprehensive_analysis = analysis.analysis || analysis.comprehensive_analysis || analysis;
  
  // Try to repair and parse comprehensive_analysis if it's a string
  if (typeof comprehensive_analysis === 'string') {
    try {
      const repaired = repairTruncatedJson(comprehensive_analysis);
      comprehensive_analysis = JSON.parse(repaired);
    } catch (e) {
      console.warn('Failed to parse comprehensive_analysis string:', e);
      // Fallback structure to display the raw string as executive summary
      comprehensive_analysis = {
        executive_summary: comprehensive_analysis
      };
    }
  }

  const detectedField: string | undefined = analysis.field || comprehensive_analysis?.field;
  const subfield: string | undefined = analysis.subfield || comprehensive_analysis?.subfield;
  const conferences: string[] | undefined = analysis.conferences || comprehensive_analysis?.conferences;
  const fieldConfidence: number | undefined = analysis.field_confidence || comprehensive_analysis?.field_confidence;
  
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
    <div className="space-y-10">
      {/* Header with Table of Contents Toggle */}
      <section 
        className="bg-white rounded-3xl shadow-soft border border-slate-100 p-8"
        aria-labelledby="analysis-header"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex-1">
            <h1 id="analysis-header" className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
              Critical Analysis
            </h1>
            {detectedField && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100 uppercase tracking-wider">
                  {detectedField}{subfield && ` / ${subfield}`}
                </span>
                {typeof fieldConfidence === 'number' && (
                  <span className="text-xs font-bold text-slate-400">
                    {Math.round(fieldConfidence * 100)}% Match
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowTableOfContents(!showTableOfContents)}
            className="flex items-center justify-center space-x-2 px-6 py-2.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all focus-ring"
            aria-expanded={showTableOfContents}
            aria-controls="table-of-contents"
          >
            {showTableOfContents ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>{showTableOfContents ? 'Hide' : 'Show'} Index</span>
          </button>
        </div>

        {/* Table of Contents */}
        {showTableOfContents && (
          <nav 
            id="table-of-contents" 
            className="bg-slate-50/50 rounded-2xl p-6 mb-4 animate-slide-up"
            aria-label="Table of contents"
          >
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Jump to section</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="flex items-center space-x-3 text-left p-3 hover:bg-white hover:shadow-soft rounded-xl transition-all group focus-ring"
                >
                  <div className={`p-2 rounded-lg bg-white shadow-sm group-hover:scale-110 transition-transform ${section.color}`}>
                    <section.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-600 group-hover:text-primary-600">{section.title}</span>
                </button>
              ))}
            </div>
          </nav>
        )}
      </section>

      {/* Analysis Sections */}
      <div className="space-y-12">
        {/* Executive Summary */}
        {executive_summary && (
          <section id="executive-summary" className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden" aria-labelledby="heading-summary">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center space-x-3">
              <BookOpen className="h-5 w-5 text-primary-600" />
              <h2 id="heading-summary" className="text-xl font-bold text-slate-900">Executive Summary</h2>
            </div>
            <div className="p-8 prose prose-slate max-w-none">
              <ReactMarkdown>{executive_summary}</ReactMarkdown>
            </div>
          </section>
        )}

        {/* Novelty Assessment */}
        {novelty_assessment && (
          <section id="novelty-assessment" className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden" aria-labelledby="heading-novelty">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center space-x-3">
              <Zap className="h-5 w-5 text-violet-600" />
              <h2 id="heading-novelty" className="text-xl font-bold text-slate-900">Novelty Assessment</h2>
            </div>
            <div className="p-8 space-y-8">
              {novelty_assessment.key_innovation && (
                <div className="bg-violet-50/50 rounded-2xl p-6 border border-violet-100">
                  <h3 className="text-sm font-bold text-violet-700 uppercase tracking-widest mb-3">Key Innovation</h3>
                  <div className="prose prose-sm max-w-none text-slate-700 font-medium">
                    <ReactMarkdown>{novelty_assessment.key_innovation}</ReactMarkdown>
                  </div>
                </div>
              )}
              {novelty_assessment.incremental_advances && novelty_assessment.incremental_advances.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Incremental Advances</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {novelty_assessment.incremental_advances.map((advance: string, index: number) => (
                      <div key={index} className="flex items-start space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{advance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                {novelty_assessment.novelty_score && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Novelty Rating</span>
                    <span className="text-2xl font-black text-slate-900">{novelty_assessment.novelty_score}</span>
                  </div>
                )}
                {novelty_assessment.justification && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assessment Basis</span>
                    <span className="text-sm font-medium text-slate-600 leading-relaxed">{novelty_assessment.justification}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Methodological Evaluation */}
        {methodological_evaluation && (
          <section id="methodological-evaluation" className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden" aria-labelledby="heading-methodology">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <h2 id="heading-methodology" className="text-xl font-bold text-slate-900">Methodological Evaluation</h2>
            </div>
            <div className="p-8 space-y-8">
              {methodological_evaluation.approach_strength && (
                <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-widest mb-3">Approach Strengths</h3>
                  <div className="prose prose-sm max-w-none text-slate-700 font-medium">
                    <ReactMarkdown>{methodological_evaluation.approach_strength}</ReactMarkdown>
                  </div>
                </div>
              )}
              {methodological_evaluation.potential_issues && methodological_evaluation.potential_issues.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Methodological Risks</h3>
                  <div className="space-y-3">
                    {methodological_evaluation.potential_issues.map((issue: string, index: number) => (
                      <div key={index} className="flex items-center space-x-3 p-4 bg-rose-50/50 rounded-xl border border-rose-100">
                        <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                        <span className="text-sm font-bold text-rose-900">{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                {methodological_evaluation.rigor_assessment && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rigor Score</span>
                    <span className="text-2xl font-black text-slate-900">{methodological_evaluation.rigor_assessment}</span>
                  </div>
                )}
                {methodological_evaluation.reproducibility && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reproducibility</span>
                    <span className="text-sm font-bold text-emerald-600">{methodological_evaluation.reproducibility}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Critical Review */}
        {critical_review && (
          <section id="critical-review" className="bg-slate-900 rounded-3xl shadow-soft border border-slate-800 overflow-hidden" aria-labelledby="heading-critical">
            <div className="px-8 py-6 border-b border-slate-800 bg-white/5 flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h2 id="heading-critical" className="text-xl font-bold text-white">Critical Review</h2>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {critical_review.major_strengths && critical_review.major_strengths.length > 0 && (
                  <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Major Strengths</h3>
                    <ul className="space-y-3">
                      {critical_review.major_strengths.map((strength: string, index: number) => (
                        <li key={index} className="flex items-start space-x-3 text-sm font-medium text-emerald-50">
                          <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {critical_review.major_concerns && critical_review.major_concerns.length > 0 && (
                  <div className="bg-rose-500/10 rounded-2xl p-6 border border-rose-500/20">
                    <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4">Major Concerns</h3>
                    <ul className="space-y-3">
                      {critical_review.major_concerns.map((concern: string, index: number) => (
                        <li key={index} className="flex items-start space-x-3 text-sm font-medium text-rose-50">
                          <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {critical_review.alternative_approaches && critical_review.alternative_approaches.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Alternative Approaches</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {critical_review.alternative_approaches.map((approach: string, index: number) => (
                      <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10 text-xs font-bold text-slate-300">
                        {approach}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {critical_review.robustness && (
                <div className="pt-6 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Robustness Assessment</h3>
                  <div className="text-sm font-medium text-slate-300 leading-relaxed italic">
                    {critical_review.robustness}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Impact Assessment */}
        {impact_assessment && (
          <section id="impact-assessment" className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden" aria-labelledby="heading-impact">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <h2 id="heading-impact" className="text-xl font-bold text-slate-900">Impact Assessment</h2>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
              {impact_assessment.theoretical_contribution && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Theoretical</h3>
                  <div className="text-sm font-medium text-slate-700 leading-relaxed">{impact_assessment.theoretical_contribution}</div>
                </div>
              )}
              {impact_assessment.practical_significance && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Practical</h3>
                  <div className="text-sm font-medium text-slate-700 leading-relaxed">{impact_assessment.practical_significance}</div>
                </div>
              )}
              {impact_assessment.field_impact && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Field Impact</h3>
                  <div className="text-sm font-medium text-slate-700 leading-relaxed">{impact_assessment.field_impact}</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Research Opportunities */}
        {research_opportunities && (
          <section id="research-opportunities" className="bg-amber-50 rounded-3xl shadow-soft border border-amber-100 overflow-hidden" aria-labelledby="heading-opps">
            <div className="px-8 py-6 border-b border-amber-100 bg-white/40 flex items-center space-x-3">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              <h2 id="heading-opps" className="text-xl font-bold text-slate-900">Research Opportunities</h2>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {research_opportunities.immediate_extensions && research_opportunities.immediate_extensions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-4">Immediate Extensions</h3>
                    <div className="space-y-2">
                      {research_opportunities.immediate_extensions.map((ext: string, index: number) => (
                        <div key={index} className="p-4 bg-white rounded-xl shadow-sm border border-amber-200/50 text-sm font-bold text-slate-800">
                          {ext}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {research_opportunities.broader_directions && research_opportunities.broader_directions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-4">Broader Directions</h3>
                    <div className="space-y-2">
                      {research_opportunities.broader_directions.map((dir: string, index: number) => (
                        <div key={index} className="p-4 bg-white rounded-xl shadow-sm border border-amber-200/50 text-sm font-bold text-slate-800">
                          {dir}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Analysis Metadata */}
      {comprehensive_analysis.metadata && (
        <footer className="bg-slate-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center space-x-6">
            <span>Analysis ID: {analysis.analysis_id || 'N/A'}</span>
            <span>Confidence: {Math.round((comprehensive_analysis.metadata?.analysis_confidence || 0) * 100)}%</span>
          </div>
          <span>Generated: {new Date(comprehensive_analysis.metadata?.analysis_timestamp || Date.now()).toLocaleDateString()}</span>
        </footer>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-10 right-10 bg-slate-900 text-white p-4 rounded-2xl shadow-soft-lg hover:bg-primary-600 hover:-translate-y-1 transition-all duration-300 z-50 focus-ring animate-fade-in"
          aria-label="Back to top"
        >
          <ArrowUp className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default AnalysisResults;
