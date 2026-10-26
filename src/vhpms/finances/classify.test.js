import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { adaptRpc, countsAsVerifiedIncome, normaliseEntry, project } from './classify.js'

const fixture = JSON.parse(await readFile(new URL('../../../server/fixtures/finances.json', import.meta.url), 'utf8'))

test('ledger incomes include rental outbounds; verified income is only a side metric', () => {
  const view = project(fixture, { scope: 'all', limit: 100 })
  assert.equal(view.summary.totals.incomes, 5150)
  assert.equal(view.summary.verified_income, 1500)
  assert.equal(view.summary.pending.incomes, 650)
  assert.equal(view.summary.pending.count, 2)
  assert.equal(view.summary.totals.expenses, 0)
  assert.equal(view.summary.totals.investments, 0)
  assert.equal(view.entries.some((row) => row.verification_status === 'unclaimed' && countsAsVerifiedIncome(row)), false)
  assert.equal(view.entries.some((row) => row.verification_status === 'claimed' && countsAsVerifiedIncome(row)), false)
  assert.equal(view.entries.find((row) => row.verification_status === 'verified').category, 'rental_income')
})

test('Rhoda cash-out is rental income, outbound, and not an expense', () => {
  const view = project(fixture, { scope: 'all', limit: 100 })
  const cashOut = view.entries.find((row) => row.transaction_id === '10900844301')
  assert.ok(cashOut)
  assert.equal(cashOut.bucket, 'income')
  assert.equal(cashOut.ledger_bucket, 'income')
  assert.equal(cashOut.direction, 'outbound')
  assert.equal(cashOut.category, 'rental_income')
  assert.equal(cashOut.amount_zmw, 3000)
  assert.equal(cashOut.claim_status, 'ignored')
  assert.equal(cashOut.verification_status, null)
  assert.equal(cashOut.counterparty, 'Rhoda Chitukutuku')
  assert.equal(countsAsVerifiedIncome(cashOut), false)
  assert.equal(view.entries.filter((row) => row.bucket === 'expense').length, 0)
  const incomeOnly = project(fixture, { bucket: 'income', limit: 100 })
  assert.ok(incomeOnly.entries.some((row) => row.transaction_id === '10900844301'))
  assert.equal(project(fixture, { bucket: 'investment', limit: 100 }).entries.length, 0)
  assert.equal(JSON.stringify(view).includes('subscription_payment'), false)
  assert.equal(JSON.stringify(view).includes('raw_sms'), false)
  assert.equal(JSON.stringify(view).includes('_comment'), false)
})

test('outbound claim status is kept and cannot inflate verified income', () => {
  const row = normaliseEntry({
    id: 'forced', ledger_bucket: 'income', direction: 'outbound', amount_zmw: 80,
    verification_status: 'verified', claim_status: 'verified', category: 'rental_income', raw_sms: 'do not keep', phone: '260970000000',
  })
  assert.equal(row.claim_status, 'verified')
  assert.equal(row.verification_status, null)
  assert.equal('raw_sms' in row, false)
  assert.equal(JSON.stringify(row).includes('260970000000'), false)
  const view = project({ entries: [row, { id: 'ok', ledger_bucket: 'income', direction: 'inbound', verification_status: 'verified', amount_zmw: 10 }] }, {})
  assert.equal(view.summary.totals.incomes, 90)
  assert.equal(view.summary.verified_income, 10)
})

test('expense and investment buckets sum without affecting verified income', () => {
  const view = project({ entries: [
    { id: 'e', ledger_bucket: 'expense', direction: 'outbound', amount_zmw: 20, occurred_at: '2026-01-01T00:00:00Z' },
    { id: 'i', ledger_bucket: 'investment', amount_zmw: 5, occurred_at: '2026-01-02T00:00:00Z' },
  ] }, {})
  assert.equal(view.summary.totals.expenses, 20)
  assert.equal(view.summary.totals.investments, 5)
  assert.equal(view.summary.totals.incomes, 0)
})

test('a successful empty RPC result stays empty', () => {
  const view = adaptRpc({ totals: { incomes: 0, expenses: 0, investments: 0 }, currency: 'ZMW' }, [], {})
  assert.equal(view.summary.totals.incomes, 0)
  assert.equal(view.summary.totals.investments, 0)
  assert.deepEqual(view.entries, [])
  assert.equal(JSON.stringify(view).includes('10900844301'), false)
})

test('RPC rows recompute verified income and drop raw sms', () => {
  const view = adaptRpc(null, [{
    id: 'live-1', ledger_bucket: 'income', direction: 'inbound', verification_status: 'verified', amount_zmw: 30, category: 'rental_income',
  }, {
    id: 'live-2', ledger_bucket: 'income', direction: 'inbound', verification_status: 'unclaimed', amount_zmw: 70,
  }, {
    id: 'live-3', ledger_bucket: 'income', direction: 'outbound', category: 'rental_income', amount_zmw: 1500, transaction_id: '10900844301', raw_sms: 'hidden',
  }], {})
  assert.equal(view.summary.totals.incomes, 1600)
  assert.equal(view.summary.verified_income, 30)
  assert.equal(view.summary.pending.incomes, 70)
  assert.equal(view.entries.find((row) => row.transaction_id === '10900844301').bucket, 'income')
  assert.equal(JSON.stringify(view).includes('hidden'), false)
})

test('summary RPC ledger totals are kept and verified income does not replace them', () => {
  const view = adaptRpc(
    { totals: { incomes: 20117.99, expenses: 201974.44, investments: 0 }, verified_income: 100 },
    [{ id: 'rhoda', ledger_bucket: 'income', direction: 'outbound', category: 'rental_income', amount_zmw: 1500, transaction_id: '10900844301' }],
    {},
  )
  assert.equal(view.summary.totals.incomes, 20117.99)
  assert.equal(view.summary.totals.expenses, 201974.44)
  assert.equal(view.summary.totals.investments, 0)
  assert.equal(view.summary.verified_income, 100)
  assert.equal(view.entries[0].bucket, 'income')
  assert.notEqual(view.summary.totals.incomes, view.summary.verified_income)
})
