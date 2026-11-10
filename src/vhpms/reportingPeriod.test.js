import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampPeriod, dateInPeriod, defaultPeriod, monthsInPeriod, periodBounds, periodLabel, periodStorageKey, readStoredPeriod, rowsInPeriod, weekOverlapsPeriod, writeStoredPeriod, yearOptions,
} from './reportingPeriod.js'

test('the default period is the current calendar quarter', () => {
  assert.deepEqual(defaultPeriod('2026-01-15'), { year: 2026, from: 1, to: 3 })
  assert.deepEqual(defaultPeriod('2026-04-01'), { year: 2026, from: 4, to: 6 })
  assert.deepEqual(defaultPeriod('2026-07-31'), { year: 2026, from: 7, to: 9 })
  assert.deepEqual(defaultPeriod('2026-11-10'), { year: 2026, from: 10, to: 12 })
  assert.equal(periodLabel(defaultPeriod('2026-11-10')), 'Oct – Dec 2026')
})

test('a period stays inside one year and clamps To to From', () => {
  assert.deepEqual(clampPeriod({ year: 2026, from: 8, to: 3 }), { year: 2026, from: 8, to: 8 })
  const fallback = defaultPeriod()
  assert.deepEqual(clampPeriod({ year: 1990, from: 0, to: 14 }), { year: fallback.year, from: fallback.from, to: fallback.from })
  assert.equal(periodLabel({ year: 2026, from: 10, to: 10 }), 'Oct 2026')
  assert.deepEqual(periodBounds({ year: 2026, from: 10, to: 12 }), { start: '2026-10-01', end: '2026-12-31' })
  assert.deepEqual(periodBounds({ year: 2024, from: 2, to: 2 }), { start: '2024-02-01', end: '2024-02-29' })
  assert.deepEqual(monthsInPeriod({ year: 2026, from: 10, to: 12 }), ['2026-10', '2026-11', '2026-12'])
  assert.equal(dateInPeriod('2026-10-01', { year: 2026, from: 10, to: 12 }), true)
  assert.equal(dateInPeriod('2026-09-30', { year: 2026, from: 10, to: 12 }), false)
  assert.equal(dateInPeriod('2027-01-01', { year: 2026, from: 10, to: 12 }), false)
  assert.deepEqual(rowsInPeriod([{ date: '2026-11-08', amount: 120 }, { date: '2026-09-01', amount: 40 }], { year: 2026, from: 10, to: 12 }), [{ date: '2026-11-08', amount: 120 }])
  assert.equal(weekOverlapsPeriod('2026-09-28', { year: 2026, from: 10, to: 12 }), true)
  assert.equal(weekOverlapsPeriod('2026-09-21', { year: 2026, from: 10, to: 12 }), false)
})

test('year choices are the previous, current, and next year, plus a selected year outside that window', () => {
  assert.deepEqual(yearOptions(2026, 2026), [2025, 2026, 2027])
  assert.deepEqual(yearOptions(2026, 2030), [2025, 2026, 2027, 2030])
})

test('a stored period is kept per user', () => {
  const saved = new Map()
  const storage = { getItem: (key) => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) }
  assert.equal(periodStorageKey('shadrickvidmar'), 'vhpms-reporting-period:shadrickvidmar')
  assert.deepEqual(readStoredPeriod(storage, 'shadrickvidmar', '2026-11-10'), { year: 2026, from: 10, to: 12 })
  writeStoredPeriod(storage, 'shadrickvidmar', { year: 2026, from: 11, to: 2 })
  assert.deepEqual(readStoredPeriod(storage, 'shadrickvidmar', '2026-11-10'), { year: 2026, from: 11, to: 11 })
  assert.deepEqual(readStoredPeriod(storage, 'other', '2026-05-02'), { year: 2026, from: 4, to: 6 })
})
