// Status and formatting for a 0-100 score, shared by the scorecard pages.
import { getKpiPerformance } from './dashboardMetrics.js'
import { TONE_LABEL } from './kpiThresholds.js'

const TONE_COLOR = {
  green: 'var(--positive)',
  yellow: 'var(--warning)',
  orange: 'var(--caution)',
  red: 'var(--negative)',
  na: 'var(--target)',
}

export function scoreStatus(score) {
  const performance = getKpiPerformance(score, 100)
  return { ...performance, label: TONE_LABEL[performance.tone], color: TONE_COLOR[performance.tone] }
}

export function formatScore(value, digits = 1) {
  return value === null || value === undefined ? 'N/A' : `${value.toFixed(digits)}%`
}
