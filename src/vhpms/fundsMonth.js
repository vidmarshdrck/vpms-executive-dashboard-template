export function monthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return ''
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function latestMonth(dates, fallback = '') {
  const months = (dates || []).map((date) => String(date || '').slice(0, 7)).filter((month) => /^\d{4}-\d{2}$/.test(month)).sort()
  if (months.length) return months.at(-1)
  const text = String(fallback || '')
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : ''
}

export function shiftMonth(month, delta) {
  const [year, number] = String(month || '').split('-').map(Number)
  if (!year || !number) return ''
  const date = new Date(Date.UTC(year, number - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

export function daysInMonth(month) {
  const [year, number] = String(month || '').split('-').map(Number)
  if (!year || !number) return 0
  return new Date(Date.UTC(year, number, 0)).getUTCDate()
}

export function monthRows(rows, month) {
  return (rows || []).filter((row) => String(row.date || '').startsWith(`${month}-`))
}

export function monthSummary(rows) {
  const expense = rows.filter((row) => row.kind === 'expense').reduce((sum, row) => sum + Number(row.amount), 0)
  const income = rows.filter((row) => row.kind === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
  return { expense, income, total: income - expense }
}

export function categoryShare(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0)
  const groups = new Map()
  for (const row of rows) {
    const name = row.category || 'Unspecified'
    groups.set(name, (groups.get(name) || 0) + Number(row.amount))
  }
  return [...groups.entries()]
    .map(([name, amount]) => ({ name, amount, pct: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
}

export function dailyAmounts(rows, month) {
  const count = daysInMonth(month)
  const days = []
  for (let day = 1; day <= count; day += 1) {
    days.push({ date: `${month}-${String(day).padStart(2, '0')}`, income: 0, expense: 0, net: 0 })
  }
  const byDate = new Map(days.map((day) => [day.date, day]))
  for (const row of monthRows(rows, month)) {
    const bucket = byDate.get(row.date)
    if (!bucket) continue
    if (row.kind === 'income') bucket.income += Number(row.amount)
    else bucket.expense += Number(row.amount)
    bucket.net = bucket.income - bucket.expense
  }
  return days
}

export function compactAmount(value) {
  const number = Number(value) || 0
  const sign = number < 0 ? '-' : ''
  const absolute = Math.abs(number)
  if (absolute === 0) return '0'
  if (absolute >= 1000) {
    const thousands = absolute / 1000
    const text = thousands >= 10 || Number.isInteger(thousands) ? String(Math.round(thousands * 10) / 10).replace(/\.0$/, '') : thousands.toFixed(1).replace(/\.0$/, '')
    return `${sign}${text}k`
  }
  const small = absolute >= 100 ? String(Math.round(absolute)) : String(Math.round(absolute * 10) / 10).replace(/\.0$/, '')
  return `${sign}${small}`
}

export function sourceAnalysis(rows) {
  const groups = new Map()
  for (const row of rows) {
    const name = row.category || 'Unspecified'
    if (!groups.has(name)) groups.set(name, { name, income: 0, expense: 0 })
    const bucket = groups.get(name)
    if (row.kind === 'income') bucket.income += Number(row.amount)
    else bucket.expense += Number(row.amount)
  }
  return [...groups.values()].sort((a, b) => (b.income + b.expense) - (a.income + a.expense) || a.name.localeCompare(b.name))
}
