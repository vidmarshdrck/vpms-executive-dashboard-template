import { catalog } from './catalog.js'

export const BRAND = '#1454c0'
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const PERSPECTIVES = ['Financial', 'Customer', 'Internal Processes', 'Learning & Growth']

export function perspectiveColor(name, index = 0) {
  const label = String(name || '').toLowerCase()
  if (label.includes('financ')) return BRAND
  if (label.includes('custom')) return '#2563B0'
  if (label.includes('intern') || label.includes('process')) return '#B7791F'
  if (label.includes('learn')) return '#6D4BA8'
  return [BRAND, '#2563B0', '#B7791F', '#6D4BA8'][index % 4]
}

export function perspectiveLabel(name) {
  const stripped = String(name || '').replace(/\s*perspective\s*/ig, '').trim().toLowerCase()
  return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : ''
}

export function ragFor(pct) {
  if (pct == null || Number.isNaN(Number(pct))) return 'na'
  if (pct >= 100) return 'green'
  if (pct >= 90) return 'amber'
  return 'red'
}

export function ragLabel(rag) {
  if (rag === 'green') return 'On target'
  if (rag === 'amber') return 'Near target'
  if (rag === 'red') return 'Off target'
  return 'No data'
}

function finite(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function achievementPct(target, actual) {
  const base = finite(target)
  const value = finite(actual)
  if (base == null || value == null) return null
  if (Math.abs(base) < 1e-12) return null
  return (value / base) * 100
}

export function cappedAchievement(target, actual, direction = 'HIGHER_BETTER') {
  if (direction === 'LOWER_BETTER') {
    const base = finite(target)
    const value = finite(actual)
    if (base == null || value == null) return null
    if (value <= 0) return base >= 0 ? 150 : null
    return Math.min(150, (base / value) * 100)
  }
  const pct = achievementPct(target, actual)
  return pct == null ? null : Math.min(150, pct)
}

export function departmentPct(target, actual, direction = 'HIGHER_BETTER') {
  if (direction === 'LOWER_BETTER') return achievementPct(actual, target)
  return achievementPct(target, actual)
}

export function quarterIndex(label) {
  const name = String(label || '').toUpperCase()
  const quarter = QUARTERS.indexOf(name)
  if (quarter >= 0) return quarter
  const month = MONTHS.indexOf(name)
  if (month >= 0) return Math.min(3, Math.floor(month / 3))
  return null
}

function periodOrder(label) {
  const month = MONTHS.indexOf(String(label || '').toUpperCase())
  if (month >= 0) return month
  const quarter = QUARTERS.indexOf(String(label || '').toUpperCase())
  return quarter >= 0 ? 20 + quarter : 99
}

export function latestMeasurement(periods, direction = 'HIGHER_BETTER') {
  const rows = [...(periods || [])].filter((period) => finite(period.actual) != null)
  if (!rows.length) return null
  rows.sort((a, b) => (Number(a.year) - Number(b.year)) || (periodOrder(a.label) - periodOrder(b.label)))
  const latest = rows[rows.length - 1]
  return { ...latest, pct: departmentPct(latest.target, latest.actual, direction) }
}

export function deptAccent(code) {
  const accents = ['violet', 'teal', 'magenta', 'orange', 'green', 'yellow']
  let sum = 0
  for (const char of String(code || '')) sum += char.charCodeAt(0)
  return accents[sum % accents.length]
}

export function formatWeight(weighting) {
  if (weighting == null || weighting === '') return '—'
  return `${(Number(weighting) * 100).toFixed(1)}%`
}

export function formatNum(value, digits = 2) {
  const number = finite(value)
  if (number == null) return '—'
  return number.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatPct(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function freshScorecard() {
  return structuredClone(catalog)
}

export function loadScorecard(raw) {
  if (!raw) return freshScorecard()
  try {
    const scorecard = JSON.parse(raw)
    if (scorecard?.version !== 1 || !Array.isArray(scorecard.kpis) || !Array.isArray(scorecard.departments)) return freshScorecard()
    return scorecard
  } catch {
    return freshScorecard()
  }
}

export function operatingDepartments(departments) {
  return [...departments].filter((department) => department.code !== 'gm' && department.name !== 'General Manager').sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
}

export function kpisForDepartment(kpis, code) {
  const rows = kpis.filter((kpi) => kpi.dept === code && kpi.active !== false)
  const names = [...new Set(rows.map((kpi) => kpi.perspective))]
  names.sort((a, b) => (PERSPECTIVES.indexOf(a) < 0 ? 99 : PERSPECTIVES.indexOf(a)) - (PERSPECTIVES.indexOf(b) < 0 ? 99 : PERSPECTIVES.indexOf(b)))
  return names.map((perspective) => ({
    perspective,
    kpis: rows.filter((kpi) => kpi.perspective === perspective).map((kpi) => {
      const latest = latestMeasurement(kpi.periods, kpi.direction)
      return { ...kpi, latest, latestPct: latest ? latest.pct : null }
    }),
  }))
}

export function departmentAverage(kpis, code) {
  const scores = []
  for (const group of kpisForDepartment(kpis, code)) {
    for (const kpi of group.kpis) if (kpi.latestPct != null) scores.push(Math.min(kpi.latestPct, 150))
  }
  if (!scores.length) return { pct: null, count: 0 }
  return { pct: scores.reduce((sum, value) => sum + value, 0) / scores.length, count: scores.length }
}

export function buildOrganisation(kpis, year = catalog.year) {
  const perspectives = PERSPECTIVES.map((name, index) => ({
    name,
    label: perspectiveLabel(name),
    color: perspectiveColor(name, index),
    total: kpis.filter((kpi) => kpi.perspective === name && kpi.active !== false).length,
    tracked: 0,
    reporting: 0,
    perf: null,
    q: [null, null, null, null],
  }))
  const rows = []
  for (const kpi of kpis) {
    if (kpi.dept !== 'gm' || kpi.active === false) continue
    const perspectiveIndex = perspectives.findIndex((item) => item.name === kpi.perspective)
    if (perspectiveIndex < 0) continue
    const quarters = [null, null, null, null]
    let recorded = false
    for (const period of kpi.periods || []) {
      if (Number(period.year) !== Number(year)) continue
      const index = quarterIndex(period.label)
      if (index == null) continue
      recorded = true
      quarters[index] = { t: finite(period.target), a: finite(period.actual), p: cappedAchievement(period.target, period.actual, kpi.direction) }
    }
    if (!recorded) continue
    let latest = null
    let latestQ = null
    for (let index = 3; index >= 0; index -= 1) {
      if (quarters[index]?.p != null) { latest = quarters[index].p; latestQ = index; break }
    }
    perspectives[perspectiveIndex].tracked += 1
    if (latest != null) perspectives[perspectiveIndex].reporting += 1
    rows.push({ id: kpi.id, name: kpi.measure || kpi.milestone || 'KPI', p: perspectiveIndex, dir: kpi.direction || 'HIGHER_BETTER', q: quarters, latest, latestQ })
  }
  const overallQ = [0, 1, 2, 3].map((index) => {
    const values = rows.flatMap((row) => (row.q[index]?.p != null ? [row.q[index].p] : []))
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  })
  perspectives.forEach((perspective, index) => {
    perspective.q = [0, 1, 2, 3].map((quarter) => {
      const values = rows.flatMap((row) => (row.p === index && row.q[quarter]?.p != null ? [row.q[quarter].p] : []))
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
    })
    const latest = rows.flatMap((row) => (row.p === index && row.latest != null ? [row.latest] : []))
    perspective.perf = latest.length ? latest.reduce((sum, value) => sum + value, 0) / latest.length : null
  })
  const perf = perspectives.flatMap((perspective) => (perspective.perf == null ? [] : [perspective.perf]))
  const status = { green: 0, amber: 0, red: 0, na: 0 }
  for (const row of rows) status[row.latest == null ? 'na' : ragFor(row.latest)] += 1
  const objectives = new Set(kpis.filter((kpi) => kpi.active !== false && kpi.strategy).map((kpi) => `${kpi.perspective}:${kpi.strategy}`)).size
  return {
    year,
    perspectives,
    kpis: rows,
    overall: perf.length ? perf.reduce((sum, value) => sum + value, 0) / perf.length : null,
    overallQ,
    status,
    stats: {
      tracked: rows.length,
      reporting: rows.length - status.na,
      onTarget: status.green,
      totalKpis: kpis.filter((kpi) => kpi.active !== false).length,
      objectives,
    },
  }
}

export function departmentCoverage(kpis, departments) {
  return operatingDepartments(departments).map((department) => {
    const rows = kpis.filter((kpi) => kpi.dept === department.code && kpi.active !== false)
    return {
      name: department.name,
      code: department.code,
      tracked: rows.filter((kpi) => (kpi.periods || []).some((period) => finite(period.target) != null)).length,
      reporting: rows.filter((kpi) => latestMeasurement(kpi.periods, kpi.direction)).length,
    }
  }).filter((department) => department.tracked > 0)
}

export function recordPeriod(scorecard, kpiId, period) {
  return {
    ...scorecard,
    kpis: scorecard.kpis.map((kpi) => {
      if (kpi.id !== kpiId) return kpi
      const periods = [...(kpi.periods || [])]
      const next = { label: period.label, year: Number(period.year), target: finite(period.target), actual: finite(period.actual) }
      const index = periods.findIndex((item) => item.label === next.label && Number(item.year) === next.year)
      if (index >= 0) periods[index] = next
      else periods.push(next)
      return { ...kpi, periods }
    }),
  }
}

export function addDepartment(scorecard, department) {
  const code = String(department.code || '').trim().toLowerCase().replace(/\s+/g, '-')
  const name = String(department.name || '').trim()
  if (!code || !name) throw new Error('Code and name are required.')
  if (scorecard.departments.some((item) => item.code === code)) throw new Error('That department code is already used.')
  return { ...scorecard, departments: [...scorecard.departments, { code, name, sheet: department.sheet || '', sort: Number(department.sort) || 0 }] }
}

export function updateDepartment(scorecard, code, fields) {
  return { ...scorecard, departments: scorecard.departments.map((department) => department.code === code ? { ...department, ...fields, code } : department) }
}

export function deleteDepartment(scorecard, code) {
  if (code === 'gm') throw new Error('The executive office stays on the GM Dashboard.')
  return { ...scorecard, departments: scorecard.departments.filter((department) => department.code !== code), kpis: scorecard.kpis.filter((kpi) => kpi.dept !== code) }
}

export function addKpi(scorecard, fields) {
  const measure = String(fields.measure || '').trim()
  if (!fields.dept || !fields.perspective || !measure) throw new Error('Department, perspective and measure are required.')
  const id = `k${Date.now().toString(36)}`
  const weighting = fields.weighting === '' || fields.weighting == null ? null : Number(fields.weighting) / 100
  return {
    ...scorecard,
    kpis: [...scorecard.kpis, {
      id, dept: fields.dept, perspective: fields.perspective, strategy: null,
      milestone: String(fields.milestone || '').trim() || null,
      initiative: String(fields.initiative || '').trim() || null,
      measure, weighting: Number.isFinite(weighting) ? weighting : null, active: true, periods: [],
    }],
  }
}

export function toggleKpi(scorecard, id) {
  return { ...scorecard, kpis: scorecard.kpis.map((kpi) => kpi.id === id ? { ...kpi, active: kpi.active === false } : kpi) }
}

export function deleteKpi(scorecard, id) {
  return { ...scorecard, kpis: scorecard.kpis.filter((kpi) => kpi.id !== id) }
}
