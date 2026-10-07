import test from 'node:test'
import assert from 'node:assert/strict'
import { kpiAchievement, weightedMean, scoreScorecard, periodAchievement, periodActual } from './scorecard.js'
import { PERSPECTIVES, gmScorecard, departments, REPORTED_MONTHS } from '../data/scorecardData.js'
import { classifyKpi } from './kpiThresholds.js'

const round1 = (value) => Math.round(value * 10) / 10

test('achievement inverts for lower-is-better KPIs', () => {
  assert.equal(kpiAchievement(90, 100), 90)
  assert.equal(kpiAchievement(12.5, 10, 'lower'), 80)
  assert.equal(kpiAchievement(null, 100), null)
  assert.equal(kpiAchievement(50, 0), null)
})

test('mean skips unreported KPIs instead of counting them as zero, and ignores weights', () => {
  assert.equal(weightedMean([{ value: 80, weight: 1 }, { value: null, weight: 3 }]), 80)
  assert.equal(weightedMean([{ value: 80, weight: 1 }, { value: 100, weight: 9 }]), 90)
  assert.equal(weightedMean([{ value: null, weight: 1 }]), null)
})

test('each KPI is capped at 150% so it cannot mask a failing KPI', () => {
  assert.equal(weightedMean([{ value: 300 }, { value: 30 }]), 90)
})

test('overall is the plain KPI average and contributions add up to it', () => {
  const kpis = [
    { perspective: 'financial', achievement: 92 },
    { perspective: 'financial', achievement: 101 },
    { perspective: 'customer', achievement: 75 },
    { perspective: 'internal', achievement: 400 },
    { perspective: 'learning', achievement: null },
  ]
  const { overall, contributions, scores } = scoreScorecard(PERSPECTIVES, kpis)
  assert.equal(round1(overall), round1((92 + 101 + 75 + 150) / 4))
  assert.equal(scores.internal, 150)
  assert.equal(scores.learning, null)
  const sum = Object.values(contributions).filter((v) => v !== null).reduce((a, b) => a + b, 0)
  assert.equal(round1(sum), round1(overall))
})

test('RAG follows the spec: green >= 100, amber 90-99.9, red < 90', () => {
  assert.equal(classifyKpi(100), 'green')
  assert.equal(classifyKpi(99.9), 'yellow')
  assert.equal(classifyKpi(90), 'yellow')
  assert.equal(classifyKpi(89.9), 'red')
  assert.equal(classifyKpi(null), 'na')
})

test('demo department data is stable, complete, and within a believable range', () => {
  const ytd = [...Array(REPORTED_MONTHS).keys()]
  assert.equal(departments.length, 9)
  for (const department of departments) {
    for (const perspective of PERSPECTIVES) {
      assert.ok(department.kpis.some((k) => k.perspective === perspective.key), `${department.name} has no ${perspective.key} KPI`)
    }
    const { overall } = scoreScorecard(PERSPECTIVES, department.kpis.map((k) => ({ ...k, achievement: periodAchievement(k, ytd) })))
    assert.ok(overall > 55 && overall < 100, `${department.name} scored ${overall}`)
    for (const kpi of department.kpis) assert.equal(kpi.actuals.slice(REPORTED_MONTHS).every((v) => v === null), true)
  }
})

test('period actual averages only the months that were reported', () => {
  assert.equal(periodActual({ actuals: [10, null, 20] }, [0, 1, 2]), 15)
  assert.equal(periodAchievement({ actuals: [null], target: 100 }, [0]), null)
})
