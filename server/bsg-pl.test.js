import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createBsgPlHandler, createBsgPlRpc, readPlQuery } from './bsg-pl.js'
import { bsgPlConfig } from '../src/vhpms/bsg/plConfig.js'
import { aggregatePlCalendar } from '../src/vhpms/bsg/plCalendar.js'
import { runtimeHandler } from './start.js'

const sample = aggregatePlCalendar([], { month: '2026-10', mode: 'PAPER', riskUsdPerR: bsgPlConfig.riskUsdPerR })
const owner = async (header) => header === 'Bearer owner-jwt' ? { id: 'owner', token: 'owner-jwt' } : null

async function listen(handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}

test('calendar route fails closed when the RPC is missing or errors', async () => {
  let calls = 0
  const down = createBsgPlHandler({
    authenticate: owner,
    rpc: { calendar: async () => { calls += 1; return { ok: false, status: 404 } } },
  })
  const missing = createBsgPlHandler({ authenticate: owner, rpc: null })
  const thrown = createBsgPlHandler({
    authenticate: owner,
    rpc: { calendar: async () => { throw new Error('socket') } },
  })
  const servers = []
  try {
    for (const handler of [down, missing, thrown]) servers.push(await listen(handler))
    const [downRes, missingRes, thrownRes] = await Promise.all(servers.map(({ url }) => fetch(`${url}/api/bsg/pl-calendar?month=2026-10&mode=PAPER`, { headers: { authorization: 'Bearer owner-jwt' } })))
    for (const response of [downRes, missingRes, thrownRes]) {
      assert.equal(response.status, 503)
      const body = await response.json()
      assert.deepEqual(body, { error: 'bsg_pl_unavailable' })
      assert.equal(JSON.stringify(body).includes('42.56'), false)
      assert.equal(Object.hasOwn(body, 'days'), false)
    }
    assert.equal(calls, 1)
    const unauth = await fetch(`${servers[0].url}/api/bsg/pl-calendar`, { headers: { authorization: 'Bearer someone' } })
    assert.equal(unauth.status, 401)
    assert.equal((await fetch(`${servers[0].url}/api/bsg/pl-calendar`, { method: 'POST', headers: { authorization: 'Bearer owner-jwt' } })).status, 405)
    assert.equal((await fetch(`${servers[0].url}/api/bsg/pl-calendar?month=2026-13`, { headers: { authorization: 'Bearer owner-jwt' } })).status, 400)
    assert.equal((await fetch(`${servers[0].url}/api/bsg/pl-calendar?mode=live`, { headers: { authorization: 'Bearer owner-jwt' } })).status, 400)
    const shaped = createBsgPlHandler({ authenticate: owner, rpc: { calendar: async () => ({ ok: true, body: { error: 'nope' } }) } })
    const bad = await listen(shaped)
    servers.push(bad)
    const badRes = await fetch(`${bad.url}/api/bsg/pl-calendar`, { headers: { authorization: 'Bearer owner-jwt' } })
    assert.equal(badRes.status, 503)
  } finally {
    await Promise.all(servers.map(({ server }) => new Promise((resolve) => server.close(resolve))))
  }
})

test('a live read posts the owner JWT and the configured risk, with no service role', async () => {
  let captured
  const rpc = createBsgPlRpc({
    url: 'https://bbpfkjucsabdfcmusqzu.supabase.co',
    publishableKey: 'publishable-key',
    riskUsdPerR: bsgPlConfig.riskUsdPerR,
    fetchImpl: async (url, init) => {
      captured = { url, init }
      return new Response(JSON.stringify(sample), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  const { server, url } = await listen(createBsgPlHandler({ authenticate: owner, rpc }))
  try {
    const response = await fetch(`${url}/api/bsg/pl-calendar?month=2026-10&mode=DEMO`, { headers: { authorization: 'Bearer owner-jwt' } })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).month, '2026-10')
    assert.equal(captured.url, 'https://bbpfkjucsabdfcmusqzu.supabase.co/rest/v1/rpc/vhpms_bsg_pl_calendar')
    assert.equal(captured.init.headers.authorization, 'Bearer owner-jwt')
    assert.equal(captured.init.headers.apikey, 'publishable-key')
    assert.equal(captured.init.headers['content-profile'], 'boaz')
    assert.equal(captured.init.headers['accept-profile'], 'boaz')
    assert.equal(JSON.stringify(captured.init.headers).includes('service'), false)
    assert.deepEqual(JSON.parse(captured.init.body), { p_month: '2026-10-01', p_mode: 'DEMO', p_risk_usd: 1 })
  } finally { await new Promise((resolve) => server.close(resolve)) }
  const failed = await createBsgPlRpc({
    url: 'https://bbpfkjucsabdfcmusqzu.supabase.co', publishableKey: 'publishable-key', riskUsdPerR: bsgPlConfig.riskUsdPerR,
    fetchImpl: async () => { throw new Error('offline') },
  }).calendar('owner-jwt', { month: '2026-10', mode: 'PAPER' })
  assert.deepEqual(failed, { ok: false, status: 0 })
  assert.deepEqual(readPlQuery(new URL('http://localhost/api/bsg/pl-calendar', 'http://localhost'), new Date('2026-10-31T23:00:00Z')), { month: '2026-11', mode: 'PAPER' })
})

test('runtime calendar route fails closed and does not read the trade file', async () => {
  const source = await readFile(new URL('./bsg-pl.js', import.meta.url), 'utf8')
  const start = await readFile(new URL('./start.js', import.meta.url), 'utf8')
  assert.equal(source.includes('bsg_paper_trades'), false)
  assert.equal(source.includes('readFile'), false)
  assert.equal(source.includes('p_risk_usd: 1'), false)
  assert.match(source, /p_risk_usd: riskUsdPerR/)
  assert.match(start, /riskUsdPerR:bsgPlConfig\.riskUsdPerR/)
  const server = createServer(runtimeHandler({}))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bsg/pl-calendar?month=2026-10`, { headers: { authorization: 'Bearer owner-jwt' } })
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.error, 'prerequisites_missing')
    assert.equal(Object.hasOwn(body, 'days'), false)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
