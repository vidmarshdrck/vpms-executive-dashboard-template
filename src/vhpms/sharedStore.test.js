import test from 'node:test'
import assert from 'node:assert/strict'
import { userIdFromAccessToken, loadOwnerScorecards, saveOwnerScorecards, loadKpiScorecard, saveKpiScorecard } from './sharedStore.js'
import { freshScorecard, recordPeriod } from './score.js'

const ENV = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable' }
const USER = '11111111-1111-1111-1111-111111111111'

function token(sub) {
  return `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.sig`
}

function memory() {
  const saved = new Map()
  return {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  }
}

function remoteClient(state) {
  return () => ({
    from(table) {
      const bucket = state[table] || (state[table] = [])
      return {
        select() {
          return Promise.resolve({ data: bucket.map((row) => ({ ...row })), error: state.error || null })
        },
        upsert(rows) {
          const list = Array.isArray(rows) ? rows : [rows]
          const written = []
          for (const row of list) {
            const index = bucket.findIndex((item) => (row.id && item.id === row.id) || (row.catalogue_id && item.catalogue_id === row.catalogue_id && item.owner_id === row.owner_id) || (row.kpi_id && item.kpi_id === row.kpi_id && item.label === row.label && Number(item.year) === Number(row.year)))
            const id = row.id || bucket[index]?.id || crypto.randomUUID()
            const next = { ...row, id }
            if (index >= 0) bucket[index] = { ...bucket[index], ...next }
            else bucket.push(next)
            written.push(next)
          }
          const result = Promise.resolve({ data: written.map((row) => ({ ...row })), error: state.error || null })
          return {
            select: () => result,
            then: (resolve, reject) => result.then(resolve, reject),
          }
        },
      }
    },
  })
}

test('a token that is not a user session stays on this browser', async () => {
  assert.equal(userIdFromAccessToken('not-a-jwt'), '')
  assert.equal(userIdFromAccessToken(token(USER)), USER)
  const storage = memory()
  storage.setItem('vhpms-owner-scorecards-v1', JSON.stringify({ version: 1, cards: [] }))
  const cards = await loadOwnerScorecards({ env: {}, token: '', storage, createClient: () => { throw new Error('offline') } })
  assert.deepEqual(cards, { version: 1, cards: [] })
})

test('missing tables and a failed network keep the browser copy', async () => {
  const storage = memory()
  const local = { version: 1, cards: [{ id: 'card-1', name: 'VE Scorecard', subjectType: 'business', subjectId: 'VE', metrics: [{ id: 'm1', name: 'Cash on hand', target: '100' }] }] }
  storage.setItem('vhpms-owner-scorecards-v1', JSON.stringify(local))
  const missing = await loadOwnerScorecards({
    env: ENV,
    token: token(USER),
    storage,
    createClient: () => ({ from: () => ({ select: () => Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'schema cache' } }) }) }),
  })
  assert.equal(missing.cards[0].name, 'VE Scorecard')
  const offline = await loadOwnerScorecards({
    env: ENV,
    token: token(USER),
    storage,
    createClient: () => { throw new Error('network down') },
  })
  assert.equal(offline.cards[0].subjectType, 'business')
})

test('a signed-in user saves scorecards and KPI periods through the client', async () => {
  const state = {}
  const storage = memory()
  const saved = await saveOwnerScorecards({
    env: ENV,
    token: token(USER),
    storage,
    createClient: remoteClient(state),
    state: { version: 1, cards: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'VE Scorecard', subjectType: 'business', subjectId: 'VE', metrics: [{ id: 'm1', name: 'Cash on hand', target: '100' }] }] },
  })
  assert.equal(saved.remote, true)
  assert.equal(state.vhpms_owner_scorecards[0].business_id, 'VE')
  assert.equal(state.vhpms_owner_scorecards[0].owner_id, USER)
  const loaded = await loadOwnerScorecards({ env: ENV, token: token(USER), storage: memory(), createClient: remoteClient(state) })
  assert.equal(loaded.cards[0].subjectType, 'business')
  let scorecard = recordPeriod(freshScorecard(), 've-monthly-income', { label: 'NOV', year: 2026, target: 2000, actual: 1860 })
  const pushed = await saveKpiScorecard({ env: ENV, token: token(USER), storage, createClient: remoteClient(state), scorecard })
  assert.equal(pushed.remote, true)
  const period = state.vhpms_kpi_periods.find((row) => row.label === 'NOV')
  assert.equal(Number(period.target), 2000)
  const again = await loadKpiScorecard({ env: ENV, token: token(USER), storage: memory(), createClient: remoteClient(state) })
  const income = again.kpis.find((kpi) => kpi.id === 've-monthly-income')
  assert.equal(income.periods[0].actual, 1860)
  assert.equal(again.kpis.length, 33)
})
