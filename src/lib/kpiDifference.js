// Difference is the measured actual minus its target, in the KPI's own unit.
// It is not the achievement percentage used for score/status calculations.
export function kpiDifference(actual, target) {
  if (actual === null || actual === undefined || target === null || target === undefined) return null
  return actual - target
}

export function formatKpiDifference(actual, target, unit) {
  const difference = kpiDifference(actual, target)
  if (difference === null) return '—'
  const digits = unit === 'LTIFR' ? 2 : 1
  const rounded = Number(difference.toFixed(digits))
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  const suffix = unit === '%' ? ' pp' : unit ? ` ${unit}` : ''
  return `${sign}${Math.abs(rounded).toFixed(digits)}${suffix}`
}
