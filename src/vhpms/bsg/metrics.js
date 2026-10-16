// Pure, read-only BSG metrics. 1R: paper = 1% of current paper balance (start $100); demo = fixed $40.
export const START = { paper: 100, mt5_demo: 4000 }
export const DEMO_RISK = 40
export const rr = t => { const risk = Math.abs(t.entry - t.sl); return risk > 0 && t.tp != null ? Math.abs(t.tp - t.entry) / risk : null }
const closed = trades => trades.filter(t => t.status === 'CLOSED' && t.close_time).sort((a, b) => a.close_time.localeCompare(b.close_time))
// Assigns risk_usd / pnl from r_multiple for a single source, compounding paper risk on running balance.
export function applyRisk(trades, source) {
  let bal = START[source]
  return closed(trades.filter(t => t.source === source)).map(t => {
    const risk_usd = source === 'paper' ? +(bal * 0.01).toFixed(4) : DEMO_RISK
    const pnl = t.pnl != null ? t.pnl : +(t.r_multiple * risk_usd).toFixed(2)
    bal += pnl
    return { ...t, risk_usd, pnl, r_multiple: t.r_multiple ?? +(pnl / risk_usd).toFixed(2), balance_after: +bal.toFixed(2) }
  })
}
export function equityCurve(trades, source) {
  const pts = [{ time: null, balance: START[source], drawdown: 0 }]
  let peak = START[source]
  for (const t of applyRisk(trades, source)) { peak = Math.max(peak, t.balance_after); pts.push({ time: t.close_time, balance: t.balance_after, drawdown: +((t.balance_after - peak) / peak * 100).toFixed(2) }) }
  return pts
}
export function stats(trades, source) {
  const c = applyRisk(trades, source), curve = equityCurve(trades, source)
  const wins = c.filter(t => t.pnl > 0).length
  return { closed: c.length, open: trades.filter(t => t.source === source && t.status === 'OPEN').length,
    winRate: c.length ? wins / c.length : null, avgR: c.length ? c.reduce((s, t) => s + t.r_multiple, 0) / c.length : null,
    pnl: +c.reduce((s, t) => s + t.pnl, 0).toFixed(2), maxDrawdownPct: Math.min(0, ...curve.map(p => p.drawdown)),
    balance: curve.at(-1).balance, sampleOk: c.length >= 20 }
}
export function groupPnl(trades, source, key) {
  const m = new Map()
  for (const t of applyRisk(trades, source)) { const k = key === 'day' ? t.close_time.slice(0, 10) : t[key]; m.set(k, +((m.get(k) || 0) + t.pnl).toFixed(2)) }
  return [...m].map(([k, pnl]) => ({ key: k, pnl })).sort((a, b) => String(a.key).localeCompare(String(b.key)))
}
export const latencySeconds = t => t.signal_time && t.order_time ? (Date.parse(t.order_time) - Date.parse(t.signal_time)) / 1000 : null
