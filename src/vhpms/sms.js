import { BLUE_PALETTE, formatZmw } from './books.js'

export const SMS_LABELS_KEY = 'vhpms-sms-labels-v1'

export function clearPrivateSms(storage) {
  try { storage.removeItem(SMS_LABELS_KEY) } catch { /* private mode */ }
}
const SENDERS = ['MTN', 'Airtel', 'other']

export function emptyLabels() {
  return { version: 1, byId: {} }
}

export function parseLabels(raw) {
  try {
    const labels = JSON.parse(raw)
    if (labels?.version !== 1 || !labels.byId || typeof labels.byId !== 'object' || Array.isArray(labels.byId)) return emptyLabels()
    return labels
  } catch {
    return emptyLabels()
  }
}

export function normalizeTransaction(row) {
  if (!row || typeof row !== 'object' || !row.id) return null
  const receivedAt = String(row.received_at || row.receivedAt || '')
  const amount = Number(row.amount)
  const sender = SENDERS.includes(row.sender) ? row.sender : 'other'
  const direction = row.direction === 'out' ? 'out' : 'in'
  return {
    id: String(row.id),
    receivedAt,
    sender,
    transactionId: String(row.transaction_id || row.transactionId || ''),
    amount: Number.isFinite(amount) ? amount : 0,
    direction,
    counterparty: String(row.counterparty || ''),
    rawMessage: String(row.raw_message || row.rawMessage || ''),
    businessId: String(row.business_id || row.businessId || ''),
    purpose: String(row.purpose || ''),
  }
}

export function mergeLabels(rows, labels) {
  const byId = labels?.byId || {}
  return rows.map((row) => {
    const label = byId[row.id]
    if (!label) return row
    return { ...row, businessId: label.businessId || row.businessId, purpose: label.purpose || row.purpose }
  })
}

export function isUnlabelled(row) {
  return !String(row.businessId || '').trim() || !String(row.purpose || '').trim()
}

export function labelTransaction(labels, id, businessId, purpose) {
  const business = String(businessId || '').trim()
  const why = String(purpose || '').trim()
  if (!business || !why) throw new Error('Choose the business and enter what the transaction is for.')
  return { ...labels, byId: { ...labels.byId, [id]: { businessId: business, purpose: why } } }
}

export function inboxFromSms(rows, now = Date.now()) {
  return rows.filter(isUnlabelled).map((row) => ({
    id: `sms:${row.id}`,
    smsId: row.id,
    source: 'SMSGate',
    title: row.transactionId ? `Transaction ${row.transactionId}` : 'SMS transaction',
    detail: `${row.sender} · ${formatZmw(row.amount)} · ${row.direction === 'in' ? 'In' : 'Out'}${row.counterparty ? ` · ${row.counterparty}` : ''}`,
    age: formatAge(row.receivedAt, now),
  }))
}

export function formatAge(receivedAt, now = Date.now()) {
  const then = Date.parse(receivedAt)
  if (!Number.isFinite(then)) return 'Unknown age'
  const minutes = Math.max(0, Math.round((now - then) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.round(hours / 24)} d`
}

export function filterTransactions(rows, { business = '', labelStatus = 'all', from = '', to = '' } = {}) {
  return rows.filter((row) => {
    if (business && row.businessId !== business) return false
    if (labelStatus === 'labelled' && isUnlabelled(row)) return false
    if (labelStatus === 'unlabelled' && !isUnlabelled(row)) return false
    const day = String(row.receivedAt || '').slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  })
}

export function amountSlices(rows, key) {
  const totals = new Map()
  for (const row of rows) {
    const name = String(row[key] || '').trim()
    if (!name || !Number.isFinite(row.amount)) continue
    totals.set(name, (totals.get(name) || 0) + row.amount)
  }
  return [...totals.entries()].filter(([, value]) => value > 0).map(([name, value], index) => ({
    name, value, color: BLUE_PALETTE[index % BLUE_PALETTE.length],
  }))
}
