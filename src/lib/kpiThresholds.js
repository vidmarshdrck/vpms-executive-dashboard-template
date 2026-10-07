// Configurable KPI performance classification.
//
// Default methodology (section 8 of the VPMS revision brief):
//   below 90%          -> red      (off target)
//   90% up to 99.9%    -> amber    (near target)
//   >= 100%            -> green    (on target)
// (VPMS PMS spec: green >= 100, amber 90-99.9, red < 90; no orange band.)
//
// A KPI can override any threshold, and can flip `lowerIsBetter` when the
// underlying methodology means a smaller number is the good outcome (e.g. a
// cost ratio). The dashboard must never assume "higher is always better" —
// callers pass the KPI's own config, not a single hardcoded rule.

export const DEFAULT_KPI_THRESHOLDS = {
  greenAt: 100,
  yellowAt: 90,
  orangeAt: 90,
  lowerIsBetter: false,
}

export const TONES = ['green', 'yellow', 'orange', 'red', 'na']

/**
 * Classify a KPI achievement percentage (actual / target * 100, already
 * normalised by the caller) into one of: green | yellow | orange | red | na.
 */
export function classifyKpi(value, thresholds = {}) {
  const { greenAt, yellowAt, orangeAt, lowerIsBetter } = { ...DEFAULT_KPI_THRESHOLDS, ...thresholds }
  if (value === null || value === undefined || Number.isNaN(value)) return 'na'

  // For "lower is better" KPIs the achievement axis is inverted: a value at
  // or below the green threshold is the good outcome, and larger values are
  // progressively worse.
  if (lowerIsBetter) {
    if (value <= greenAt) return 'green'
    if (value <= yellowAt) return 'yellow'
    if (value <= orangeAt) return 'orange'
    return value > orangeAt ? 'red' : 'orange'
  }

  if (value >= greenAt) return 'green'
  if (value >= yellowAt) return 'yellow'
  if (value > orangeAt) return 'orange'
  return 'red'
}

export const TONE_LABEL = {
  green: 'On target',
  yellow: 'Near target',
  orange: 'Near target',
  red: 'Off target',
  na: 'Not reported',
}

// Maps a classification tone to the shared StatusBadge tone system.
export const TONE_TO_BADGE_TONE = {
  green: 'positive',
  yellow: 'warning',
  orange: 'caution',
  red: 'negative',
  na: 'neutral',
}

export function getKpiClassification(actual, target, thresholds = {}) {
  if (actual === null || actual === undefined || target === null || target === undefined || target === 0) {
    return { tone: 'na', label: TONE_LABEL.na, achievement: null }
  }
  const achievement = (actual / target) * 100
  const tone = classifyKpi(achievement, thresholds)
  return { tone, label: TONE_LABEL[tone], achievement }
}
