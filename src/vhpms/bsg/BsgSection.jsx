import { useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { bsgFixture } from './fixture.js'
import { applyRisk, equityCurve, stats, groupPnl, rr, latencySeconds } from './metrics.js'
export const FIXTURE_ON = import.meta.env.VITE_BSG_FIXTURE === 'true'
const usd = n => n == null ? '—' : `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
const pct = n => n == null ? '—' : `${(n * 100).toFixed(1)}%`
const SRC = { paper: 'Paper ($100, 1R = 1% balance)', mt5_demo: 'MT5 demo 6345797 ($4,000, 1R = $40)' }
export function FixtureBanner() { return <div role="alert" className="vh-bsg-fixture">FIXTURE DATA, not real trades</div> }
function Trades({ data }) {
  const [src, setSrc] = useState('all'), [status, setStatus] = useState('all')
  const priced = useMemo(() => { const m = new Map([...applyRisk(data.trades, 'paper'), ...applyRisk(data.trades, 'mt5_demo')].map(t => [t.signal_id, t])); return data.trades.map(t => m.get(t.signal_id) || t) }, [data])
  const rows = priced.filter(t => (src === 'all' || t.source === src) && (status === 'all' || t.status === status))
  return <section className="vh-panel"><div className="vh-section-head"><h2>Trades</h2><span className="vh-badge">{rows.length} rows · read-only</span></div>
    <div className="vh-tabs" role="group" aria-label="Trade filters">{['all', 'paper', 'mt5_demo'].map(s => <button key={s} aria-pressed={src === s} onClick={() => setSrc(s)}>{s === 'all' ? 'All sources' : s === 'paper' ? 'Paper' : 'MT5 demo'}</button>)}{['all', 'OPEN', 'CLOSED'].map(s => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'Any status' : s}</button>)}</div>
    <div className="vh-bsg-scroll"><table className="vh-bsg-table"><thead><tr><th>Signal ID</th><th>Symbol</th><th>Dir</th><th>Entry</th><th>SL</th><th>TP</th><th>RR</th><th>Signal → order</th><th>Status</th><th>P&L</th></tr></thead>
      <tbody>{rows.map(t => { const lat = latencySeconds(t); return <tr key={t.signal_id}><td>{t.signal_id}</td><td>{t.symbol}</td><td>{t.direction}</td><td>{t.entry}</td><td>{t.sl}</td><td>{t.tp}</td><td>{rr(t)?.toFixed(2) ?? '—'}</td><td>{t.signal_time.slice(0, 16).replace('T', ' ')}{lat != null ? ` (+${lat}s)` : ' · no order (paper)'}</td><td>{t.status}</td><td className={t.pnl > 0 ? 'vh-pos' : t.pnl < 0 ? 'vh-neg' : ''}>{t.status === 'CLOSED' ? `${usd(t.pnl)} (${t.r_multiple >= 0 ? '+' : ''}${t.r_multiple}R)` : '—'}</td></tr> })}</tbody></table></div></section>
}
function Performance({ data }) {
  return <>{['paper', 'mt5_demo'].map(src => { const s = stats(data.trades, src), curve = equityCurve(data.trades, src).map((p, i) => ({ ...p, n: i }))
    return <section key={src} className="vh-panel"><div className="vh-section-head"><h2>{SRC[src]}</h2>{!s.sampleOk && <span className="vh-badge pending">Insufficient sample ({s.closed} closed)</span>}</div>
      <div className="vh-summary"><div><span>Closed-trade balance</span><strong>{usd(s.balance)}</strong><small>{s.open} open</small></div><div><span>Win rate</span><strong>{pct(s.winRate)}</strong><small>{s.closed} closed</small></div><div><span>Avg R</span><strong>{s.avgR == null ? '—' : s.avgR.toFixed(2)}</strong><small>P&L {usd(s.pnl)}</small></div><div><span>Max drawdown</span><strong>{s.maxDrawdownPct.toFixed(2)}%</strong><small>From closed trades</small></div></div>
      <div className="vh-bsg-charts"><div><h3>Balance</h3><ResponsiveContainer width="100%" height={200}><LineChart data={curve}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="n" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Line dataKey="balance" stroke="#1E4DFF" dot={false} /></LineChart></ResponsiveContainer></div>
        <div><h3>Drawdown %</h3><ResponsiveContainer width="100%" height={200}><LineChart data={curve}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="n" /><YAxis /><Tooltip /><Line dataKey="drawdown" stroke="#B91C1C" dot={false} /></LineChart></ResponsiveContainer></div>
        <div><h3>P&L by day</h3><ResponsiveContainer width="100%" height={200}><BarChart data={groupPnl(data.trades, src, 'day')}><XAxis dataKey="key" /><YAxis /><Tooltip /><Bar dataKey="pnl" fill="#1E4DFF" /></BarChart></ResponsiveContainer></div>
        <div><h3>P&L by symbol</h3><ResponsiveContainer width="100%" height={200}><BarChart data={groupPnl(data.trades, src, 'symbol')}><XAxis dataKey="key" /><YAxis /><Tooltip /><Bar dataKey="pnl" fill="#1E4DFF" /></BarChart></ResponsiveContainer></div></div></section> })}</>
}
function Strategies({ data }) {
  return <section className="vh-panel"><h2>Strategies</h2><p className="vh-muted">Read-only. No enable, edit or trade controls.</p><ul className="vh-list">{data.strategies.map(st => { const own = data.trades.filter(t => t.strategy === st.name)
    const p = stats(own, 'paper'), d = stats(own, 'mt5_demo')
    return <li key={st.name}><div><strong>{st.name} · {st.version}</strong><small>{st.status} · {st.file}</small><small>{st.roles}</small><small>Paper: {p.closed} closed · win {pct(p.winRate)} · avg R {p.avgR?.toFixed(2) ?? '—'} · {usd(p.pnl)} | Demo: {d.closed} closed · win {pct(d.winRate)} · avg R {d.avgR?.toFixed(2) ?? '—'} · {usd(d.pnl)}</small></div><span className="vh-badge">{st.status}</span></li> })}</ul></section>
}
export default function BsgSection() {
  const [tab, setTab] = useState('Trades')
  if (!FIXTURE_ON) return <section className="vh-panel"><h2>BSG data not connected</h2><p>The read-only /api/bsg/summary endpoint is not deployed yet. No trade data is shown.</p></section>
  const data = bsgFixture
  return <><FixtureBanner /><div className="vh-tabs" role="group" aria-label="BSG views">{['Trades', 'Performance', 'Strategies'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
    {tab === 'Trades' && <Trades data={data} />}{tab === 'Performance' && <Performance data={data} />}{tab === 'Strategies' && <Strategies data={data} />}</>
}
