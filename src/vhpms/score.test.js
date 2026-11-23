import test from 'node:test'
import assert from 'node:assert/strict'
import { ragFor, cappedAchievement, buildOrganisation, freshScorecard, loadScorecard, recordPeriod, departmentAverage, perspectiveColor, presentScorecard, kpisForDepartment, formatActual, formatTarget, BRAND } from './score.js'

test('empty scorecard has definitions and no achievement figures', () => {
  const scorecard = freshScorecard()
  assert.equal(scorecard.catalogue, 'vidmar-2026')
  assert.equal(scorecard.kpis.length, 33)
  assert.equal(scorecard.departments.length, 8)
  assert.ok(scorecard.kpis.every((kpi) => kpi.periods.length === 0))
  assert.ok(scorecard.kpis.every((kpi) => kpi.strategy == null && kpi.milestone == null))
  assert.equal(loadScorecard(JSON.stringify({ version: 1, departments: [{ code: 'gm', name: 'GM' }], kpis: [{ id: 'k1', periods: [{ label: 'JAN', year: 2026, target: 1, actual: 1 }] }] })).kpis.length, 33)
  const model = buildOrganisation(scorecard.kpis)
  assert.equal(model.overall, null)
  assert.equal(model.stats.tracked, 0)
  assert.equal(model.stats.totalKpis, 33)
  assert.equal(model.stats.objectives, undefined)
  assert.equal(perspectiveColor('Financial'), BRAND)
  assert.notEqual(BRAND, '#B42318')
})

test('achievement thresholds and a recorded period drive the dashboard model', () => {
  assert.equal(ragFor(100), 'green')
  assert.equal(ragFor(90), 'amber')
  assert.equal(ragFor(89.9), 'red')
  assert.equal(ragFor(null), 'na')
  assert.equal(cappedAchievement(10, 5, 'LOWER_BETTER'), 150)
  let scorecard = freshScorecard()
  const kpi = scorecard.kpis.find((item) => item.id === 've-active-family-accounts')
  scorecard = recordPeriod(scorecard, kpi.id, { label: 'SEP', year: 2026, target: 100, actual: 95 })
  const average = departmentAverage(scorecard.kpis, 've')
  assert.equal(average.count, 1)
  assert.equal(ragFor(average.pct), 'amber')
  const model = buildOrganisation(scorecard.kpis, 2026)
  assert.equal(model.stats.tracked, 1)
  assert.equal(model.status.amber, 1)
  assert.equal(model.overallQ[2], 95)
})

test('VE figures already in the workspace fill the matching actuals', () => {
  const presented = presentScorecard(freshScorecard(), {
    activeAccounts: 12,
    customersDue: 3,
    income: 1860,
    cash: 250.5,
    openSlots: 4,
  })
  const ve = kpisForDepartment(presented.kpis, 've').flatMap((group) => group.kpis)
  assert.equal(ve.find((kpi) => kpi.id === 've-active-family-accounts').latest.actual, 12)
  assert.equal(ve.find((kpi) => kpi.id === 've-customers-due-this-period').latest.actual, 3)
  assert.equal(ve.find((kpi) => kpi.id === 've-monthly-income').latest.actual, 1860)
  assert.equal(ve.find((kpi) => kpi.id === 've-cash-on-hand').latest.actual, 250.5)
  assert.equal(ve.find((kpi) => kpi.id === 've-open-slots-to-fill').latest.actual, 4)
  assert.equal(formatActual(1860, 'K'), 'K 1,860.00')
  assert.equal(formatTarget(null, 'K'), 'No target set')
  const targeted = recordPeriod(freshScorecard(), 've-monthly-income', { label: 'NOV', year: 2026, target: 1860, actual: '' })
  const income = kpisForDepartment(targeted.kpis, 've').flatMap((group) => group.kpis).find((kpi) => kpi.id === 've-monthly-income')
  assert.equal(formatTarget(income.latest.target, income.unit), 'K 1,860.00')
  assert.equal(income.latest.actual, null)
  const owner = kpisForDepartment(presented.kpis, 'owner').flatMap((group) => group.kpis)
  assert.equal(owner.find((kpi) => kpi.id === 'owner-ve-cash-on-hand').latest.actual, 250.5)
  assert.equal(owner.find((kpi) => kpi.measure === 'Combined recorded monthly income').latest, null)
  assert.equal(presented.kpis.find((kpi) => kpi.id === 'vt-monthly-income').liveActual, undefined)
})
