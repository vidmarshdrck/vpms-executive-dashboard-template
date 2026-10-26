import { readFileSync } from 'node:fs'
import { ApiError } from './task-api.js'
import { adaptRpc, extractRows, extractSummary, normaliseEntry, project } from '../src/vhpms/finances/classify.js'

const SCOPES = new Set(['personal', 'business', 'all'])
const BUCKETS = new Set(['income', 'expense', 'investment', 'all'])

export function readFilters(url) {
  const scope = url.searchParams.get('scope') || 'all'
  if (!SCOPES.has(scope)) throw new ApiError(400, 'invalid_scope')
  const bucket = url.searchParams.get('bucket') || 'all'
  if (!BUCKETS.has(bucket)) throw new ApiError(400, 'invalid_bucket')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from && !Number.isFinite(Date.parse(from))) throw new ApiError(400, 'invalid_from')
  if (to && !Number.isFinite(Date.parse(to))) throw new ApiError(400, 'invalid_to')
  const business = url.searchParams.get('business_id')
  if (business && !/^[a-zA-Z0-9_-]{1,128}$/.test(business)) throw new ApiError(400, 'invalid_business')
  let limit = 100
  if (url.searchParams.has('limit')) {
    limit = Number(url.searchParams.get('limit'))
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, 'invalid_limit')
  }
  const cursor = url.searchParams.get('cursor')
  if (cursor && !/^[a-zA-Z0-9_.:-]{1,128}$/.test(cursor)) throw new ApiError(400, 'invalid_cursor')
  return { scope, bucket, from, to, business_id: business || null, limit, cursor: cursor || null }
}

function argLadder(filters, kind) {
  const range = { p_from: filters.from ?? null, p_to: filters.to ?? null }
  const scoped = { ...range, p_scope: filters.scope || 'all' }
  const full = { ...scoped }
  if (filters.business_id) full.p_business_id = filters.business_id
  if (kind === 'entries') {
    full.p_limit = filters.limit
    if (filters.bucket && filters.bucket !== 'all') full.p_bucket = filters.bucket
    if (filters.cursor) full.p_cursor = filters.cursor
  }
  return [full, scoped, range, {}]
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

export function createFinanceRpc({ url, publishableKey, serviceKey, fetchImpl = globalThis.fetch } = {}) {
  const cache = new Map()
  async function call(name, token, filters) {
    if (!url || !publishableKey || !token) return { ok: false, status: 0 }
    const kind = name.endsWith('entries') ? 'entries' : 'summary'
    const ladder = argLadder(filters, kind)
    const profiles = ['finance', null]
    const modes = serviceKey ? ['user', 'service'] : ['user']
    const cached = cache.get(name)
    const plans = cached
      ? [{ profile: cached.profile, mode: cached.mode, index: cached.index, args: ladder[cached.index] || {} }]
      : profiles.flatMap((profile) => modes.flatMap((mode) => ladder.map((args, index) => ({ profile, mode, index, args }))))
    let last = { ok: false, status: 0 }
    for (const plan of plans) {
      const headers = {
        accept: 'application/json',
        'content-type': 'application/json',
        apikey: plan.mode === 'service' ? serviceKey : publishableKey,
        authorization: plan.mode === 'service' ? `Bearer ${serviceKey}` : `Bearer ${token}`,
      }
      if (plan.profile) {
        headers['content-profile'] = plan.profile
        headers['accept-profile'] = plan.profile
      }
      let response
      try {
        response = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(plan.args),
          signal: AbortSignal.timeout(10000),
        })
      } catch {
        return { ok: false, status: 0 }
      }
      if (response.ok) {
        cache.set(name, { profile: plan.profile, mode: plan.mode, index: plan.index })
        return { ok: true, body: await readJson(response) }
      }
      last = { ok: false, status: response.status }
      await response.text().catch(() => {})
      if (response.status >= 500) break
    }
    if (cached) cache.delete(name)
    return last
  }
  return {
    summary: (token, filters) => call('vhpms_finances_summary', token, filters),
    entries: (token, filters) => call('vhpms_finances_entries', token, filters),
  }
}

function loadFixture(fixturePath) {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8'))
  return {
    source: raw.source,
    as_of: raw.as_of,
    freshness: raw.freshness,
    entries: Array.isArray(raw.entries) ? raw.entries.map((row) => ({ ...row })) : [],
  }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 16384) throw new ApiError(413, 'body_too_large')
    chunks.push(chunk)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw new ApiError(400, 'invalid_json') }
}

