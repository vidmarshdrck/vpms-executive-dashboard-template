// FIXTURE DATA: synthetic, deterministic, NOT real trades. Used only when VITE_BSG_FIXTURE=true.
const SYMBOLS = [['EURUSD', 1.0850, 0.0020], ['XAUUSD', 2400, 8], ['Volatility 75 Index', 350000, 1500], ['GBPJPY', 192.5, 0.35]]
function rng(seed) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 }
function make(source, n, seed, start) {
  const r = rng(seed), out = []
  for (let i = 0; i < n; i++) {
    const [symbol, base, dist] = SYMBOLS[i % SYMBOLS.length], dir = r() > 0.5 ? 'BUY' : 'SELL', s = dir === 'BUY' ? 1 : -1
    const entry = +(base * (1 + (r() - 0.5) * 0.01)).toPrecision(7), sl = +(entry - s * dist).toPrecision(7), tp = +(entry + s * dist * 2).toPrecision(7)
    const sig = new Date(start + i * 14 * 3600e3), open = i >= n - 2
    const win = r() < 0.45, rMul = win ? 2 : (r() < 0.15 ? 0 : -1)
    out.push({ signal_id: `FX-${source === 'paper' ? 'P' : 'D'}${String(i + 1).padStart(3, '0')}`, source, strategy: i % 3 === 2 ? 'FAKE Samson bear filter' : 'FAKE TTrades fractal', strategy_version: i % 3 === 2 ? 'v0.0-fixture' : 'v1.1-fixture',
      symbol, direction: dir, entry, sl, tp, signal_time: sig.toISOString(), order_time: source === 'mt5_demo' ? new Date(sig.getTime() + (1 + Math.floor(r() * 6)) * 1000).toISOString() : null,
      status: open ? 'OPEN' : 'CLOSED', close_time: open ? null : new Date(sig.getTime() + (3 + Math.floor(r() * 20)) * 3600e3).toISOString(), r_multiple: open ? null : rMul, pnl: null })
  }
  return out
}
export const bsgFixture = {
  fixture: true, generated_at: '2026-10-16T21:00:00Z',
  trades: [...make('paper', 30, 42, Date.parse('2026-09-21T08:00:00Z')), ...make('mt5_demo', 6, 7, Date.parse('2026-10-12T08:00:00Z'))],
  strategies: [
    { name: 'FAKE TTrades fractal', version: 'v1.1-fixture', status: 'ACTIVE', file: 'fixture/owner_trading_strategy.md', roles: 'Boaz verifies · Gideon bull case · Samson bear case · Gabriel (fixture)' },
    { name: 'FAKE Samson bear filter', version: 'v0.0-fixture', status: 'TRIAL', file: 'fixture/samson_bear.md', roles: 'Samson adversarial review (fixture)' },
  ],
}
