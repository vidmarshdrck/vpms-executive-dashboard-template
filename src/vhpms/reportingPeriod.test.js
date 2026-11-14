import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MONTHS, clampPeriod, dateInPeriod, defaultPeriod, monthsInPeriod, periodBounds, periodLabel, periodStorageKey, readStoredPeriod, resetPeriodOnSignIn, rowsInPeriod, weekOverlapsPeriod, writeStoredPeriod, yearOptions,
} from './reportingPeriod.js'

test('the default period is the current calendar quarter', () => {
  assert.deepEqual(MONTHS, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
  assert.deepEqual(defaultPeriod('2026-01-01'), { year: 2026, from: 1, to: 3 })
  assert.deepEqual(defaultPeriod('2026-03-31'), { year: 2026, from: 1, to: 3 })
  assert.deepEqual(defaultPeriod('2026-04-01'), { year: 2026, from: 4, to: 6 })
  assert.deepEqual(defaultPeriod('2026-06-30'), { year: 2026, from: 4, to: 6 })
  assert.deepEqual(defaultPeriod('2026-07-01'), { year: 2026, from: 7, to: 9 })
  assert.deepEqual(defaultPeriod('2026-09-30'), { year: 2026, from: 7, to: 9 })
  assert.deepEqual(defaultPeriod('2026-10-01'), { year: 2026, from: 10, to: 12 })
  assert.deepEqual(defaultPeriod('2026-11-10'), { year: 2026, from: 10, to: 12 })
  assert.deepEqual(defaultPeriod('2026-12-31'), { year: 2026, from: 10, to: 12 })
  assert.equal(periodLabel(defaultPeriod('2026-11-10')), 'Oct \u2013 Dec 2026')
  assert.equal(periodLabel({ year: 2026, from: 10, to: 10 }), 'Oct 2026')
  assert.equal(periodLabel({ year: 2026, from: 10, to: 12 }).includes('-'), false)
})

test('a period stays inside one year and clamps To to From', () => {
  assert.deepEqual(clampPeriod({ year: 2026, from: 8, to: 3 }), { year: 2026, from: 8, to: 8 })
  assert.deepEqual(clampPeriod({ year: 1990, from: 0, to: 14 }, '2026-01-15'), { year: 2026, from: 1, to: 1 })
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
  assert.deepEqual(yearOptions(2026, 2024), [2024, 2025, 2026, 2027])
  assert.deepEqual(yearOptions(2026, 2030), [2025, 2026, 2027, 2030])
  assert.deepEqual(yearOptions(2026, 2020), [2020, 2025, 2026, 2027])
  assert.deepEqual(yearOptions(2026, 2100), [2025, 2026, 2027, 2100])
})

test('a stored period is kept per user', () => {
  const saved = new Map()
  const storage = { getItem: (key) => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) }
  assert.equal(periodStorageKey('shadrickvidmar'), 'vhpms-reporting-period:shadrickvidmar')
  assert.deepEqual(readStoredPeriod(storage, 'shadrickvidmar', '2026-11-10'), { year: 2026, from: 10, to: 12 })
  writeStoredPeriod(storage, 'shadrickvidmar', { year: 2026, from: 11, to: 2 }, '2026-11-10')
  assert.deepEqual(readStoredPeriod(storage, 'shadrickvidmar', '2026-11-10'), { year: 2026, from: 11, to: 11 })
  assert.deepEqual(readStoredPeriod(storage, 'other', '2026-05-02'), { year: 2026, from: 4, to: 6 })
  storage.setItem(periodStorageKey('shadrickvidmar'), JSON.stringify({ year: 1800, from: 5, to: 6 }))
  assert.deepEqual(readStoredPeriod(storage, 'shadrickvidmar', '2026-01-15'), { year: 2026, from: 5, to: 6 })
  const blocked = { setItem() { throw new Error('storage blocked') } }
  assert.deepEqual(writeStoredPeriod(blocked, 'shadrickvidmar', { year: 2026, from: 4, to: 6 }, '2026-01-15'), { year: 2026, from: 4, to: 6 })
})

