import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryShare, compactAmount, dailyAmounts, monthSummary, sourceAnalysis } from './fundsMonth.js'
import { latestPayments } from './veData.js'

const rows = [
  { date: '2026-11-04', kind: 'expense', category: 'Airtime', amount: 2300 },
  { date: '2026-11-04', kind: 'expense', category: 'Netflix', amount: 700 },
  { date: '2026-11-08', kind: 'income', category: 'Netflix', amount: 1200 },
  { date: '2026-10-02', kind: 'income', category: 'Spotify', amount: 50 },
]

test('a month calendar totals each day and keeps other months out', () => {
  const days = dailyAmounts(rows, '2026-11')
  assert.equal(days.length, 30)
  assert.equal(days[3].date, '2026-11-04')
  assert.equal(days[3].expense, 3000)
  assert.equal(days[3].net, -3000)
  assert.equal(days[7].income, 1200)
  assert.equal(days[7].net, 1200)
  assert.equal(days[0].net, 0)
  assert.equal(compactAmount(days[3].net), '-3k')
  assert.equal(compactAmount(-2300), '-2.3k')
  assert.equal(compactAmount(1200), '1.2k')
  const summary = monthSummary(days.map((day) => ({ kind: 'income', amount: day.income })).concat(days.map((day) => ({ kind: 'expense', amount: day.expense }))))
  assert.equal(summary.income, 1200)
  assert.equal(summary.expense, 3000)
  assert.equal(summary.total, -1800)
})

test('category shares sum to 100 and rank by amount', () => {
  const share = categoryShare(rows.filter((row) => row.date.startsWith('2026-11') && row.kind === 'expense'))
  assert.deepEqual(share.map((item) => item.name), ['Airtime', 'Netflix'])
  assert.equal(Math.round(share[0].pct), 77)
  assert.equal(Math.round(share[1].pct), 23)
  assert.equal(Math.round(share.reduce((sum, item) => sum + item.pct, 0)), 100)
})

test('account analysis pairs expense and income for the same source', () => {
  const sources = sourceAnalysis(rows.filter((row) => row.date.startsWith('2026-11')))
  const netflix = sources.find((item) => item.name === 'Netflix')
  assert.equal(netflix.expense, 700)
  assert.equal(netflix.income, 1200)
})

test('last payment is the latest order for that customer', () => {
  const payments = latestPayments([
    { cid: 'C1', date: '2026-10-01', amount: 40 },
    { cid: 'C1', date: '2026-11-08', amount: 15 },
    { cid: 'C1', date: '2026-11-08', amount: 90 },
    { cid: 'C2', date: '', amount: 500 },
  ])
  assert.deepEqual(payments.get('C1'), { date: '2026-11-08', amount: 90 })
  assert.equal(payments.get('C2'), undefined)
})
