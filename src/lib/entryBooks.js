import { validateAttachments } from './attachments.js'

// Browser-local demo records. Keep approval and aggregation here so the UI
// can later use an API without changing the reporting rules.
const KEY = 'vpms-entry-books-v1'
const EVENT = 'vpms:entry-books-changed'
export const BOOK_FIELDS = {
  finance: [{ key: 'revenue', label: 'Revenue actual (ZMW)' }, { key: 'target', label: 'Revenue target (ZMW)' }, { key: 'expenditure', label: 'Operating expenditure (ZMW)' }],
  operations: [{ key: 'received', label: 'Product received (m³)' }, { key: 'distributed', label: 'Product distributed (m³)' }],
}
export const BOOK_NAMES = { finance: 'Finance revenue book', operations: 'Operations stock book' }
export const PRODUCTS = ['LSG', 'PMS']
export function readBooks() {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { entries: [], published: {} }
  try { const value = JSON.parse(raw); if (!Array.isArray(value.entries) || !value.published) throw new Error(); return value }
  catch { throw new Error('Entry books could not be read. Restore the saved browser data before editing.') }
}
function writeBooks(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)) }
  catch { throw new Error('The entry could not be saved. Free some browser storage and try again.') }
  window.dispatchEvent(new Event(EVENT))
}
export function subscribeToBooks(callback) {
  const storage = (event) => { if (!event.key || event.key === KEY) callback() }
  window.addEventListener(EVENT, callback); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', storage) }
}
function requireOwner(user, departmentId) {
  if (!user || user.role !== 'Dept Head' || user.departmentId !== departmentId || !BOOK_FIELDS[departmentId]) throw new Error('Only this department’s head can enter or revise this book.')
}
function requireGM(user) { if (user?.role !== 'GM') throw new Error('Only the GM can review entry books.') }
function actor(user) { return { id: user.id, name: user.name, role: user.role } }
function record(entry, user, action, comment = '') {
  entry.history = [...(entry.history || []), { at: new Date().toISOString(), by: actor(user), action, comment }]
}
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value }
function prepareBookEntry(user, form, submit, store) {
  const departmentId = user?.departmentId
  requireOwner(user, departmentId)
  if (!['weekly', 'daily'].includes(form.frequency)) throw new Error('Choose daily or weekly reporting.')
  if (!validDate(form.start) || !validDate(form.end) || form.end < form.start) throw new Error('Choose a valid start and end date.')
  const days = (Date.parse(form.end) - Date.parse(form.start)) / 86400000
  if (form.start.slice(0, 7) !== form.end.slice(0, 7) || days > 6 || (form.frequency === 'daily' && days !== 0)) throw new Error('Use one day, or up to seven days within the same month. Split weeks at month end.')
  if (departmentId === 'operations' && !PRODUCTS.includes(form.product)) throw new Error('Choose the product being reported.')
  const values = {}
  for (const field of BOOK_FIELDS[departmentId]) {
    const raw = form.values?.[field.key]
    if (raw === '' || raw === null || raw === undefined || !Number.isFinite(Number(raw)) || Number(raw) < 0) throw new Error(`Enter a non-negative number for ${field.label}.`)
    values[field.key] = Number(raw)
  }
  const previous = form.id ? store.entries.find((entry) => entry.id === form.id) : null
  if (form.id && !previous) throw new Error('Entry not found.')
  if (previous) {
    requireOwner(user, previous.departmentId)
    if (previous.status === 'SUBMITTED') throw new Error('This entry is awaiting review and cannot be edited.')
    if (store.published[previous.id] && (previous.start !== form.start || previous.end !== form.end || previous.product !== (departmentId === 'operations' ? form.product : null))) throw new Error('Keep the approved reporting dates and product when correcting figures.')
  }
  const product = departmentId === 'operations' ? form.product : null
  if (store.entries.some((entry) => entry.id !== previous?.id && entry.departmentId === departmentId && entry.product === product && entry.start <= form.end && entry.end >= form.start)) throw new Error('This period overlaps an existing entry. Edit that entry to avoid counting the same figures twice.')
  const entry = { ...previous, id: previous?.id || crypto.randomUUID(), departmentId, frequency: form.frequency, start: form.start, end: form.end, product, values, attachments: validateAttachments(form.attachments === undefined ? previous?.attachments || [] : form.attachments), notes: String(form.notes || '').trim().slice(0, 1000), status: submit ? 'SUBMITTED' : 'DRAFT', createdBy: previous?.createdBy || actor(user), createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
  record(entry, user, submit ? 'Submitted for review' : 'Draft saved')
  if (previous) store.entries[store.entries.findIndex((item) => item.id === previous.id)] = entry
  else store.entries.push(entry)
  return structuredClone(entry)
}
export function saveBookEntry(user, form, submit = false) {
  const store = readBooks()
  const entry = prepareBookEntry(user, form, submit, store)
  writeBooks(store)
  return entry
}
export function importBookEntries(user, forms) {
  if (!forms.length || forms.length > 200) throw new Error('Import between 1 and 200 entries at a time.')
  const store = readBooks()
  const entries = forms.map((form, index) => {
    try { return prepareBookEntry(user, form, false, store) }
    catch (error) { throw new Error(`Entry ${index + 1}: ${error.message}`) }
  })
  writeBooks(store)
  return entries
}
export function reviewBookEntry(user, id, approve, comment = '') {
  requireGM(user)
  const store = readBooks()
  const entry = store.entries.find((item) => item.id === id)
  if (!entry || entry.status !== 'SUBMITTED') throw new Error('Select an entry awaiting review.')
  if (!approve && !comment.trim()) throw new Error('Explain what needs changing before returning this entry.')
  entry.status = approve ? 'APPROVED' : 'RETURNED'
  entry.reviewComment = comment.trim()
  entry.updatedAt = new Date().toISOString()
  record(entry, user, approve ? 'Approved and published' : 'Returned for revision', comment.trim())
  if (approve) store.published[id] = structuredClone(entry)
  writeBooks(store)
}
export function bookReport(store, year, monthIndices = null) {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: new Date(2000, index, 1).toLocaleString('en', { month: 'short' }), revenue: null, estimated: null, expenditure: null, received: null, distributed: null }))
  let financeCount = 0, operationsCount = 0
  for (const entry of Object.values(store.published)) {
    if (Number(entry.start.slice(0, 4)) !== Number(year)) continue
    const index = Number(entry.start.slice(5, 7)) - 1
    if (monthIndices && !monthIndices.includes(index)) continue
    const month = months[index]
    for (const [key, value] of Object.entries(entry.values)) {
      const field = key === 'target' ? 'estimated' : key
      month[field] = (month[field] ?? 0) + value
    }
    if (entry.departmentId === 'finance') financeCount++
    else if (entry.departmentId === 'operations') operationsCount++
  }
  const quarters = Array.from({ length: 4 }, (_, index) => {
    const rows = months.slice(index * 3, index * 3 + 3)
    const sum = (key) => rows.every((row) => row[key] === null) ? null : rows.reduce((total, row) => total + (row[key] || 0), 0)
    return { quarter: `Q${index + 1}`, actual: sum('revenue'), target: sum('estimated'), expenditure: sum('expenditure'), received: sum('received'), distributed: sum('distributed'), isDemo: false }
  })
  return { months, quarters, financeCount, operationsCount }
}
