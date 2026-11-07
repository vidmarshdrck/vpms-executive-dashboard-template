export const BLUE_PALETTE = ['#0A2F66', '#5B93D6', '#1454c0', '#8FB4E3', '#1E4E8C', '#3D7AD6', '#0E4197', '#2563B0']
export const STATUS_COLORS = { Paid: '#15803D', Pending: '#A16207', Overdue: '#B91C1C' }

export const BUSINESS_SEED = [
  { id: 've', name: 'Vidmar Entertainment (VE)', code: 'VE', active: true },
  { id: 'vai', name: 'Vidmar AI (VAI)', code: 'VAI', active: true },
  { id: 'rez', name: 'Real Estate Zambia (REZ)', code: 'REZ', active: true },
  { id: 'bsg', name: 'BSG Trades', code: 'BSG', active: true },
  { id: 'vt', name: 'Vidmar Transport (VT)', code: 'VT', active: true },
  { id: 'eunique', name: 'Eunique Apparel', code: 'Eunique', active: true },
  { id: 'digital', name: 'Digital Products (Daniel)', code: 'Digital', active: true },
]

export function emptyBooks() {
  return { version: 1, businesses: BUSINESS_SEED.map((business) => ({ ...business })), entries: [] }
}

export function parseBooks(raw) {
  const base = emptyBooks()
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1 || !Array.isArray(parsed.businesses) || !Array.isArray(parsed.entries)) return base
    const saved = new Map(parsed.businesses.map((business) => [business.id, business]))
    const businesses = BUSINESS_SEED.map((seed) => ({ ...seed, active: saved.get(seed.id)?.active !== false }))
    for (const business of parsed.businesses) {
      if (!BUSINESS_SEED.some((seed) => seed.id === business.id) && business.id && business.name) {
        businesses.push({ id: String(business.id), name: String(business.name), code: String(business.code || business.name), active: business.active !== false })
      }
    }
    const ids = new Set(businesses.map((business) => business.id))
    const entries = parsed.entries.filter((entry) => entry && ids.has(entry.businessId) && ['expense', 'income', 'count'].includes(entry.kind) && typeof entry.title === 'string' && Number(entry.amount) > 0)
    return { version: 1, businesses, entries }
  } catch {
    return base
  }
}

export function activeBusinesses(books) {
  return books.businesses.filter((business) => business.active)
}

export function setBusinessActive(books, id, active) {
  return { ...books, businesses: books.businesses.map((business) => business.id === id ? { ...business, active } : business) }
}

export function entriesFor(books, businessId, kind) {
  return books.entries.filter((entry) => entry.businessId === businessId && entry.kind === kind)
}

export function addEntry(books, input) {
  const kind = input.kind
  if (!['expense', 'income', 'count'].includes(kind)) throw new Error('Unknown record type.')
  const business = books.businesses.find((item) => item.id === input.businessId && item.active)
  if (!business) throw new Error('Select an active business.')
  const title = String(input.title || '').trim()
  if (!title) throw new Error(kind === 'count' ? 'Enter an item.' : 'Enter a description.')
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(kind === 'count' ? 'Enter a count greater than zero.' : 'Enter an amount greater than zero.')
  const group = String(input.group || '').trim()
  if (kind !== 'count' && !group) throw new Error(kind === 'expense' ? 'Enter a category.' : 'Enter a source.')
  const entry = {
    id: crypto.randomUUID(),
    businessId: business.id,
    kind,
    title,
    group,
    amount,
    unit: kind === 'count' ? (String(input.unit || '').trim() || 'count') : 'ZMW',
    status: kind === 'count' ? null : (['Paid', 'Pending', 'Overdue'].includes(input.status) ? input.status : 'Pending'),
    date: String(input.date || ''),
  }
  return { ...books, entries: [...books.entries, entry] }
}

export function removeEntry(books, id) {
  return { ...books, entries: books.entries.filter((entry) => entry.id !== id) }
}

export function moneyTotal(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount), 0)
}

export function formatZmw(amount) {
  return `ZMW ${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function slicesBy(entries, key) {
  const totals = new Map()
  for (const entry of entries) totals.set(entry[key] || 'Unspecified', (totals.get(entry[key] || 'Unspecified') || 0) + Number(entry.amount))
  return [...totals.entries()].filter(([, value]) => value > 0).map(([name, value], index) => ({ name, value, color: BLUE_PALETTE[index % BLUE_PALETTE.length] }))
}

export function statusSlices(entries) {
  const totals = new Map()
  for (const entry of entries) {
    if (!STATUS_COLORS[entry.status]) continue
    totals.set(entry.status, (totals.get(entry.status) || 0) + Number(entry.amount))
  }
  return ['Paid', 'Pending', 'Overdue'].filter((status) => totals.get(status) > 0).map((status) => ({ name: status, value: totals.get(status), color: STATUS_COLORS[status] }))
}

export function sharedUnit(entries) {
  const units = [...new Set(entries.map((entry) => entry.unit))]
  return units.length === 1 ? units[0] : null
}

export function countTotals(entries) {
  const totals = new Map()
  for (const entry of entries) totals.set(entry.unit, (totals.get(entry.unit) || 0) + Number(entry.amount))
  return [...totals.entries()]
}
