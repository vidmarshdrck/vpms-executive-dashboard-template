import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRisk, equityCurve, stats, groupPnl, rr, latencySeconds, DEMO_RISK } from './metrics.js'
import { bsgFixture } from './fixture.js'
const T = (id, source, r, close, extra = {}) => ({ signal_id: id, source, symbol: 'EURUSD', entry: 1, sl: 0.99, tp: 1.02, status: 'CLOSED', close_time: close, r_multiple: r, pnl: null, ...extra })
test('paper 1R compounds at 1% of current balance; demo 1R is fixed $40', () => {
  const p = applyRisk([T('a', 'paper', 2, '2026-01-01T01:00:00Z'), T('b', 'paper', -1, '2026-01-01T02:00:00Z')], 'paper')
  assert.equal(p[0].risk_usd, 1); assert.equal(p[0].pnl, 2); assert.equal(p[1].risk_usd, 1.02); assert.equal(p[1].pnl, -1.02); assert.equal(p[1].balance_after, 100.98)
  const d = applyRisk([T('c', 'mt5_demo', -1, '2026-01-01T01:00:00Z'), T('d', 'mt5_demo', 2, '2026-01-01T02:00:00Z')], 'mt5_demo')
  assert.deepEqual(d.map(t => t.risk_usd), [DEMO_RISK, DEMO_RISK]); assert.deepEqual(d.map(t => t.pnl), [-40, 80])
})
test('stats, drawdown, grouping, RR and latency', () => {
  const tr = [T('a', 'mt5_demo', -1, '2026-01-01T01:00:00Z'), T('b', 'mt5_demo', -1, '2026-01-02T01:00:00Z'), T('c', 'mt5_demo', 2, '2026-01-02T05:00:00Z'), { ...T('o', 'mt5_demo', null, null), status: 'OPEN' }]
  const s = stats(tr, 'mt5_demo')
  assert.equal(s.closed, 3); assert.equal(s.open, 1); assert.equal(s.winRate, 1 / 3); assert.equal(s.avgR, 0); assert.equal(s.balance, 4000); assert.equal(s.maxDrawdownPct, -2); assert.equal(s.sampleOk, false)
  assert.deepEqual(groupPnl(tr, 'mt5_demo', 'day'), [{ key: '2026-01-01', pnl: -40 }, { key: '2026-01-02', pnl: 40 }])
  assert.equal(equityCurve([], 'paper').length, 1); assert.equal(stats([], 'paper').winRate, null)
  assert.ok(Math.abs(rr({ entry: 1, sl: 0.99, tp: 1.02 }) - 2) < 1e-9); assert.equal(rr({ entry: 1, sl: 1, tp: 2 }), null)
  assert.equal(latencySeconds({ signal_time: '2026-01-01T00:00:00Z', order_time: '2026-01-01T00:00:03Z' }), 3); assert.equal(latencySeconds({ signal_time: 'x', order_time: null }), null)
})
test('fixture is flagged fake, deterministic and has no order time for paper', () => {
  assert.equal(bsgFixture.fixture, true)
  assert.ok(bsgFixture.trades.every(t => t.signal_id.startsWith('FX-') && /FAKE/.test(t.strategy)))
  assert.ok(bsgFixture.trades.filter(t => t.source === 'paper').every(t => t.order_time === null))
  assert.equal(bsgFixture.trades.filter(t => t.source === 'paper').length, 30); assert.equal(bsgFixture.trades.filter(t => t.source === 'mt5_demo').length, 6)
  assert.ok(bsgFixture.trades.every(t => rr(t) > 1.9 && rr(t) < 2.1))
})
test('VOID trades never enter metrics', () => {
  const tr = [T('a', 'paper', 2, '2026-01-01T01:00:00Z'), { ...T('v', 'paper', null, null), status: 'VOID', original_r_multiple: 2 }]
  assert.equal(stats(tr, 'paper').closed, 1); assert.equal(stats(tr, 'paper').balance, 102)
})