test('sign-in resets that user to the current quarter and leaves everyone else', () => {
  const saved = new Map()
  const storage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  }
  writeStoredPeriod(storage, 'shadrickvidmar', { year: 2025, from: 1, to: 2 }, '2026-11-10')
  writeStoredPeriod(storage, 'other', { year: 2026, from: 2, to: 2 }, '2026-11-10')
  assert.deepEqual(resetPeriodOnSignIn(storage, 'shadrickvidmar', '2026-11-10'), { year: 2026, from: 10, to: 12 })
  assert.deepEqual(readStoredPeriod(storage, 'shadrickvidmar', '2026-11-10'), { year: 2026, from: 10, to: 12 })
  assert.deepEqual(readStoredPeriod(storage, 'other', '2026-11-10'), { year: 2026, from: 2, to: 2 })
  assert.deepEqual(resetPeriodOnSignIn(null, 'shadrickvidmar', '2026-04-02'), { year: 2026, from: 4, to: 6 })
  assert.match(readFileSync(new URL('./Vhpms.jsx', import.meta.url), 'utf8'), /resetPeriodOnSignIn\(/)
})

test('the popover keeps the pms_app structure and the blue brand', () => {
  const view = readFileSync(new URL('./TimeframePopover.jsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
  assert.match(view, /hod-timeframe-popover/)
  assert.match(view, /hod-timeframe-panel/)
  assert.match(view, /M16 3v4M8 3v4M3 11h18/)
  assert.match(view, /m6 9 6 6 6-6/)
  assert.match(view, /data-cancel-period/)
  assert.match(view, /name="period_from"/)
  assert.match(view, /name="period_to"/)
  assert.match(view, /name="period_year"/)
  assert.doesNotMatch(view, /lucide-react|#B42318|#9A1D14/)
  assert.match(css, /0 18px 45px -12px rgba\(28, 25, 23, \.28\)/)
  assert.match(css, /\.hod-timeframe-popover > summary \{[^}]*padding: 4px 8px/)
  assert.match(css, /\.hod-timeframe-popover > summary \{[^}]*font-size: 11px/)
  assert.match(css, /\.hod-timeframe-popover > summary \{[^}]*font-weight: 600/)
  assert.match(css, /\.hod-timeframe-popover > summary \{[^}]*border-radius: 6px/)
  assert.match(css, /\.hod-timeframe-panel \{[^}]*width: 256px/)
  assert.match(css, /\.hod-timeframe-panel \{[^}]*border-radius: 12px/)
  assert.match(css, /\.hod-timeframe-panel \{[^}]*padding: 16px/)
  assert.match(css, /top: calc\(100% \+ 8px\)/)
  assert.match(css, /height: 61px/)
  assert.match(css, /margin-top: 27px/)
  assert.match(css, /\.hod-timeframe-popover\[open\] > summary:hover \{ background: #fff/)
  assert.match(css, /top: calc\(100% \+ 8px\); right: -4px/)
  assert.doesNotMatch(css, /top: 126px/)
  assert.match(css, /\.hod-timeframe-panel > p \{[^}]*font-size: 10px/)
  assert.match(css, /\.hod-timeframe-panel > p \{[^}]*letter-spacing: \.06em/)
  assert.match(css, /\.hod-timeframe-panel \.btn \{[^}]*height: 26px/)
  assert.match(css, /\.hod-timeframe-panel \.btn \{[^}]*padding: 4px 12px/)
  assert.match(css, /\.hod-timeframe-panel > div \{[^}]*align-items: baseline/)
  assert.match(css, /\.hod-timeframe-panel \.btn-primary \{ background: #1454c0/)
  assert.match(css, /\.hod-timeframe-panel \.btn-primary:hover \{ background: #0e4197/)
  assert.doesNotMatch(css, /#B42318|#9A1D14/)
})
