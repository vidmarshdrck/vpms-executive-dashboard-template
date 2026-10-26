import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createFinanceRpc, createFinancesHandler } from './finances.js'
import { runtimeHandler } from './start.js'

const auth = async (header) => header === 'Bearer owner' ? { id: 'owner', token: 'owner-token' } : null

async function withHandler(handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return { base, close: () => new Promise((resolve) => server.close(resolve)) }
}

test('owner read returns Rhoda rental income, verified total, and empty investments', async () => {
  const { base, close } = await withHandler(createFinancesHandler({ authenticate: auth }))
  try {
    assert.equal((await fetch(`${base}/api/finances/summary`)).status, 401)
    const summaryRes = await fetch(`${base}/api/finances/summary`, { headers: { authorization: 'Bearer owner' } })
    const summary = await summaryRes.json()
    assert.equal(summaryRes.status, 200)
    assert.equal(summary.totals.incomes, 3650)
    assert.equal(summary.verified_income, 1500)
    assert.equal(summary.pending.incomes, 650)
    assert.equal(summary.totals.expenses, 0)
    assert.equal(summary.totals.investments, 0)
    const entries = await (await fetch(`${base}/api/finances/entries?bucket=income`, { headers: { authorization: 'Bearer owner' } })).json()
    const cashOut = entries.entries.find((row) => row.transaction_id === '10900844301')
    assert.equal(cashOut.bucket, 'income')
    assert.equal(cashOut.category, 'rental_income')
    assert.equal(cashOut.direction, 'outbound')
    assert.equal(cashOut.claim_status, null)
    assert.equal((await (await fetch(`${base}/api/finances/entries?bucket=expense`, { headers: { authorization: 'Bearer owner' } })).json()).entries.length, 0)
    assert.equal((await (await fetch(`${base}/api/finances/entries?bucket=investment`, { headers: { authorization: 'Bearer owner' } })).json()).entries.length, 0)
    const body = JSON.stringify(entries)
    assert.equal(body.includes('subscription_payment'), false)
    assert.equal(body.includes('raw_sms'), false)
    assert.equal(body.includes('_comment'), false)
    assert.equal((await fetch(`${base}/api/finances/summary`, { method: 'POST', headers: { authorization: 'Bearer owner' } })).status, 405)
  } finally { await close() }
})

test('manual income does not count as verified; manual expense does count', async () => {
  const { base, close } = await withHandler(createFinancesHandler({ authenticate: auth, forceFixture: true }))
  try {
    const headers = { authorization: 'Bearer owner', 'content-type': 'application/json' }
    const income = await fetch(`${base}/api/finances`, { method: 'POST', headers, body: JSON.stringify({ kind: 'income', amount_zmw: 40, occurred_at: '2026-10-02T00:00:00Z', counterparty: 'Desk', description: 'Note' }) })
    assert.equal(income.status, 201)
    assert.equal((await income.json()).entry.verification_status, null)
    const expense = await fetch(`${base}/api/finances`, { method: 'POST', headers, body: JSON.stringify({ kind: 'expense', amount_zmw: 15, occurred_at: '2026-10-02T00:00:00Z', counterparty: 'Stationery', description: 'Books' }) })
    assert.equal(expense.status, 201)
    assert.equal((await fetch(`${base}/api/finances`, { method: 'POST', headers, body: JSON.stringify({ kind: 'investment', amount_zmw: 5, occurred_at: '2026-10-02T00:00:00Z', counterparty: 'Fund', description: 'No' }) })).status, 400)
    const summary = await (await fetch(`${base}/api/finances/summary`, { headers })).json()
    assert.equal(summary.totals.incomes, 3690)
    assert.equal(summary.verified_income, 1500)
    assert.equal(summary.totals.expenses, 15)
    assert.equal(summary.totals.investments, 0)
  } finally { await close() }
})

test('a live empty RPC is not replaced by the Rhoda rows', async () => {
  const rpc = {
    async summary() { return { ok: true, body: { totals: { incomes: 0, expenses: 0, investments: 0 }, currency: 'ZMW' } } },
    async entries() { return { ok: true, body: [] } },
  }
  const { base, close } = await withHandler(createFinancesHandler({ authenticate: auth, rpc }))
  try {
    const body = await (await fetch(`${base}/api/finances`, { headers: { authorization: 'Bearer owner' } })).json()
    assert.equal(body.totals.incomes, 0)
    assert.equal(body.totals.investments, 0)
    assert.equal(body.entries.length, 0)
    assert.equal(JSON.stringify(body).includes('10900844301'), false)
    assert.equal((await fetch(`${base}/api/finances`, { method: 'POST', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: '{}' })).status, 405)
  } finally { await close() }
})

test('RPC failure falls back to rental-income rows', async () => {
  const rpc = { async summary() { return { ok: false, status: 503 } }, async entries() { throw new Error('down') } }
  const { base, close } = await withHandler(createFinancesHandler({ authenticate: auth, rpc }))
  try {
    const body = await (await fetch(`${base}/api/finances/entries?bucket=income`, { headers: { authorization: 'Bearer owner' } })).json()
    assert.ok(body.entries.some((row) => row.transaction_id === '10900844301' && row.category === 'rental_income' && row.bucket === 'income'))
  } finally { await close() }
})

test('finance RPC retries the finance schema then accepts the owner call', async () => {
  const seen = []
  const fetchImpl = async (url, options) => {
    seen.push({ url, profile: options.headers['content-profile'] || null, authorization: options.headers.authorization })
    if (options.headers['content-profile'] === 'finance') return { ok: false, status: 406, text: async () => '' }
    return { ok: true, status: 200, text: async () => JSON.stringify({ totals: { incomes: 0, expenses: 0, investments: 0 } }) }
  }
  const rpc = createFinanceRpc({ url: 'https://bbpfkjucsabdfcmusqzu.supabase.co', publishableKey: 'pub', serviceKey: 'service', fetchImpl })
  const result = await rpc.summary('owner-token', { scope: 'all', limit: 100 })
  assert.equal(result.ok, true)
  assert.equal(result.body.totals.investments, 0)
  assert.ok(seen.some((call) => call.url.endsWith('/rest/v1/rpc/vhpms_finances_summary')))
  assert.equal(seen[0].profile, 'finance')
  assert.equal(seen.at(-1).authorization, 'Bearer owner-token')
})

test('runtime finances route fails closed without owner credentials', async () => {
  const server = createServer(runtimeHandler({}))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/finances/summary`, { headers: { authorization: 'Bearer owner' } })
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error, 'prerequisites_missing')
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
