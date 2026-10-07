import test from 'node:test'
import assert from 'node:assert/strict'
import { getPerformanceStatus, getVariance, getDataFreshnessLabel } from './dashboardMetrics.js'

test('reports positive, watch, and negative KPI states from target achievement', () => {
  assert.equal(getPerformanceStatus(100, 100).label, 'On target')
  assert.equal(getPerformanceStatus(84, 100).label, 'Watch')
  assert.equal(getPerformanceStatus(54, 100).label, 'Below target')
})

test('does not invent a status when a KPI value is not reported', () => {
  assert.equal(getPerformanceStatus(null, 100).label, 'Not reported')
  assert.equal(getPerformanceStatus(undefined, 100).tone, 'neutral')
})

test('calculates signed absolute and percentage variance against a target', () => {
  assert.deepEqual(getVariance(120, 100), { absolute: 20, percent: 20, direction: 'positive' })
  assert.deepEqual(getVariance(80, 100), { absolute: -20, percent: -20, direction: 'negative' })
  assert.deepEqual(getVariance(null, 100), { absolute: null, percent: null, direction: 'neutral' })
})

test('labels the current local data source as provisional and hardcoded', () => {
  assert.equal(getDataFreshnessLabel({ source: 'Strategic KPI Excel File FY2025', isProvisional: true }), 'Provisional · Strategic KPI Excel File FY2025')
})