function manualEntry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'invalid_body')
  if ('raw_sms' in body || 'phone' in body || 'msisdn' in body) throw new ApiError(400, 'invalid_field')
  if (body.kind === 'investment') throw new ApiError(400, 'investments_deferred')
  if (body.kind !== 'income' && body.kind !== 'expense') throw new ApiError(400, 'invalid_kind')
  const amount = Number(body.amount_zmw)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new ApiError(400, 'invalid_amount')
  if (typeof body.occurred_at !== 'string' || !Number.isFinite(Date.parse(body.occurred_at))) throw new ApiError(400, 'invalid_occurred_at')
  const counterparty = String(body.counterparty || '').trim()
  const description = String(body.description || '').trim()
  if (!counterparty || counterparty.length > 180 || description.length > 180) throw new ApiError(400, 'invalid_field')
  const scope = body.scope || 'personal'
  if (scope !== 'personal' && scope !== 'business') throw new ApiError(400, 'invalid_scope')
  const transaction = body.transaction_id || body.source_tid || null
  if (transaction != null && (typeof transaction !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(transaction))) throw new ApiError(400, 'invalid_transaction')
  return normaliseEntry({
    id: `manual-${crypto.randomUUID()}`,
    ledger_bucket: body.kind,
    direction: body.kind === 'expense' ? 'outbound' : 'inbound',
    amount_zmw: amount,
    occurred_at: new Date(body.occurred_at).toISOString(),
    counterparty,
    description,
    transaction_id: transaction,
    category: body.kind === 'income' ? (body.category || null) : (body.category || null),
    claim_status: null,
    verification_status: null,
    business_id: null,
    scope,
    ingest: 'manual',
    source: 'manual',
    source_ref: null,
    network: null,
  })
}

async function liveView(rpc, token, filters) {
  if (!token) throw new ApiError(503, 'finances_unavailable')
  let summary
  let entries
  try {
    ;[summary, entries] = await Promise.all([
      rpc.summary(token, filters),
      rpc.entries(token, filters),
    ])
  } catch {
    throw new ApiError(503, 'finances_unavailable')
  }
  if (!summary?.ok || !entries?.ok) throw new ApiError(503, 'finances_unavailable')
  if (!extractSummary(summary.body) || extractRows(entries.body) == null) throw new ApiError(503, 'finances_unavailable')
  const view = adaptRpc(summary.body, entries.body, filters)
  if (!view) throw new ApiError(503, 'finances_unavailable')
  return view
}

export function createFinancesHandler({ authenticate, rpc = null, forceFixture = false, fixturePath = new URL('./fixtures/finances.json', import.meta.url) } = {}) {
  const manual = []
  const base = () => {
    const raw = loadFixture(fixturePath)
    raw.entries = [...raw.entries, ...manual]
    return raw
  }
  return async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
      res.end(JSON.stringify(body))
    }
    try {
      const actor = await authenticate(req.headers.authorization)
      if (!actor) throw new ApiError(401, 'unauthorized')
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname.replace(/\/+$/, '')
      if (!['/api/finances', '/api/finances/summary', '/api/finances/entries'].includes(path)) throw new ApiError(404, 'not_found')
      if (!['GET', 'POST'].includes(req.method)) throw new ApiError(405, 'method_not_allowed')
      if (req.method === 'POST' && path !== '/api/finances') throw new ApiError(405, 'method_not_allowed')
      const filters = readFilters(url)
      const listFilters = path === '/api/finances/summary' ? { ...filters, bucket: 'all' } : filters
      const fixtureMode = forceFixture || !rpc
      if (req.method === 'POST') {
        if (!fixtureMode) throw new ApiError(405, 'manual_unavailable')
        const entry = manualEntry(await readBody(req))
        if (!entry) throw new ApiError(400, 'invalid_body')
        const existing = project(base(), { scope: 'all', limit: 100 }).entries
        if (entry.transaction_id && existing.some((row) => row.transaction_id === entry.transaction_id)) throw new ApiError(409, 'duplicate_transaction')
        manual.push(entry)
        return send(201, { entry })
      }
      const view = fixtureMode ? project(base(), listFilters) : await liveView(rpc, actor.token, listFilters)
      if (path === '/api/finances/summary') return send(200, view.summary)
      if (path === '/api/finances/entries') return send(200, { entries: view.entries, next_cursor: view.next_cursor })
      return send(200, { ...view.summary, entries: view.entries, next_cursor: view.next_cursor })
    } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError(503, 'finances_unavailable')
      send(safe.status, { error: safe.code })
    }
  }
}
