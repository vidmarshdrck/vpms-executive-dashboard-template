import test from 'node:test'
import assert from 'node:assert/strict'
import { saveBookEntry, reviewBookEntry, readBooks, bookReport } from './entryBooks.js'
import { quartersInTimeframe } from './reportingPeriod.js'
const finance = { id: 'finance_head', role: 'Dept Head', departmentId: 'finance', name: 'Finance Head' }
const operations = { id: 'operations_head', role: 'Dept Head', departmentId: 'operations', name: 'Operations Head' }
const gm = { id: 'gm', role: 'GM', name: 'GM' }
const form = (extra = {}) => ({ frequency: 'weekly', start: '2026-10-05', end: '2026-10-11', values: { revenue: '1000', target: '1200', expenditure: '600' }, ...extra })
function isolated(fn) {
  const storage = globalThis.localStorage, win = globalThis.window
  const data = new Map()
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  globalThis.window = { dispatchEvent() {} }
  try { fn(data) } finally { globalThis.localStorage = storage; globalThis.window = win }
}
test('book figures publish only after GM approval, with actor history', () => isolated(() => {
  const entry = saveBookEntry(finance, form(), true)
  assert.equal(bookReport(readBooks(), 2026).quarters[3].actual, null)
  assert.throws(() => reviewBookEntry(finance, entry.id, true), /Only the GM/)
  assert.throws(() => saveBookEntry(finance, { ...entry, values: { revenue: 500 } }), /non-negative|awaiting review/)
  reviewBookEntry(gm, entry.id, true)
  assert.equal(bookReport(readBooks(), 2026).quarters[3].actual, 1000)
  assert.equal(readBooks().entries[0].history.at(-1).by.id, 'gm')
}))
test('corrections preserve the published snapshot until reviewed and replace rather than add', () => isolated(() => {
  const entry = saveBookEntry(finance, form(), true); reviewBookEntry(gm, entry.id, true)
  const correction = saveBookEntry(finance, form({ id: entry.id, values: { revenue: 900, target: 1200, expenditure: 600 } }), true)
  assert.equal(bookReport(readBooks(), 2026).quarters[3].actual, 1000)
  assert.equal(correction.createdAt, entry.createdAt)
  assert.throws(() => reviewBookEntry(gm, entry.id, false), /Explain/)
  reviewBookEntry(gm, entry.id, false, 'Check revenue')
  assert.equal(readBooks().entries[0].status, 'RETURNED')
  saveBookEntry(finance, form({ id: entry.id, values: { revenue: 950, target: 1200, expenditure: 600 } }), true)
  reviewBookEntry(gm, entry.id, true)
  assert.equal(bookReport(readBooks(), 2026).quarters[3].actual, 950)
  assert.equal(readBooks().entries.length, 1)
  assert.throws(() => saveBookEntry(finance, form({ id: entry.id, start: '2026-10-12', end: '2026-10-18' })), /Keep the approved/)
}))
test('daily and weekly overlaps are rejected; different stock products aggregate independently', () => isolated(() => {
  saveBookEntry(finance, form())
  assert.throws(() => saveBookEntry(finance, form({ frequency: 'daily', start: '2026-10-07', end: '2026-10-07' })), /overlaps/)
  for (const product of ['LSG', 'PMS']) {
    const entry = saveBookEntry(operations, form({ product, values: { received: 100, distributed: 80 } }), true)
    reviewBookEntry(gm, entry.id, true)
  }
  const result = bookReport(readBooks(), 2026)
  assert.equal(result.quarters[3].received, 200); assert.equal(result.quarters[3].distributed, 160)
  assert.equal(result.financeCount, 0)
}))
test('invalid dates, negative, missing and nonfinite figures are rejected while zero is accepted', () => isolated(() => {
  for (const extra of [{ start: '2026-02-30' }, { end: '2026-10-12' }, { end: '2026-11-01' }, { frequency: 'daily' }, { values: { revenue: -1 } }, { values: { revenue: Infinity } }, { values: {} }]) assert.throws(() => saveBookEntry(finance, form(extra)))
  assert.throws(() => saveBookEntry(operations, form({ values: { received: 1, distributed: 1 } })), /Choose the product/)
  const entry = saveBookEntry(finance, form({ values: { revenue: 0, target: 0, expenditure: 0 } }), true)
  reviewBookEntry(gm, entry.id, true)
  assert.equal(bookReport(readBooks(), 2026).quarters[3].actual, 0)
}))
test('year and selected months filter totals, missing periods remain null', () => isolated(() => {
  for (const [start, end, revenue] of [['2025-10-06', '2025-10-12', 5000], ['2026-10-05', '2026-10-11', 1000], ['2026-11-02', '2026-11-08', 2000]]) {
    const entry = saveBookEntry(finance, form({ start, end, values: { revenue, target: revenue, expenditure: 0 } }), true); reviewBookEntry(gm, entry.id, true)
  }
  assert.equal(bookReport(readBooks(), 2026).quarters[3].actual, 3000)
  assert.equal(bookReport(readBooks(), 2026, [9]).quarters[3].actual, 1000)
  assert.equal(bookReport(readBooks(), 2027).quarters[3].actual, null)
}))
test('department ownership and head-only entries are enforced', () => isolated(() => {
  assert.throws(() => saveBookEntry({ ...finance, role: 'Staff' }, form()), /Only this department/)
  const entry = saveBookEntry(finance, form())
  assert.throws(() => saveBookEntry(operations, form({ id: entry.id, product: 'LSG', values: { received: 10, distributed: 10 } })), /Only this department/)
}))
test('storage failure reports an error without discarding previous saved data', () => isolated((data) => {
  const entry = saveBookEntry(finance, form())
  const before = [...data.values()][0]
  globalThis.localStorage.setItem = () => { throw new Error('quota') }
  assert.throws(() => saveBookEntry(finance, form({ id: entry.id }), true), /could not be saved/)
  assert.equal([...data.values()][0], before)
}))
test('quarter chart filters agree with current, last and custom reporting selections', () => {
  const now = new Date(2026, 6, 15)
  assert.deepEqual(quartersInTimeframe({ id: 'current-quarter', customFrom: 9, customTo: 11 }, 12, now), ['Q3'])
  assert.deepEqual(quartersInTimeframe({ id: 'last-quarter' }, 12, now), ['Q2'])
  assert.deepEqual(quartersInTimeframe({ id: 'custom', customFrom: 2, customTo: 3 }), ['Q1', 'Q2'])
})
