import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Compass, ChevronRight, ChevronDown, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { TrustScorecard, type ScorecardAxisData } from '../trust/TrustScorecard';
import { ConcernList, type ConcernItem } from './ConcernList';
import { SectionRail, type SectionRailItem } from './SectionRail';
import { REPORT_SECTIONS, resolveReportSectionId } from '../../constants/sections';
import type { Axis } from '../trust/TrustDots';

export function VerdictPanel({
  analysis,
  onJumpToPdfPage,
}: {
  analysis: any;
  onJumpToPdfPage: (page: number, quote?: string) => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    [REPORT_SECTIONS.NOVELTY]: true,
    [REPORT_SECTIONS.GAP_ANALYSIS]: true,
    [REPORT_SECTIONS.EXECUTIVE_SUMMARY]: true,
  });

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const results = useMemo(() => {
    const base = analysis?.results || analysis || {};
    return base.comprehensive_analysis || base;
  }, [analysis]);
  const methEval = useMemo(() => results.methodological_evaluation || {}, [results]);
  const novEval = useMemo(() => results.novelty_assessment || {}, [results]);
  const critReview = useMemo(() => results.critical_review || {}, [results]);
  const evQuality = useMemo(() => results.evidence_quality || {}, [results]);
  const gapAnalysis = useMemo(() => results.gap_analysis || {}, [results]);
  const impAssessment = useMemo(() => results.impact_assessment || {}, [results]);
  const resOpportunities = useMemo(() => results.research_opportunities || {}, [results]);

  // Clean prompt scaffolding leaks e.g. (CONTEXT: ...) (Fixes D5)
  const cleanText = (text?: string) => {
    if (!text) return '';
    return text.replace(/\(CONTEXT:[^)]+\)/gi, '').trim();
  };

  const bottomLine =
    cleanText(results.bottom_line) ||
    cleanText(results.executive_summary?.takeaway) ||
    (typeof results.executive_summary === 'string'
      ? cleanText(results.executive_summary.split('\n\n')[0])
      : '');

  const fullSummary =
    typeof results.executive_summary === 'string'
      ? cleanText(results.executive_summary)
      : results.executive_summary?.full_summary || '';

  // Map axes data
  const axesData: Partial<Record<Axis, ScorecardAxisData>> = useMemo(
    () => ({
      methodology: {
        level:
          results.methodology?.level ||
          (methEval.rigor_assessment === 'high'
            ? 'strong'
            : methEval.rigor_assessment === 'medium'
            ? 'adequate'
            : methEval.rigor_assessment === 'low'
            ? 'weak'
            : 'adequate'),
        rationale: results.methodology?.one_line || results.methodology?.detail || methEval.approach_strength || 'Standard controls and methodology',
        evidence: results.methodology?.evidence || (methEval.page ? [{ page: methEval.page, section: 'Methodology' }] : []),
      },
      evidence: {
        level:
          results.evidence?.level ||
          (evQuality.overall_quality === 'high' ? 'strong' : 'adequate'),
        rationale: results.evidence?.one_line || results.evidence?.detail || evQuality.assessment || evQuality.empirical_support || evQuality.summary || 'Empirical findings reported',
        evidence: results.evidence?.evidence || [],
      },
      reproducibility: {
        level:
          results.reproducibility?.level ||
          (methEval.reproducibility === 'high'
            ? 'strong'
            : methEval.reproducibility === 'low'
            ? 'weak'
            : 'adequate'),
        rationale: results.reproducibility?.one_line || results.reproducibility?.detail || methEval.reproducibility || methEval.reproducibility_notes || 'Code or dataset availability statement',
        evidence: results.reproducibility?.evidence || [],
      },
      novelty: {
        level:
          results.novelty?.level ||
          (novEval.novelty_score >= 8 || novEval.novelty_score === 'high'
            ? 'strong'
            : novEval.novelty_score >= 5 || novEval.novelty_score === 'medium'
            ? 'adequate'
            : 'weak'),
        rationale: results.novelty?.one_line || results.novelty?.detail || novEval.key_innovation || novEval.justification || 'Novel contribution assessment',
        evidence: results.novelty?.evidence || [],
      },
      independent: {
        level: 'unavailable',
        rationale: 'Independent signals not yet collected',
        evidence: [],
      },
    }),
    [results.methodology, results.evidence, results.reproducibility, results.novelty, methEval, novEval, evQuality]
  );

  // Map concerns
  const concerns: ConcernItem[] = useMemo(() => {
    const rawConcerns =
      (Array.isArray(results.concerns) && results.concerns.length > 0)
        ? results.concerns
        : (critReview.major_concerns || methEval.potential_issues || []);
    return rawConcerns.map((c: any, index: number) => {
      if (typeof c === 'string') {
        const parts = c.split(':');
        return {
          id: `concern-${index}`,
          severity: 'material',
          title: parts[0]?.trim() || 'Methodology Concern',
          description: parts[1]?.trim() || c,
        };
      }
      const firstEvidence = Array.isArray(c.evidence) && c.evidence[0] ? c.evidence[0] : null;
      return {
        id: `concern-${c.rank !== undefined ? c.rank : index}`,
        severity: (c.severity as 'blocking' | 'material' | 'minor') || 'material',
        title: c.title || (c.category ? `${c.category} Concern` : 'Methodology Concern'),
        category: c.category,
        description: c.detail || c.description || String(c),
        page: c.page || firstEvidence?.page,
        section: c.section || firstEvidence?.section,
        quote: c.quote || firstEvidence?.quote,
      };
    });
  }, [results.concerns, methEval, critReview]);

  // Section rail items
  const railSections: SectionRailItem[] = useMemo(
    () => [
      { id: REPORT_SECTIONS.BOTTOM_LINE, label: 'Bottom line', present: !!bottomLine },
      { id: REPORT_SECTIONS.TRUST_SCORECARD, label: 'Trust scorecard', present: true },
      { id: REPORT_SECTIONS.OPEN_CONCERNS, label: `Open concerns (${concerns.length})`, present: true },
      { id: REPORT_SECTIONS.METHODOLOGY, label: 'What they did', present: !!results.what_they_did || !!methEval.approach_strength || !!methEval.rigor_assessment },
      { id: REPORT_SECTIONS.EVIDENCE_QUALITY, label: 'What they found', present: !!results.what_they_found || !!evQuality.empirical_support || !!evQuality.assessment || !!evQuality.key_results },
      { id: REPORT_SECTIONS.NOVELTY, label: 'Why it matters', present: !!results.why_it_matters || !!novEval.key_innovation || !!impAssessment.field_impact },
      { id: REPORT_SECTIONS.GAP_ANALYSIS, label: 'Where this could go', present: !!results.where_this_could_go || !!gapAnalysis.problem_statement || !!resOpportunities.immediate_extensions },
      { id: REPORT_SECTIONS.EXECUTIVE_SUMMARY, label: 'Full summary', present: !!fullSummary },
    ],
    [bottomLine, concerns, results.what_they_did, results.what_they_found, results.why_it_matters, results.where_this_could_go, methEval, evQuality, novEval, impAssessment, gapAnalysis, resOpportunities, fullSummary]
  );

  const scrollToSection = (id: string) => {
    const target = resolveReportSectionId(id) || id;
    setCollapsedSections((prev) => ({ ...prev, [target]: false }));
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const hasResults = Boolean(
    bottomLine ||
    results.what_they_did ||
    results.methodology?.level ||
    methEval.approach_strength ||
    methEval.rigor_assessment ||
    critReview.major_concerns?.length ||
    results.concerns?.length ||
    evQuality.empirical_support ||
    novEval.key_innovation
  );

  const isFailed = analysis?.status === 'failed' || analysis?.job?.state === 'error';
  const errorMessage = analysis?.job?.error_code || analysis?.error || 'Analysis encountered an issue while processing.';

  if (!hasResults) {
    if (isFailed) {
      return (
        <div className="p-8 max-w-lg mx-auto mt-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-[--trust-failing-wash] text-[--trust-failing] flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-[--text-primary]">Analysis Incomplete</h2>
          <p className="text-xs text-[--text-secondary] leading-relaxed">
            {errorMessage}
          </p>
          <div className="pt-2">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[--surface-sunken] hover:bg-[--surface-hover] text-[--text-primary] border border-[--border-subtle] transition-colors"
            >
              Return to Library
            </a>
          </div>
        </div>
      );
    }

    const progress = analysis?.job?.progress;
    const stage =
      analysis?.job?.stage ||
      (analysis?.status === 'queued' ? 'Queued in processing pool...' : 'Synthesizing multi-agent review...');

    return (
      <div className="p-8 max-w-lg mx-auto mt-12 space-y-6">
        <div className="text-center space-y-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="h-16 w-16 rounded-2xl bg-[--accent-subtle] flex items-center justify-center text-[--text-accent] shadow-xs">
              <Compass className="h-8 w-8 animate-spin text-[--text-accent]" style={{ animationDuration: '4s' }} />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[--accent] text-[--text-inverse] flex items-center justify-center text-[10px] font-bold shadow-xs">
              <Sparkles className="h-3 w-3" />
            </div>
          </div>

          <h2 className="text-base font-bold text-[--text-primary]">
            Critique in Progress
          </h2>
          <p className="text-xs text-[--text-secondary] leading-relaxed">
            Our multi-agent committee is actively analyzing methodology rigor, statistical evidence, and novelty.
          </p>
        </div>

        {/* Progress Card */}
        <div className="rounded-xl border border-[--border-subtle] bg-[--surface-sunken] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[--text-primary] flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[--text-accent]" />
              {stage}
            </span>
            {typeof progress === 'number' && progress > 0 && (
              <span className="text-[--text-accent] font-mono">{progress}%</span>
            )}
          </div>

          <div className="h-1.5 w-full rounded-full bg-[--border-subtle] overflow-hidden">
            {typeof progress === 'number' && progress > 0 ? (
              <div
                className="h-full bg-[--accent] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              />
            ) : (
              <div className="h-full bg-[--accent] rounded-full w-1/3 animate-pulse" />
            )}
          </div>
        </div>

        {/* Agent pipeline steps */}
        <div className="rounded-xl border border-[--border-subtle] bg-[--surface] p-4 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[--text-secondary]">
            Multi-Agent Review Pipeline
          </div>
          <div className="space-y-2 text-xs text-[--text-body]">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
              <span>1. LiteParse High-Fidelity Extraction & Spatial Tables</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
              <span>2. Parallel Methodology, Results & Context Experts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
              <span>3. Cross-Peer Debate & Critique Synchronization</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
              <span>4. Synthesis Node & Structured Verdict Generation</span>
            </div>
          </div>
        </div>

        {/* PDF Reading Tip */}
        <div className="rounded-lg bg-[--accent-subtle] border border-[--border-accent]/30 p-3 text-[11px] text-[--text-primary] text-center">
          💡 You can read and highlight the complete PDF in the left viewer right now. Results will update automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 pb-24 max-w-4xl mx-auto">
      {/* Section Rail Anchor Navigation */}
      <div className="sticky top-0 z-20 bg-[--surface]/95 backdrop-blur-xs py-2 -mt-2 border-b border-[--border-subtle]">
        <SectionRail
          sections={railSections}
          onSectionClick={scrollToSection}
        />
      </div>

      {/* 1. Bottom Line Verdict */}
      {bottomLine && (
        <section id={REPORT_SECTIONS.BOTTOM_LINE} className="rounded-xl border border-[--border-accent]/40 bg-[--accent-subtle] p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="h-4 w-4 text-[--text-accent]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[--text-accent]">
              Bottom Line Verdict
            </h2>
          </div>
          <div className="prose prose-sm max-w-none text-[--text-primary] leading-relaxed font-medium">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {bottomLine}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {/* 2. Trust Scorecard */}
      <section id={REPORT_SECTIONS.TRUST_SCORECARD}>
        <TrustScorecard
          axesData={axesData}
          onJumpToEvidence={(e) => onJumpToPdfPage(e.page, e.quote)}
        />
      </section>

      {/* 3. Open Concerns */}
      <section id={REPORT_SECTIONS.OPEN_CONCERNS}>
        <ConcernList
          concerns={concerns}
          onJumpToCitation={(c) => c.page && onJumpToPdfPage(c.page, c.quote || c.description)}
        />
      </section>

      {/* 4. What They Did (Methodology) */}
      {(results.what_they_did || methEval.approach_strength || methEval.rigor_assessment) && (
        <section id={REPORT_SECTIONS.METHODOLOGY} className="rounded-xl border border-[--border-subtle] bg-[--surface] p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[--text-primary] border-b border-[--border-subtle] pb-2">
            What they did · Methodology & Experimental Design
          </h3>
          <div className="prose prose-sm max-w-none text-[--text-body] space-y-2">
            {results.what_they_did && (
              <p>{cleanText(results.what_they_did)}</p>
            )}
            {methEval.approach_strength && (
              <p><strong>Approach strength:</strong> {methEval.approach_strength}</p>
            )}
            {methEval.rigor_assessment && (
              <p><strong>Rigor assessment:</strong> {methEval.rigor_assessment}</p>
            )}
            {methEval.reproducibility && (
              <p><strong>Reproducibility assessment:</strong> {methEval.reproducibility}</p>
            )}
          </div>
        </section>
      )}

      {/* 5. What They Found (Evidence Quality) */}
      {(results.what_they_found || evQuality.empirical_support || evQuality.assessment || evQuality.key_results) && (
        <section id={REPORT_SECTIONS.EVIDENCE_QUALITY} className="rounded-xl border border-[--border-subtle] bg-[--surface] p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[--text-primary] border-b border-[--border-subtle] pb-2">
            What they found · Empirical Findings & Evidence
          </h3>
          <div className="prose prose-sm max-w-none text-[--text-body] space-y-2">
            {results.what_they_found && (
              <p>{cleanText(results.what_they_found)}</p>
            )}
            {evQuality.empirical_support && (
              <p><strong>Empirical support:</strong> {evQuality.empirical_support}</p>
            )}
            {evQuality.statistical_significance && (
              <p><strong>Statistical rigor:</strong> {evQuality.statistical_significance}</p>
            )}
            {evQuality.baseline_comparison && (
              <p><strong>Baseline comparisons:</strong> {evQuality.baseline_comparison}</p>
            )}
            {Array.isArray(evQuality.key_results) && evQuality.key_results.length > 0 && (
              <div>
                <strong>Key experimental results:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {evQuality.key_results.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. Why It Matters (Novelty & Impact) - Collapsible */}
      {(results.why_it_matters || novEval.key_innovation || impAssessment.field_impact) && (
        <section id={REPORT_SECTIONS.NOVELTY} className="rounded-xl border border-[--border-subtle] bg-[--surface] p-5 shadow-xs">
          <button
            type="button"
            onClick={() => toggleSection(REPORT_SECTIONS.NOVELTY)}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <h3 className="text-sm font-bold text-[--text-primary]">
              Why it matters · Novelty & Field Impact
            </h3>
            {collapsedSections[REPORT_SECTIONS.NOVELTY] ? (
              <ChevronRight className="h-4 w-4 text-[--text-secondary]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[--text-secondary]" />
            )}
          </button>

          {!collapsedSections[REPORT_SECTIONS.NOVELTY] && (
            <div className="mt-4 pt-3 border-t border-[--border-subtle] prose prose-sm max-w-none text-[--text-body] space-y-2">
              {results.why_it_matters && (
                <p>{cleanText(results.why_it_matters)}</p>
              )}
              {novEval.key_innovation && (
                <p><strong>Key innovation:</strong> {novEval.key_innovation}</p>
              )}
              {novEval.justification && (
                <p><strong>Novelty justification:</strong> {novEval.justification}</p>
              )}
              {impAssessment.practical_significance && (
                <p><strong>Practical significance:</strong> {impAssessment.practical_significance}</p>
              )}
              {impAssessment.field_impact && (
                <p><strong>Field-wide impact:</strong> {impAssessment.field_impact}</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* 7. Where This Could Go (Gaps & Opportunities) - Collapsible */}
      {(results.where_this_could_go || gapAnalysis.problem_statement || resOpportunities.immediate_extensions) && (
        <section id={REPORT_SECTIONS.GAP_ANALYSIS} className="rounded-xl border border-[--border-subtle] bg-[--surface] p-5 shadow-xs">
          <button
            type="button"
            onClick={() => toggleSection(REPORT_SECTIONS.GAP_ANALYSIS)}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <h3 className="text-sm font-bold text-[--text-primary]">
              Where this could go · Gaps & Next Steps
            </h3>
            {collapsedSections[REPORT_SECTIONS.GAP_ANALYSIS] ? (
              <ChevronRight className="h-4 w-4 text-[--text-secondary]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[--text-secondary]" />
            )}
          </button>

          {!collapsedSections[REPORT_SECTIONS.GAP_ANALYSIS] && (
            <div className="mt-4 pt-3 border-t border-[--border-subtle] prose prose-sm max-w-none text-[--text-body] space-y-2">
              {results.where_this_could_go && (
                <p>{cleanText(results.where_this_could_go)}</p>
              )}
              {gapAnalysis.problem_statement && (
                <p><strong>Target gap:</strong> {gapAnalysis.problem_statement}</p>
              )}
              {gapAnalysis.scope && (
                <p><strong>Unaddressed scope:</strong> {gapAnalysis.scope}</p>
              )}
              {Array.isArray(resOpportunities.immediate_extensions) && resOpportunities.immediate_extensions.length > 0 && (
                <div>
                  <strong>Immediate next steps:</strong>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {resOpportunities.immediate_extensions.map((ext: string, idx: number) => (
                      <li key={idx}>{ext}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 8. Full Summary - Collapsed by default */}
      {fullSummary && (
        <section id={REPORT_SECTIONS.EXECUTIVE_SUMMARY} className="rounded-xl border border-[--border-subtle] bg-[--surface-sunken]/40 p-5 shadow-xs">
          <button
            type="button"
            onClick={() => toggleSection(REPORT_SECTIONS.EXECUTIVE_SUMMARY)}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <div>
              <h3 className="text-sm font-bold text-[--text-primary]">
                Full summary
              </h3>
              <p className="text-xs text-[--text-secondary] mt-0.5">
                Detailed paper overview and background context
              </p>
            </div>
            {collapsedSections[REPORT_SECTIONS.EXECUTIVE_SUMMARY] ? (
              <ChevronRight className="h-4 w-4 text-[--text-secondary]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[--text-secondary]" />
            )}
          </button>

          {!collapsedSections[REPORT_SECTIONS.EXECUTIVE_SUMMARY] && (
            <div className="mt-4 pt-3 border-t border-[--border-subtle] prose prose-sm max-w-none text-[--text-body] leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {fullSummary}
              </ReactMarkdown>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default VerdictPanel;
