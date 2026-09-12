export const FEATURES = {
  /** Trust scored Watch feed (stubbed in V1, live in M5) */
  watchFeed: false,
  /** Independent repo, code, and data signals (stubbed in V1) */
  independentSignals: false,
  /** Structured Read tab (problem, approach, data, results, limits) */
  structuredRead: false,
  /** Paste arXiv ID / DOI / URL in add modal */
  addByLink: false,
  /** Verdict outcome logging & calibration tracking */
  outcomeTracking: false,
  /** Multi-user authentication & user scoping (M4) */
  multiUser: false,
  /** Analysis Rubric v2 structured Pydantic schema (M3) */
  rubricV2: false,
  /** Folder import scanner */
  folderScanner: true,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag] ?? false;
}
