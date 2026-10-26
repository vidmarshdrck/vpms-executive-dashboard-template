// Payment-buffer projection for Finances.
// Incomes total counts inbound rows whose verification status is verified.
// Unclaimed and claimed-not-verified stay pending. Outbound rows never keep a claim status.
// Investments are summed only when a row arrives; this module does not invent any.

const BUCKETS = new Set(['income', 'expense', 'investment'])

export function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function normaliseEntry(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const bucket = row.ledger_bucket || row.bucket || row.kind
  if (!BUCKETS.has(bucket)) return null
  const direction = row.direction === 'inbound' || row.direction === 'outbound'
    ? row.direction
    : bucket === 'expense' ? 'outbound' : 'inbound'
  const outbound = direction === 'outbound'
  const verification = outbound ? null : (row.verification_status ?? row.claim_status ?? null)
  const amount = money(row.amount_zmw ?? row.amount)
  if (!(amount > 0)) return null
  const transaction = row.transaction_id ?? row.source_tid ?? null
  return {
    id: String(row.id || transaction || ''),
    bucket,
    ledger_bucket: bucket,
    direction,
    amount_zmw: amount,
    occurred_at: row.occurred_at ?? null,
    counterparty: row.counterparty ?? null,
    network: row.network ?? null,
    transaction_id: transaction,
    category: row.category ?? null,
    claim_status: outbound ? null : verification,
    verification_status: outbound ? null : verification,
    business_id: row.business_id ?? null,
    scope: row.scope ?? null,
    ingest: row.ingest ?? null,
    source: row.source ?? null,
    source_ref: row.source_ref ?? null,
    description: row.description ?? null,
  }
}

export function countsAsVerifiedIncome(row) {
  return !!row && row.bucket === 'income' && row.direction !== 'outbound' && row.verification_status === 'verified'
}

export function isPendingCandidate(row) {
  return !!row && row.bucket === 'income' && row.direction === 'inbound' && row.verification_status !== 'verified'
}

function inRange(row, from, to) {
  const time = Date.parse(row.occurred_at)
  if (!Number.isFinite(time)) return !from && !to
  if (from && time < Date.parse(from)) return false
  if (to && time > Date.parse(to)) return false
  return true
}

function matches(row, query) {
  if (query.scope && query.scope !== 'all' && row.scope !== query.scope) return false
  if (query.business_id && row.business_id !== query.business_id) return false
  if (!inRange(row, query.from, query.to)) return false
  return true
}

export function paginate(rows, query = {}) {
  const sorted = [...rows].sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)) || String(b.id).localeCompare(String(a.id)))
  const limit = query.limit ?? 100
  let start = 0
  if (query.cursor) {
    const index = sorted.findIndex((row) => row.id === query.cursor)
    start = index >= 0 ? index + 1 : sorted.length
  }
  const page = sorted.slice(start, start + limit)
  const next = start + limit < sorted.length ? page.at(-1)?.id ?? null : null
  return { entries: page, next_cursor: next }
}

function freshnessOf(raw) {
  return raw?.freshness || { buffer_updated_at: null, momo_csv_mtime: null, airtel_csv_mtime: null }
}

export function project(raw = {}, query = {}) {
  const sourceRows = Array.isArray(raw.entries) ? raw.entries : []
  const entries = []
  let unclassified = 0
  for (const row of sourceRows) {
    const entry = normaliseEntry(row)
    if (!entry) unclassified += 1
    else entries.push(entry)
  }
  const filtered = entries.filter((row) => matches(row, query))
  const pending = filtered.filter(isPendingCandidate)
  const summary = {
    source: raw.source || 'payment_buffer+momo_airtel_csv',
    as_of: raw.as_of || null,
    currency: 'ZMW',
    totals: {
      incomes: money(filtered.filter(countsAsVerifiedIncome).reduce((sum, row) => sum + row.amount_zmw, 0)),
      expenses: money(filtered.filter((row) => row.bucket === 'expense').reduce((sum, row) => sum + row.amount_zmw, 0)),
      investments: money(filtered.filter((row) => row.bucket === 'investment').reduce((sum, row) => sum + row.amount_zmw, 0)),
    },
    pending: {
      incomes: money(pending.reduce((sum, row) => sum + row.amount_zmw, 0)),
      count: pending.length,
    },
    counts: {
      inbounds: filtered.filter((row) => row.direction === 'inbound').length,
      outflows: filtered.filter((row) => row.direction === 'outbound').length,
      unclassified,
    },
    freshness: freshnessOf(raw),
  }
  const listed = query.bucket && query.bucket !== 'all' ? filtered.filter((row) => row.bucket === query.bucket) : filtered
  return { summary, ...paginate(listed, query) }
}

function numericTotals(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const totals = value.totals && typeof value.totals === 'object' ? value.totals : value
  if (!['incomes', 'expenses', 'investments'].some((key) => key in totals)) return null
  return {
    incomes: money(totals.incomes),
    expenses: money(totals.expenses),
    investments: money(totals.investments),
  }
}

export function extractSummary(body) {
  const parsed = typeof body === 'string' ? safeJson(body) : body
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const totals = numericTotals(parsed)
  if (!totals) return null
  return parsed
}

export function extractRows(body) {
  const parsed = typeof body === 'string' ? safeJson(body) : body
  if (Array.isArray(parsed)) return parsed
  if (!parsed || typeof parsed !== 'object') return null
  for (const key of ['entries', 'rows', 'data']) if (Array.isArray(parsed[key])) return parsed[key]
  if (parsed.ledger_bucket || parsed.bucket || parsed.kind) return [parsed]
  return null
}

function safeJson(text) {
  try { return JSON.parse(text) } catch { return null }
}

function summaryFromAggregate(summary) {
  const totals = numericTotals(summary)
  return {
    summary: {
      source: summary.source || 'payment_buffer',
      as_of: summary.as_of || null,
      currency: summary.currency || 'ZMW',
      totals,
      pending: summary.pending || { incomes: 0, count: 0 },
      counts: summary.counts || { inbounds: 0, outflows: 0, unclassified: 0 },
      freshness: freshnessOf(summary),
    },
    entries: [],
    next_cursor: null,
  }
}

// Rows carry the line items. Totals are recomputed so only verified inbound
// income is counted, even when an aggregate blob is also present.
// An aggregate with no rows (the live buffer is empty today) is kept as returned.
export function adaptRpc(summaryBody, entriesBody, query = {}) {
  const summary = extractSummary(summaryBody)
  const rows = extractRows(entriesBody)
  if (rows && rows.length) {
    return project({
      entries: rows,
      as_of: summary?.as_of,
      source: summary?.source || 'payment_buffer',
      freshness: summary?.freshness,
    }, query)
  }
  if (summary) return summaryFromAggregate(summary)
  if (rows) return project({ entries: [], as_of: null, source: 'payment_buffer' }, query)
  return null
}
