export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STORAGE_PREFIX = 'vhpms-reporting-period:'

function parts(today) {
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}/.test(today)) {
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  }
  const date = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date()
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function defaultPeriod(today = new Date()) {
  const { year, month } = parts(today)
  const from = Math.floor((month - 1) / 3) * 3 + 1
  return { year, from, to: from + 2 }
}

function bounded(value, minimum, maximum, fallback) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < minimum || number > maximum) return fallback
  return number
}

export function clampPeriod(period = {}, today) {
  const fallback = defaultPeriod(today)
  const year = bounded(period.year, 2020, 2100, fallback.year)
  const from = bounded(period.from, 1, 12, fallback.from)
  const to = Math.max(from, bounded(period.to, 1, 12, from))
  return { year, from, to }
}

export function periodLabel(period) {
  const safe = clampPeriod(period)
  const from = MONTHS[safe.from - 1]
  const to = MONTHS[safe.to - 1]
  return safe.from === safe.to ? `${from} ${safe.year}` : `${from} – ${to} ${safe.year}`
}

export function periodBounds(period) {
  const safe = clampPeriod(period)
  const start = `${safe.year}-${String(safe.from).padStart(2, '0')}-01`
  const endDay = new Date(Date.UTC(safe.year, safe.to, 0)).getUTCDate()
  const end = `${safe.year}-${String(safe.to).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
  return { start, end }
}

export function yearOptions(todayYear, selectedYear) {
  const years = [todayYear - 1, todayYear, todayYear + 1]
  if (!years.includes(selectedYear)) years.push(selectedYear)
  return [...new Set(years)].filter((year) => year >= 2020 && year <= 2100).sort((a, b) => a - b)
}

export function monthsInPeriod(period) {
  const safe = clampPeriod(period)
  const months = []
  for (let month = safe.from; month <= safe.to; month += 1) months.push(`${safe.year}-${String(month).padStart(2, '0')}`)
  return months
}

export function dateInPeriod(date, period) {
  const iso = String(date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const { start, end } = periodBounds(period)
  return iso >= start && iso <= end
}

export function rowsInPeriod(rows, period, field = 'date') {
  return (rows || []).filter((row) => dateInPeriod(row?.[field], period))
}

export function weekOverlapsPeriod(week, period) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(week || ''))) return false
  const end = new Date(`${week}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const { start, end: periodEnd } = periodBounds(period)
  return end.toISOString().slice(0, 10) >= start && week <= periodEnd
}

export function periodStorageKey(userId) {
  return `${STORAGE_PREFIX}${userId || 'signed-out'}`
}

export function readStoredPeriod(storage, userId, today) {
  try {
    const raw = storage?.getItem(periodStorageKey(userId))
    if (!raw) return defaultPeriod(today)
    return clampPeriod(JSON.parse(raw), today)
  } catch {
    return defaultPeriod(today)
  }
}

export function writeStoredPeriod(storage, userId, period, today) {
  const safe = clampPeriod(period, today)
  try {
    storage?.setItem(periodStorageKey(userId), JSON.stringify(safe))
  } catch {
    // Private browsing can reject localStorage. Apply still keeps the period in memory.
  }
  return safe
}
