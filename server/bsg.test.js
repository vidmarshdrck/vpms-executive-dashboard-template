import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { normaliseTrades, pendingSignals, account, parseHeaders, cronState, tradeStatus } from './bsg-normalise.js'
import { createBsgReader, createBsgHandler } from './bsg-read.js'
import { applyRisk, stats } from '../src/vhpms/bsg/metrics.js'
// Synthetic fixtures shaped like the real BSG files. Not real trades.
const TRADES = [
  { trade_id: 'SYN-1', symbol: 'frxUSDJPY', name: 'USD/JPY', direction: 'BUY', bias: 'bullish', bias_tf: '4h', entry_tf: '15m', entry: 150, stop: 149.5, target: 151, rr: 2, structure: 'fractal', strategy_version: 'v1.1', status: 'CLOSED', open_ts: '2026-10-01T08:00:00Z', exit_ts: '2026-10-01T12:00:00Z', r_multiple: 2, mode: 'paper', originating_agent: 'gideon', opposing_agent: 'samson', boaz_decision: 'APPROVE' },
  { trade_id: 'SYN-2', symbol: 'frxEURUSD', direction: 'SELL', entry: 1.09, stop: 1.092, target: 1.086, rr: 2, strategy_version: 'v1.1', status: 'CLOSED', open_ts: '2026-10-02T08:00:00Z', exit_ts: '2026-10-02T10:00:00Z', r_multiple: -1 },
  { trade_id: 'SYN-3', symbol: 'frxGBPUSD', direction: 'BUY', entry: 1.3, stop: 1.29, target: 1.32, rr: 2, strategy_version: 'v1.0', status: 'VOID_DATA_BUG', open_ts: '2026-09-20T08:00:00Z', exit_ts: '2026-09-20T09:00:00Z', void_reason: 'bad candle feed', original_exit_price: 1.32, original_result: 'WIN', original_r_multiple: 2 },
  { trade_id: 'SYN-4', symbol: 'frxXAUUSD', direction: 'SELL', entry: 2400, stop: 2410, target: 2380, rr: 2, strategy_version: 'v1.1', status: 'OPEN', open_ts: '2026-10-03T08:00:00Z' },
]
const ACCOUNT = { starting_capital: 100, current_capital: 100.98, risk_pct: 0.01, trades_closed: 2, wins: 1, losses: 1, last_trade_pnl: -1.02 }
const SCAN = { ts: '2026-10-16T21:15:00Z', session: 'london', markets: ['frxUSDJPY'], setups: [{ direction: 'BUY', entry: 151.2, stop: 150.9, target: 151.8, rr: 2, structure: 'fractal', current: 151.25, protected_high: 151.9, symbol: 'frxUSDJPY', bias: 'bullish', bias_tf: '4h', entry_tf: '15m', strategy_version: 'v1.1', scan_ts: '2026-10-16T21:15:00Z', trade_id: 'SYN-5' }] }
const STRAT = '# Owner Trading Strategy\n\n**Status:** ACTIVE — populated 2026-10-01\n**Strategy Version:** v1.1\n'
function dirs() {
  const root = mkdtempSync(path.join(tmpdir(), 'bsg-')), data = path.join(root, 'results'), k = path.join(root, 'boaz_finance.agent')
  mkdirSync(data); mkdirSync(path.join(k, 'knowledge'), { recursive: true })
  writeFileSync(path.join(data, 'open_paper_trades.json'), JSON.stringify(TRADES)); writeFileSync(path.join(data, 'paper_account.json'), JSON.stringify(ACCOUNT))
  writeFileSync(path.join(data, 'bsg_scan_20261016_2100.json'), JSON.stringify({ ...SCAN, setups: [] })); writeFileSync(path.join(data, 'bsg_scan_20261016_2115.json'), JSON.stringify(SCAN))
  writeFileSync(path.join(data, 'bsg_scan_notes.json'), '{}'); writeFileSync(path.join(k, 'knowledge', 'owner_trading_strategy.md'), STRAT)
  mkdirSync(path.join(k, '.worktrees', 'x', 'knowledge'), { recursive: true }); writeFileSync(path.join(k, '.worktrees', 'x', 'knowledge', 'owner_trading_strategy.md'), STRAT.replace('v1.1', 'v9.9'))
  for (const [d, cron] of [['gabriel_strategy', 'Jobs: PROPOSED, DISABLED'], ['gideon_bull', 'Status: ACTIVE'], ['samson_bear', 'Status: ACTIVE']]) {
    mkdirSync(path.join(k, 'specialists', `${d}.agent`), { recursive: true }); writeFileSync(path.join(k, 'specialists', `${d}.agent`, 'cron_job.md'), cron); writeFileSync(path.join(k, 'specialists', `${d}.agent`, 'goal.md'), `# ${d} goal\n`)
  }
  return { root, data, k }
}
test('normalises trades: VOID kept for display but excluded from metrics; paper R compounds on balance', () => {
  const t = normaliseTrades([...TRADES, null, { no_id: 1 }])
  assert.equal(t.length, 4); assert.deepEqual(t.map(x => x.status), ['CLOSED', 'CLOSED', 'VOID', 'OPEN'])
  assert.equal(t[2].void_reason, 'bad candle feed'); assert.equal(t[2].r_multiple, null); assert.equal(t[2].original_r_multiple, 2)
  assert.equal(t[0].sl, 149.5); assert.equal(t[0].tp, 151); assert.equal(t[0].order_time, null); assert.equal(t[0].signal_time, '2026-10-01T08:00:00.000Z')
  const priced = applyRisk(t, 'paper'); assert.deepEqual(priced.map(x => x.signal_id), ['SYN-1', 'SYN-2']); assert.deepEqual(priced.map(x => x.pnl), [2, -1.02])
  const s = stats(t, 'paper'); assert.equal(s.closed, 2); assert.equal(s.balance, 100.98)
  assert.equal(tradeStatus({ status: 'VOID_X', exit_ts: 'x' }), 'VOID')
})
test('pending signals, account headline and header parsing', () => {
  const p = pendingSignals(SCAN); assert.equal(p.length, 1); assert.equal(p[0].status, 'PENDING'); assert.equal(p[0].sl, 150.9); assert.equal(p[0].symbol, 'frxUSDJPY')
  assert.deepEqual(pendingSignals({}), []); assert.deepEqual(pendingSignals(null), [])
  const a = account(ACCOUNT); assert.equal(a.win_rate, 0.5); assert.equal(a.next_risk_usd, 1.0098); assert.equal(account(null), null)
  assert.deepEqual(parseHeaders(STRAT), { title: 'Owner Trading Strategy', status: 'ACTIVE', version: 'v1.1' })
  assert.equal(cronState('Jobs: PROPOSED, DISABLED'), 'PROPOSED / DISABLED'); assert.equal(cronState(''), null)
})
test('reader uses latest scan, allowlist only, ignores .worktrees, caps size, caches 30 s', async () => {
  const { data, k } = dirs(); let clock = 1000
  const r = createBsgReader({ dataDir: data, knowledgeDir: k, now: () => clock })
  const s = await r.summary()
  assert.equal(s.scan.file, 'bsg_scan_20261016_2115.json'); assert.equal(s.pending.length, 1); assert.equal(s.account.current_capital, 100.98)
  assert.equal(s.strategies[0].version, 'v1.1'); assert.equal(s.strategies[0].status, 'ACTIVE')
  assert.equal(s.strategies.find(x => x.name.startsWith('Gabriel')).status, 'PROPOSED / DISABLED')
  assert.ok(!JSON.stringify(s).includes('v9.9')); assert.equal(s.trades.length, 4)
  writeFileSync(path.join(data, 'paper_account.json'), JSON.stringify({ ...ACCOUNT, current_capital: 1 }))
  assert.equal((await r.summary()).account.current_capital, 100.98); clock += 30001; assert.equal((await r.summary()).account.current_capital, 1)
  const small = createBsgReader({ dataDir: data, knowledgeDir: k, maxBytes: 10 }); const t = await small.summary()
  assert.equal(t.sources.find(x => x.file === 'open_paper_trades.json').error, 'too_large'); assert.equal(t.trades.length, 0)
  assert.throws(() => createBsgReader({ dataDir: 'relative', knowledgeDir: k }), /bsg_not_configured/)
})
test('symlink escaping the allowlisted directory is rejected', async () => {
  const { data, k, root } = dirs(); writeFileSync(path.join(root, 'secret.json'), '[{"trade_id":"LEAK"}]')
  const { rmSync } = await import('node:fs'); rmSync(path.join(data, 'open_paper_trades.json')); symlinkSync(path.join(root, 'secret.json'), path.join(data, 'open_paper_trades.json'))
  const s = await createBsgReader({ dataDir: data, knowledgeDir: k }).summary()
  assert.equal(s.trades.length, 0); assert.equal(s.sources[0].ok, false)
})
test('handler: owner auth required, GET only, exact path, 503 when nothing readable', async () => {
  const { data, k } = dirs()
  const reader = createBsgReader({ dataDir: data, knowledgeDir: k })
  const auth = async h => h === 'Bearer owner' ? { id: 'o' } : null
  const server = createServer(createBsgHandler({ authenticate: auth, reader })); await new Promise(r => server.listen(0, '127.0.0.1', r))
  const u = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(`${u}/api/bsg/summary`)).status, 401)
    const ok = await fetch(`${u}/api/bsg/summary`, { headers: { authorization: 'Bearer owner' } }); assert.equal(ok.status, 200); assert.equal((await ok.json()).trades.length, 4)
    assert.equal((await fetch(`${u}/api/bsg/summary`, { method: 'POST', headers: { authorization: 'Bearer owner' } })).status, 405)
    assert.equal((await fetch(`${u}/api/bsg/../../etc/passwd`, { headers: { authorization: 'Bearer owner' } })).status, 404)
    assert.equal((await fetch(`${u}/api/bsg/summary?file=/etc/passwd`, { headers: { authorization: 'Bearer owner' } })).status, 200)
  } finally { await new Promise(r => server.close(r)) }
  const empty = mkdtempSync(path.join(tmpdir(), 'bsg-empty-'))
  const s2 = createServer(createBsgHandler({ authenticate: auth, reader: createBsgReader({ dataDir: empty, knowledgeDir: empty }) })); await new Promise(r => s2.listen(0, '127.0.0.1', r))
  try { const r = await fetch(`http://127.0.0.1:${s2.address().port}/api/bsg/summary`, { headers: { authorization: 'Bearer owner' } }); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'bsg_sources_unavailable') } finally { await new Promise(r => s2.close(r)) }
})
test('runtime routes /api/bsg and fails closed without prerequisites', async () => {
  const { runtimeHandler } = await import('./start.js')
  const server = createServer(runtimeHandler({})); await new Promise(r => server.listen(0, '127.0.0.1', r))
  try { const r = await fetch(`http://127.0.0.1:${server.address().port}/api/bsg/summary`, { headers: { authorization: 'Bearer x' } }); assert.equal(r.status, 503) } finally { await new Promise(r => server.close(r)) }
})
