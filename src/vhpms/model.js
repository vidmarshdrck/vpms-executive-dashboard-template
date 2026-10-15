export const STORAGE_KEY = 'vhpms-local-v1'
export const emptyState = () => ({ version: 1, tasks: [], projects: [], ledger: [], notes: {} })
export function parseState(raw) {
  try {
    const s = JSON.parse(raw)
    if (s?.version !== 1 || !['tasks','projects','ledger'].every(k => Array.isArray(s[k])) || !s.notes || typeof s.notes !== 'object' || Array.isArray(s.notes)) return emptyState()
    if (![...s.tasks,...s.projects,...s.ledger].every(r => r && typeof r.id === 'string' && typeof r.title === 'string')) return emptyState()
    return s
  } catch { return emptyState() }
}
export function addRecord(state, kind, record) {
  const title = String(record.title || '').trim()
  if (!title) throw new Error('Enter a title before saving.')
  if (!['tasks','projects','ledger'].includes(kind)) throw new Error('Unknown record type.')
  if (kind === 'ledger' && (!Number.isFinite(Number(record.amount)) || Number(record.amount) <= 0)) throw new Error('Enter an amount greater than zero.')
  return { ...state, [kind]: [...state[kind], { ...record, title, ...(kind === 'ledger' ? { amount: Number(record.amount) } : {}), id: crypto.randomUUID(), done: false }] }
}
export function toggleTask(state, id) { return { ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) } }
export function totals(records, scope) {
  return records.filter(r => r.scope === scope).reduce((a,r) => {
    const key = ({Paid:'paid',Pending:'pending',Overdue:'overdue'})[r.status]
    if (key) a[key] += Number(r.amount) || 0
    return a
  },{paid:0,pending:0,overdue:0})
}
export function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
export function weekKey(date) { const d=new Date(date); d.setDate(d.getDate()-((d.getDay()+6)%7)); return localDate(d) }
