// Reporting-period / timeframe selection.
//
// The source data currently only carries monthly granularity (no real
// calendar dates, no weekly figures). This module filters what granularity
// actually exists rather than inventing daily/weekly values. When a weekly
// feed becomes available (Navision or Excel), `getWeeklyBreakdown` is the
// integration point — it returns `null` today so the UI can render an
// honest "not yet available" state instead of fabricated numbers.
//
// Quarters (Q1-Q4) are a first-class concept here: any consumer that groups
// data by quarter should use `QUARTERS` / `monthIndexToQuarter` /
// `quarterOfDate` rather than hardcoding a 3-quarter list. A quarter with no
// source rows renders as "no data" — it is never fabricated.

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

// monthIndex is 0-11 (JS Date's getMonth()); every 3 months rolls into the next quarter.
export function monthIndexToQuarter(monthIndex) {
  return QUARTERS[Math.floor(monthIndex / 3) % 4]
}

export function quarterOfDate(date = new Date()) {
  return monthIndexToQuarter(date.getMonth())
}

// Wraps Q1 -> Q4 across a year boundary (e.g. previousQuarter('Q1') === 'Q4').
export function previousQuarter(quarterId) {
  const index = QUARTERS.indexOf(quarterId)
  return QUARTERS[(index + QUARTERS.length - 1) % QUARTERS.length]
}

export const TIMEFRAMES = [
  { id: 'last-quarter', label: 'Last quarter' },
  { id: 'current-quarter', label: 'Current quarter' },
  { id: 'custom', label: 'Custom' },
]

// Starting selector state: defaults to "current quarter", with the custom
// range pre-seeded to the last 3 months so switching to Custom doesn't start
// from an empty/confusing range. `customYear` labels which year the custom
// month range belongs to — the source series is still a single 12-month
// run (no per-year records yet), so changing it relabels the period rather
// than pulling in a different year's figures.
export function defaultTimeframeState(seriesLength, referenceDate = new Date()) {
  return {
    id: 'current-quarter',
    customFrom: Math.max(0, seriesLength - 3),
    customTo: seriesLength - 1,
    customYear: referenceDate.getFullYear(),
  }
}

// [startMonthIndex, endMonthIndex] (0-11) that a given quarter id spans, e.g. 'Q2' -> [3, 5].
function quarterMonthIndexRange(quarterId) {
  const qIndex = QUARTERS.indexOf(quarterId)
  return [qIndex * 3, qIndex * 3 + 2]
}

/**
 * Returns the slice of a monthly series (array of { month, ... }) for the
 * selected timeframe. `last-quarter` / `current-quarter` resolve to a real
 * calendar quarter (based on today's date) and return whichever months of
 * that quarter exist in the series — an empty array when the source data
 * has not reached that quarter yet. `custom` uses the caller-selected
 * inclusive month-index range.
 */
export function filterSeriesByTimeframe(series, timeframe, referenceDate = new Date()) {
  if (!Array.isArray(series) || series.length === 0) return []

  if (timeframe.id === 'custom') {
    const from = Math.max(0, Math.min(timeframe.customFrom ?? 0, series.length - 1))
    const to = Math.max(from, Math.min(timeframe.customTo ?? series.length - 1, series.length - 1))
    return series.slice(from, to + 1)
  }

  const currentQuarter = quarterOfDate(referenceDate)
  const targetQuarter = timeframe.id === 'last-quarter' ? previousQuarter(currentQuarter) : currentQuarter
  const [start, end] = quarterMonthIndexRange(targetQuarter)
  return series.slice(start, end + 1).filter(Boolean)
}

export function describeTimeframe(series, timeframe, referenceDate = new Date()) {
  const slice = filterSeriesByTimeframe(series, timeframe, referenceDate)
  // Always "Start – End Year": the quarter name is not part of the label.
  const year = timeframe.customYear ?? referenceDate.getFullYear()
  if (slice.length === 0) return `No data for the selected period · ${year}`
  if (slice.length === 1) return `${slice[0].month} ${year}`
  return `${slice[0].month} – ${slice[slice.length - 1].month} ${year}`
}

/**
 * Groups a monthly series into quarter totals using the real Q1-Q4 month
 * ranges. Quarters with no source months are omitted rather than shown as
 * zero, so a chart/table consuming this never implies "no activity" for a
 * quarter that simply has not been reported yet.
 */
export function groupMonthlyIntoQuarters(series, valueKey) {
  if (!Array.isArray(series)) return []
  return QUARTERS.map((quarter) => {
    const [start, end] = quarterMonthIndexRange(quarter)
    const months = series.slice(start, end + 1).filter(Boolean)
    if (months.length === 0) return null
    const total = months.reduce((sum, entry) => sum + (entry[valueKey] ?? 0), 0)
    return { quarter, [valueKey]: total, months: months.length }
  }).filter(Boolean)
}

/**
 * Which quarters (in Q1..Q4 order) the selected timeframe's month range
 * touches — the single source of truth for filtering any quarter-level
 * chart/table by the global reporting-period control, so a quarterly view
 * never disagrees with the header's selection.
 */
export function quartersInTimeframe(timeframe, seriesLength = 12) {
  const from = Math.max(0, Math.min(timeframe.customFrom ?? 0, seriesLength - 1))
  const to = Math.max(from, Math.min(timeframe.customTo ?? seriesLength - 1, seriesLength - 1))
  const touched = new Set()
  for (let month = from; month <= to; month += 1) touched.add(monthIndexToQuarter(month))
  return QUARTERS.filter((q) => touched.has(q))
}

/**
 * Weekly comparison within the selected period. Returns null when the
 * source series has no weekly-level records — the UI must render an empty
 * state rather than synthesising weeks from monthly totals.
 */
export function getWeeklyBreakdown(series) {
  const hasWeeklyData = Array.isArray(series) && series.some((entry) => entry.week !== undefined)
  if (!hasWeeklyData) return null
  return series.filter((entry) => entry.week !== undefined)
}
