import test from 'node:test'
import assert from 'node:assert/strict'
import { ragFor, cappedAchievement, buildOrganisation, freshScorecard, recordPeriod, departmentAverage, perspectiveColor, BRAND } from './score.js'

test('empty scorecard has definitions and no achievement figures', () => {
  const scorecard = freshScorecard()
  assert.ok(scorecard.kpis.length > 0)
  assert.ok(scorecard.kpis.every((kpi) => kpi.periods.length === 0))
  const model = buildOrganisation(scorecard.kpis)
  assert.equal(model.overall, null)
  assert.equal(model.stats.tracked, 0)
  assert.equal(perspectiveColor('Financial'), BRAND)
  assert.notEqual(BRAND, '#B42318')
})

test('achievement thresholds and a recorded period drive the GM model', () => {
  assert.equal(ragFor(100), 'green')
  assert.equal(ragFor(90), 'amber')
  assert.equal(ragFor(89.9), 'red')
  assert.equal(ragFor(null), 'na')
  assert.equal(cappedAchievement(10, 5, 'LOWER_BETTER'), 150)
  let scorecard = freshScorecard()
  const kpi = scorecard.kpis.find((item) => item.dept === 'engineering')
  scorecard = recordPeriod(scorecard, kpi.id, { label: 'SEP', year: 2026, target: 100, actual: 95 })
  const average = departmentAverage(scorecard.kpis, 'engineering')
  assert.equal(average.count, 1)
  assert.equal(ragFor(average.pct), 'amber')
  const gm = scorecard.kpis.find((item) => item.dept === 'gm')
  scorecard = recordPeriod(scorecard, gm.id, { label: 'Q1', year: 2026, target: 100, actual: 110 })
  const model = buildOrganisation(scorecard.kpis, 2026)
  assert.equal(model.stats.tracked, 1)
  assert.equal(model.status.green, 1)
  assert.equal(model.overallQ[0] > 100, true)
})
