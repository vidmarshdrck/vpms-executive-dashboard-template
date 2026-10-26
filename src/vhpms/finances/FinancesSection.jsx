import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { taskApiBase } from '../backendStatus.js'
import raw from '../../../server/fixtures/finances.json'
import { adaptRpc, project } from './classify.js'
import LocalNotes from './LocalNotes.jsx'

const FIXTURE_ON = import.meta.env.VITE_FINANCES_FIXTURE === 'true'
const fixtureView = () => project(raw, { scope: 'all', limit: 100 })

function formatZmw(value) {
  return new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', currencyDisplay: 'symbol' })
    .format(Number(value) || 0)
    .replace('ZMW', 'K')
}

function formatWhen(iso) {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return '—'
  return `${new Date(time).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`
}

function categoryLabel(value) {
  if (value === 'rental_income') return 'Rental income'
  if (!value) return '—'
  return String(value).replaceAll('_', ' ')
}

function statusLabel(row) {
  if (row.direction === 'outbound') return 'Recorded'
  if (row.verification_status === 'verified') return 'Verified'
  return 'Awaiting verification'
}

function useFinances() {
  const [state, setState] = useState(() => (FIXTURE_ON ? { ready: true, ...fixtureView() } : { loading: true }))
  useEffect(() => {
    if (FIXTURE_ON) return undefined
    let live = true
    async function load() {
      try {
        const token = (await supabase?.auth.getSession())?.data?.session?.access_token
        if (!token) {
          if (live) setState({ error: 'Sign in on the Live workspace page first.' })
          return
        }
        const headers = { authorization: `Bearer ${token}` }
        const root = taskApiBase(import.meta.env).replace(/\/api\/tasks$/, '')
        const [summaryRes, entriesRes] = await Promise.all([
          fetch(`${root}/api/finances/summary`, { headers, credentials: 'omit', cache: 'no-store' }),
          fetch(`${root}/api/finances/entries`, { headers, credentials: 'omit', cache: 'no-store' }),
        ])
        if (!live) return
        if ([401, 403].includes(summaryRes.status) || [401, 403].includes(entriesRes.status)) {
          setState({ error: 'Sign in on the Live workspace page first.' })
          return
        }
        const summaryBody = summaryRes.ok ? await summaryRes.json().catch(() => null) : null
        const entriesBody = entriesRes.ok ? await entriesRes.json().catch(() => null) : null
        const adapted = adaptRpc(summaryBody, entriesBody, { scope: 'all', limit: 100 })
        if (!adapted) setState({ ready: true, ...fixtureView() })
        else setState({ ready: true, summary: adapted.summary, entries: adapted.entries })
      } catch {
        if (live) setState({ ready: true, ...fixtureView() })
      }
    }
    load()
    return () => { live = false }
  }, [])
  return state
}

function Table({ rows }) {
  if (!rows.length) return null
  return <div className="vh-bsg-scroll"><table className="vh-bsg-table"><thead><tr><th>Date</th><th>Counterparty</th><th>Category</th><th>Direction</th><th>Status</th><th>Transaction</th><th>Amount</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id || row.transaction_id} data-tid={row.transaction_id || undefined}><td>{formatWhen(row.occurred_at)}</td><td>{row.counterparty || '—'}</td><td>{categoryLabel(row.category)}</td><td>{row.direction === 'outbound' ? 'Cash out' : 'In'}</td><td>{statusLabel(row)}</td><td>{row.transaction_id || '—'}</td><td className="vh-fin-total">{formatZmw(row.amount_zmw)}</td></tr>)}</tbody></table></div>
}

function Bucket({ title, rows, empty, testId }) {
  return <section className="vh-panel" data-testid={testId}><div className="vh-section-head"><h2>{title}</h2><span className="vh-badge">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span></div>
    {rows.length ? <Table rows={rows} /> : <p className="vh-muted">{empty}</p>}</section>
}

export default function FinancesSection() {
  const [scope, setScope] = useState('all')
  const state = useFinances()
  if (!state.ready) return <section className="vh-panel"><h2>Finances</h2><p>{state.loading ? 'Loading finances…' : state.error}</p></section>
  const scoped = scope === 'all' ? state.entries : state.entries.filter((row) => row.scope === scope)
  const view = scope === 'all' ? state : project({ entries: scoped, as_of: state.summary.as_of, source: state.summary.source, freshness: state.summary.freshness }, { scope: 'all', limit: 100 })
  const summary = scope === 'all' ? state.summary : view.summary
  const entries = scope === 'all' ? state.entries : view.entries
  const incomes = entries.filter((row) => row.bucket === 'income')
  const expenses = entries.filter((row) => row.bucket === 'expense')
  const investments = entries.filter((row) => row.bucket === 'investment')
  return <>
    <div className="vh-tabs" role="group" aria-label="Finance scope">{[['all', 'All'], ['personal', 'Personal'], ['business', 'Business']].map(([id, label]) => <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)}>{label}</button>)}</div>
    <div className="vh-summary" aria-label="Finance totals">
      <div data-testid="finances-income-total"><span>Incomes</span><strong className="vh-fin-total">{formatZmw(summary.totals.incomes)}</strong><small>This period</small>{Number.isFinite(summary.verified_income) && <small>Verified payments {formatZmw(summary.verified_income)}</small>}</div>
      <div data-testid="finances-expense-total"><span>Expenses</span><strong className="vh-fin-total">{formatZmw(summary.totals.expenses)}</strong><small>This period</small></div>
      <div data-testid="finances-investment-total"><span>Investments</span><strong className="vh-fin-total">{formatZmw(summary.totals.investments)}</strong><small>This period</small></div>
    </div>
    <Bucket title="Incomes" rows={incomes} empty="No incomes recorded for this period." testId="finances-incomes" />
    <Bucket title="Expenses" rows={expenses} empty="No expenses recorded for this period." testId="finances-expenses" />
    <Bucket title="Investments" rows={investments} empty="No investments recorded for this period." testId="finances-investments" />
    <LocalNotes />
  </>
}
