import { classifyKpi, TONE_TO_BADGE_TONE, DEFAULT_KPI_THRESHOLDS } from './kpiThresholds.js'

// NOTE: two similarly-named functions live in this file on purpose —
// `getPerformanceStatus` (older, 3-band: On target/Watch/Below target) and
// `getKpiPerformance` (newer, 4-band red/orange/yellow/green per the
// configurable threshold system). They are not interchangeable: existing
// call sites/tests expect the 3-band labels from this one, so it hasn't been
// replaced — new code should generally reach for `getKpiPerformance` below.
export function getPerformanceStatus(actual, target, thresholds) {
  if (actual === null || actual === undefined || target === null || target === undefined || target === 0) {
    return { label: 'Not reported', tone: 'neutral' }
  }

  // Keep the original three-band labels used across the existing UI/tests,
  // while the four-band red/orange/yellow/green classification (used by
  // progress bars and heat maps) lives in getKpiPerformance below.
  const achievement = (actual / target) * 100
  if (achievement >= 97) return { label: 'On target', tone: 'positive' }
  if (achievement >= 80) return { label: 'Watch', tone: 'warning' }
  return { label: 'Below target', tone: 'negative' }
}

// Four-band red/orange/yellow/green classification per the configurable KPI
// threshold system (src/lib/kpiThresholds.js). Supports per-KPI overrides
// and lower-is-better inversion.
export function getKpiPerformance(actual, target, thresholds = DEFAULT_KPI_THRESHOLDS) {
  if (actual === null || actual === undefined || target === null || target === undefined || target === 0) {
    return { tone: 'na', badgeTone: 'neutral', achievement: null }
  }
  const achievement = (actual / target) * 100
  const tone = classifyKpi(achievement, thresholds)
  return { tone, badgeTone: TONE_TO_BADGE_TONE[tone], achievement }
}

export function getVariance(actual, target) {
  if (actual === null || actual === undefined || target === null || target === undefined || target === 0) {
    return { absolute: null, percent: null, direction: 'neutral' }
  }

  const absolute = actual - target
  return {
    absolute,
    percent: (absolute / Math.abs(target)) * 100,
    direction: absolute === 0 ? 'neutral' : absolute > 0 ? 'positive' : 'negative',
  }
}

export function getDataFreshnessLabel({ source, isProvisional = false }) {
  return `${isProvisional ? 'Provisional · ' : ''}${source}`
}

// Priority driven by how close a deadline is, not a separately hardcoded
// field — a project overdue or due within 30 days is High, within 90 days
// is Medium, anything further out is Low. Used on the Projects & actions
// page so the highest-priority items are always the ones closing in soonest.
export function getPriorityFromDeadline(deadline, referenceDate = new Date()) {
  if (!deadline) return { label: 'Not scheduled', tone: 'neutral', daysUntil: null }
  const daysUntil = Math.ceil((new Date(deadline) - referenceDate) / (1000 * 60 * 60 * 24))
  if (daysUntil <= 30) return { label: 'High', tone: 'negative', daysUntil }
  if (daysUntil <= 90) return { label: 'Medium', tone: 'warning', daysUntil }
  return { label: 'Low', tone: 'neutral', daysUntil }
}
