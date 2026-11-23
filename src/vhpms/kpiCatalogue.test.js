import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { catalog } from './catalog.js'
import { veKpiFigures } from './kpiLive.js'
import { freshScorecard } from './score.js'

test('the catalogue is the 33 Vidmar KPIs, with targets left blank', () => {
  const lines = readFileSync(new URL('./data/vidmar-kpis.csv', import.meta.url), 'utf8').trim().split(/\n/).slice(1)
  assert.equal(lines.length, 33)
  assert.equal(catalog.kpis.length, 33)
  const names = lines.map((line) => line.split(',')[3])
  assert.deepEqual(catalog.kpis.map((kpi) => kpi.measure), names)
  assert.deepEqual(catalog.departments.map((department) => department.businessCode), ['VE', 'VAI', 'REZ', 'BSG', 'VT', 'Eunique', 'Digital', 'GROUP'])
  assert.equal(catalog.kpis.filter((kpi) => kpi.live).length, 6)
  assert.ok(catalog.kpis.every((kpi) => kpi.periods.length === 0 && kpi.strategy == null))
  assert.equal(/\b(ROCE|depot|truck turn|storage tank|LSG)\b/i.test(JSON.stringify(catalog)), false)
  assert.equal(freshScorecard().kpis[0].id, 've-active-family-accounts')
})

test('live VE figures follow the header timeframe and ignore unread sources', () => {
  const figures = veKpiFigures({
    access: { familyAccounts: 'ok', customers: 'ok', orders: 'ok', bankAccounts: 'ok', bankTransactions: 'ok' },
    overview: { active: 4, openSlots: 2 },
    customers: [{ dueDate: '2026-11-15' }, { dueDate: '2026-12-01' }],
    income: [{ date: '2026-11-02', amount: 1860 }, { date: '2026-10-02', amount: 10 }],
    bankAccounts: [{ id: 'fnb', currency: 'ZMW', openingBalance: 100 }],
    bankTransactions: [],
  }, { year: 2026, from: 11, to: 11, end: '2026-11-30' })
  assert.equal(figures.activeAccounts, 4)
  assert.equal(figures.openSlots, 2)
  assert.equal(figures.customersDue, 1)
  assert.equal(figures.income, 1860)
  assert.equal(figures.cash, 100)
  const offline = veKpiFigures({
    access: { familyAccounts: 'signed-out', customers: 'blocked', orders: 'unconfigured', bankAccounts: 'error', bankTransactions: 'error' },
    overview: { active: 9, openSlots: 9 },
    income: [{ date: '2026-11-02', amount: 5 }],
  }, { year: 2026, from: 11, to: 11, end: '2026-11-30' })
  assert.deepEqual(offline, {})
})
