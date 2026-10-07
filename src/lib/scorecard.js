// Scorecard engine, per the VPMS PMS spec:
//
//   KPI achievement   = actual / target x 100      (lower-is-better inverted)
//   Each KPI is capped at 150% before averaging, so one KPI far over target
//   cannot hide a failing one.
//   Perspective score = plain average of its KPI achievements
//   Overall score     = plain average of every KPI achievement
//
// KPI weightings from the strategic plan are shown for reference only and
// are NOT applied. A perspective's contribution is its share of the KPIs, so
// the four contributions add up to the overall score exactly.
// The cap is not applied to the value shown against an individual KPI.

export const ACHIEVEMENT_CAP = 150

export function kpiAchievement(actual, target, direction = 'higher') {
  if (actual === null || actual === undefined || target === null || target === undefined) return null
  if (direction === 'lower') {
    if (actual <= 0) return target >= 0 ? ACHIEVEMENT_CAP : null
    return (target / actual) * 100
  }
  if (target === 0) return null
  return (actual / target) * 100
}

function capped(value, cap) {
  return value === null ? null : Math.min(value, cap)
}

/**
 * Plain mean of { value } items (weight is ignored). Unreported (null) values
 * are left out rather than counted as zero. Returns null when nothing is reported.
 */
export function weightedMean(items, cap = ACHIEVEMENT_CAP) {
  const values = items.map(({ value }) => capped(value, cap)).filter((v) => v !== null)
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Scores one scorecard. kpis: [{ perspective, achievement }]
 * Returns { scores, overall, contributions, shares } where shares is each
 * perspective's percentage of the reported KPIs.
 */
export function scoreScorecard(perspectives, kpis, cap = ACHIEVEMENT_CAP) {
  const reported = kpis.filter((k) => k.achievement !== null && k.achievement !== undefined)
  const total = reported.length
  const scores = {}
  const contributions = {}
  const shares = {}
  let sum = 0
  for (const p of perspectives) {
    const values = reported.filter((k) => k.perspective === p.key).map((k) => Math.min(k.achievement, cap))
    const subtotal = values.reduce((a, b) => a + b, 0)
    scores[p.key] = values.length ? subtotal / values.length : null
    contributions[p.key] = total ? subtotal / total : null
    shares[p.key] = total ? (values.length / total) * 100 : 0
    sum += subtotal
  }
  return { scores, overall: total ? sum / total : null, contributions, shares }
}

/**
 * Achievement of a monthly KPI over a set of months: the capped monthly
 * achievements, averaged. Months with no actual are skipped.
 */
export function periodAchievement(kpi, monthIndexes, cap = ACHIEVEMENT_CAP) {
  const values = monthIndexes
    .map((i) => kpiAchievement(kpi.actuals[i], kpi.target, kpi.direction))
    .filter((v) => v !== null)
    .map((v) => Math.min(v, cap))
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Average of the reported monthly actuals for a set of months, for display. */
export function periodActual(kpi, monthIndexes) {
  const values = monthIndexes.map((i) => kpi.actuals[i]).filter((v) => v !== null && v !== undefined)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
