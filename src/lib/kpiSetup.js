import { departments, PERSPECTIVES } from '../data/scorecardData.js'
import { QUARTERS } from './reportingPeriod.js'
import { readBooks, bookReport } from './entryBooks.js'
const KEY = 'vpms-kpi-setup-v1'
const EVENT = 'vpms:kpi-setup-changed'
export const LEGACY_KPI_YEAR = 2026
export const KPI_SOURCES = [
  { id: 'manual', label: 'Department enters actual', unit: null },
  { id: 'finance.revenue', label: 'Approved revenue total', departmentId: 'finance', unit: 'ZMW' },
  { id: 'finance.expenditure', label: 'Approved operating expenditure', departmentId: 'finance', unit: 'ZMW' },
  { id: 'finance.revenueAchievement', label: 'Approved revenue ÷ book target (%)', departmentId: 'finance', unit: '%' },
  { id: 'operations.received', label: 'Approved product received total', departmentId: 'operations', unit: 'm³' },
  { id: 'operations.distributed', label: 'Approved product distributed total', departmentId: 'operations', unit: 'm³' },
  { id: 'operations.distributionRate', label: 'Approved distributed ÷ received (%)', departmentId: 'operations', unit: '%' },
]
const copy = value => structuredClone(value)
function templates() { return Object.fromEntries(departments.map(department => [department.id, department.kpis.map(({ code, name, perspective, unit, target, direction, weight }) => ({ code, name, perspective, unit, target, direction, weight, source: 'manual', included: true }))])) }
export function readKpiSetup() {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { definitions: templates(), activations: {}, history: [] }
  try { const store = JSON.parse(raw); if (!store.definitions || !store.activations || !Array.isArray(store.history)) throw new Error(); return store }
  catch { throw new Error('KPI setup could not be read. Restore the saved data before editing.') }
}
function write(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)) }
  catch { throw new Error('KPI setup could not be saved. Free some browser storage and try again.') }
  window.dispatchEvent(new Event(EVENT))
}
export function subscribeToKpiSetup(callback) {
  const onStorage = event => { if (!event.key || event.key === KEY) callback() }
  window.addEventListener(EVENT, callback); window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', onStorage) }
}
function requireGM(user) { if (user?.role !== 'GM') throw new Error('Only the GM can set up or activate KPIs.') }
function requireDepartment(id) { if (!departments.some(department => department.id === id)) throw new Error('Choose a valid department.') }
export function kpiPeriod(year, quarter) {
  if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100 || !QUARTERS.includes(quarter)) throw new Error('Choose a valid year and quarter.')
  return `${Number(year)}-${quarter}`
}
export function parseKpiPeriod(period) {
  const match = /^(\d{4})-(Q[1-4])$/.exec(String(period))
  if (!match) throw new Error('Choose a KPI period with a year and quarter.')
  kpiPeriod(Number(match[1]), match[2]); return { year: Number(match[1]), quarter: match[2] }
}
export function periodLabel(period) { return /^\d{4}-Q[1-4]$/.test(period) ? period.replace('-', ' · ') : `Legacy · ${period}` }
export function getKpiActivation(departmentId, period) { return copy(readKpiSetup().activations[`${departmentId}::${period}`] || null) }
function validatedDefinition(departmentId, form, code) {
  const name = String(form.name || '').trim(), unit = String(form.unit || '').trim()
  if (!name || name.length > 140 || !unit || unit.length > 30) throw new Error('Enter a KPI name (up to 140 characters) and unit (up to 30 characters).')
  if (!PERSPECTIVES.some(perspective => perspective.key === form.perspective)) throw new Error('Choose a perspective.')
  if (!['higher', 'lower'].includes(form.direction)) throw new Error('Choose whether higher or lower is better.')
  if (form.target === '' || form.target == null || !Number.isFinite(Number(form.target)) || Number(form.target) < 0) throw new Error('Enter a target of zero or more.')
  if (form.weight === '' || form.weight == null || !Number.isFinite(Number(form.weight)) || Number(form.weight) < 0) throw new Error('Enter a weight of zero or more.')
  const source = KPI_SOURCES.find(item => item.id === (form.source || 'manual'))
  if (!source || (source.departmentId && source.departmentId !== departmentId)) throw new Error('Choose a data source belonging to this department.')
  if (source.unit && source.unit !== unit) throw new Error(`Use ${source.unit} for this automatic data source.`)
  return { code, name, unit, perspective: form.perspective, target: Number(form.target), direction: form.direction, weight: Number(form.weight), source: source.id, included: form.included !== false }
}
export function saveKpiDefinition(user, departmentId, form) {
  requireGM(user); requireDepartment(departmentId)
  const store = readKpiSetup(), list = store.definitions[departmentId] || []
  const previous = form.code && list.find(item => item.code === form.code)
  if (form.code && !previous) throw new Error('KPI definition not found.')
  const definition = validatedDefinition(departmentId, form, previous?.code || `${departmentId.slice(0, 3).toUpperCase()}-GM-${crypto.randomUUID().slice(0, 8)}`)
  if (list.some(item => item.code !== definition.code && item.name.toLowerCase() === definition.name.toLowerCase())) throw new Error('This department already has a KPI with that name.')
  store.definitions[departmentId] = previous ? list.map(item => item.code === definition.code ? definition : item) : [...list, definition]
  store.history.push({ action: previous ? 'Definition updated' : 'Definition created', departmentId, code: definition.code, by: user.id, at: new Date().toISOString() })
  write(store); return copy(definition)
}
export function activateKpis(user, departmentIds, year, quarter) {
  requireGM(user)
  if (!Array.isArray(departmentIds) || !departmentIds.length) throw new Error('Choose at least one department.')
  const period = kpiPeriod(year, quarter), store = readKpiSetup(), pending = []
  for (const departmentId of new Set(departmentIds)) {
    requireDepartment(departmentId)
    if (store.activations[`${departmentId}::${period}`]) continue
    const kpis = (store.definitions[departmentId] || []).filter(item => item.included).map(item => validatedDefinition(departmentId, item, item.code))
    if (!kpis.length) throw new Error(`Include at least one KPI for ${departments.find(item => item.id === departmentId).name}.`)
    pending.push({ id: crypto.randomUUID(), departmentId, period, year: Number(year), quarter, kpis, activatedAt: new Date().toISOString(), activatedBy: { id: user.id, name: user.name } })
  }
  if (!pending.length) throw new Error('The selected departments are already activated for this quarter.')
  for (const activation of pending) { store.activations[`${activation.departmentId}::${period}`] = activation; store.history.push({ action: 'Quarter activated', departmentId: activation.departmentId, period, by: user.id, at: activation.activatedAt }) }
  write(store); return copy(pending)
}
export function automaticKpiValue(kpi, period) {
  if (!kpi.source || kpi.source === 'manual') return null
  const { year, quarter } = parseKpiPeriod(period)
  const row = bookReport(readBooks(), year).quarters.find(item => item.quarter === quarter)
  const values = { 'finance.revenue': row.actual, 'finance.expenditure': row.expenditure, 'finance.revenueAchievement': row.actual !== null && row.target > 0 ? row.actual / row.target * 100 : null, 'operations.received': row.received, 'operations.distributed': row.distributed, 'operations.distributionRate': row.distributed !== null && row.received > 0 ? row.distributed / row.received * 100 : null }
  return values[kpi.source] ?? null
}
export function submissionValues(kpis, values, period) {
  const allowed = new Set(kpis.map(kpi => kpi.code))
  if (Object.keys(values || {}).some(code => !allowed.has(code))) throw new Error('A value does not belong to the activated KPI set.')
  return Object.fromEntries(kpis.map(kpi => [kpi.code, kpi.source && kpi.source !== 'manual' ? automaticKpiValue(kpi, period) ?? '' : values?.[kpi.code] ?? '']))
}
