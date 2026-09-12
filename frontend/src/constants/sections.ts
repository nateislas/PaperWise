export const REPORT_SECTIONS = {
  BOTTOM_LINE: 'bottom-line',
  TRUST_SCORECARD: 'trust-scorecard',
  OPEN_CONCERNS: 'open-concerns',
  EXECUTIVE_SUMMARY: 'executive-summary',
  METHODOLOGY: 'methodological-evaluation',
  EVIDENCE_QUALITY: 'evidence-quality',
  NOVELTY: 'novelty-assessment',
  GAP_ANALYSIS: 'gap-analysis',
  CRITICAL_REVIEW: 'critical-review',
  IMPACT_ASSESSMENT: 'impact-assessment',
  RESEARCH_OPPORTUNITIES: 'research-opportunities',
} as const;

export type ReportSectionId = typeof REPORT_SECTIONS[keyof typeof REPORT_SECTIONS];

/** Map citation section aliases from LLM / Chat agents to DOM element IDs */
export const CITATION_ALIAS_MAP: Record<string, ReportSectionId> = {
  methodology: REPORT_SECTIONS.METHODOLOGY,
  'methodological-evaluation': REPORT_SECTIONS.METHODOLOGY,
  evidence: REPORT_SECTIONS.EVIDENCE_QUALITY,
  'evidence-quality': REPORT_SECTIONS.EVIDENCE_QUALITY,
  novelty: REPORT_SECTIONS.NOVELTY,
  'novelty-assessment': REPORT_SECTIONS.NOVELTY,
  gaps: REPORT_SECTIONS.GAP_ANALYSIS,
  'gap-analysis': REPORT_SECTIONS.GAP_ANALYSIS,
  critical: REPORT_SECTIONS.CRITICAL_REVIEW,
  'critical-review': REPORT_SECTIONS.CRITICAL_REVIEW,
  summary: REPORT_SECTIONS.EXECUTIVE_SUMMARY,
  'executive-summary': REPORT_SECTIONS.EXECUTIVE_SUMMARY,
  verdict: REPORT_SECTIONS.BOTTOM_LINE,
  scorecard: REPORT_SECTIONS.TRUST_SCORECARD,
  concerns: REPORT_SECTIONS.OPEN_CONCERNS,
  impact: REPORT_SECTIONS.IMPACT_ASSESSMENT,
  opportunities: REPORT_SECTIONS.RESEARCH_OPPORTUNITIES,
};

export function resolveReportSectionId(alias: string): ReportSectionId | null {
  const normalized = alias.toLowerCase().trim();
  return CITATION_ALIAS_MAP[normalized] ?? null;
}
