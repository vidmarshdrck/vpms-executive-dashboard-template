import assert from 'node:assert/strict'
import test from 'node:test'
import { kpiDifference, formatKpiDifference } from './kpiDifference.js'

test('difference is actual minus target with a visible positive or negative sign', () => {
  assert.equal(kpiDifference(110, 100), 10)
  assert.equal(kpiDifference(90, 100), -10)
  assert.equal(formatKpiDifference(110, 100, '%'), '+10.0 pp')
  assert.equal(formatKpiDifference(90, 100, '%'), '−10.0 pp')
  assert.equal(formatKpiDifference(100, 100, '%'), '0.0 pp')
  assert.equal(formatKpiDifference(0.03, 0.05, 'LTIFR'), '−0.02 LTIFR')
})

test('missing actual is not treated as zero', () => {
  assert.equal(formatKpiDifference(null, 100, '%'), '—')
})
