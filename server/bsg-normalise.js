// Pure normalisers: BSG server JSON → VHPMS UI shapes. Missing values stay null; nothing is invented.
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v)
const iso = v => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v); return Number.isFinite(n) ? new Date(n).toISOString() : null }
const dir = d => { const s = String(d || '').toUpperCase(); return s.startsWith('B') || s === 'LONG' ? 'BUY' : s.startsWith('S') || s === 'SHORT' ? 'SELL' : null }
export const strategyName = v => `TTrades fractal ${v || 'unversioned'}`
export function tradeStatus(t) {
  const s = String(t.status || '').toUpperCase()
  if (s.startsWith('VOID')) return 'VOID'
  if (s === 'OPEN' || s === 'ACTIVE' || s === 'PENDING') return t.exit_ts ? 'CLOSED' : 'OPEN'
  if (t.exit_ts || ['CLOSED', 'WIN', 'LOSS', 'BREAKEVEN', 'BE', 'TP', 'SL'].includes(s)) return 'CLOSED'
  return 'OPEN'
}
export function normaliseTrade(t) {
  const status = tradeStatus(t), entry = num(t.entry), sl = num(t.stop), tp = num(t.target)
  return {
    signal_id: String(t.trade_id ?? ''), source: 'paper', strategy: strategyName(t.strategy_version), strategy_version: t.strategy_version ?? null,
    symbol: t.symbol ?? null, name: t.name ?? null, direction: dir(t.direction), bias: t.bias ?? null, bias_tf: t.bias_tf ?? null, entry_tf: t.entry_tf ?? null,
    entry, sl, tp, rr: num(t.rr), structure: t.structure ?? null, signal_time: iso(t.open_ts), order_time: null, raw_status: t.status ?? null, status,
    close_time: status === 'CLOSED' ? iso(t.exit_ts) : null,
    // Voided trades keep their original outcome for display only; metrics exclude them (status !== 'CLOSED').
    r_multiple: status === 'CLOSED' ? num(t.r_multiple ?? t.result_r ?? t.original_r_multiple) : null, pnl: status === 'CLOSED' ? num(t.pnl) : null,
    void_reason: status === 'VOID' ? (t.void_reason ?? null) : null, original_result: t.original_result ?? null, original_r_multiple: num(t.original_r_multiple),
    mode: t.mode ?? null, originating_agent: t.originating_agent ?? null, opposing_agent: t.opposing_agent ?? null, boaz_decision: t.boaz_decision ?? null,
  }
}
export const normaliseTrades = raw => (Array.isArray(raw) ? raw : []).filter(t => t && typeof t === 'object' && t.trade_id != null).map(normaliseTrade)
export function pendingSignals(scan) {
  if (!scan || !Array.isArray(scan.setups)) return []
  return scan.setups.filter(s => s && typeof s === 'object').map(s => ({
    signal_id: s.trade_id != null ? String(s.trade_id) : null, symbol: s.symbol ?? null, direction: dir(s.direction), entry: num(s.entry), sl: num(s.stop), tp: num(s.target),
    rr: num(s.rr), structure: s.structure ?? null, current: num(s.current), protected_high: num(s.protected_high), bias: s.bias ?? null, bias_tf: s.bias_tf ?? null,
    entry_tf: s.entry_tf ?? null, strategy_version: s.strategy_version ?? null, scan_time: iso(s.scan_ts ?? scan.ts), status: 'PENDING',
  }))
}
export function account(a) {
  if (!a || typeof a !== 'object') return null
  const closed = num(a.trades_closed), wins = num(a.wins)
  return { starting_capital: num(a.starting_capital), current_capital: num(a.current_capital), risk_pct: num(a.risk_pct), trades_closed: closed, wins, losses: num(a.losses),
    last_trade_pnl: num(a.last_trade_pnl), win_rate: closed ? wins / closed : null, next_risk_usd: num(a.current_capital) != null && num(a.risk_pct) != null ? +(a.current_capital * a.risk_pct).toFixed(4) : null }
}
export function parseHeaders(md) {
  const text = String(md || '')
  const field = k => text.match(new RegExp(`\\*\\*${k}:?\\*\\*:?\\s*([^\\n]+)`, 'i'))?.[1].trim() ?? null
  const title = text.match(/^#\s+(.+)$/m)?.[1].trim() ?? null
  const status = field('Status'), version = field('Strategy Version') ?? field('Version')
  return { title, status: status ? status.split(/\s+[—–-]\s+/)[0].trim() : null, version: version ? version.match(/v?\d+(\.\d+)*/i)?.[0] ?? version : null }
}
export function cronState(md) {
  const found = [...new Set((String(md || '').toUpperCase().match(/\b(PROPOSED|DISABLED|ENABLED|ACTIVE|PAUSED)\b/g)) || [])]
  return found.length ? found.join(' / ') : null
}
