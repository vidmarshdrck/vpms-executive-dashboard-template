import { useState } from 'react'
import { Donut } from './Donut.jsx'
import { formatMoney } from './bankBudget.js'
import { formatZmw, slicesBy } from './books.js'
import { categoryShare, dailyAmounts, latestMonth, monthLabel, monthRows, monthSummary, shiftMonth } from './fundsMonth.js'
import { fundsByMonth } from './veData.js'

export function Panel({ title, children, note }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>{title}</h2></div>
      <div className="card-body">
        {note && <p className="stat-desc">{note}</p>}
        {children}
      </div>
    </section>
  )
}

export function Message({ children }) {
  return <p className="empty">{children}</p>
}

function Stat({ label, value }) {
  return <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{value}</div><div className="stat-desc">{label}</div></div></section>
}

function moneyTile(value) {
  return value == null ? '—' : formatZmw(value)
}

function RankedSplit({ title, rows, center, empty }) {
  const share = categoryShare(rows)
  const slices = slicesBy(share.map((item) => ({ group: item.name, amount: item.amount })), 'group')
  const max = Math.max(...share.map((item) => item.amount), 1)
  return (
    <Panel title={title}>
      {share.length ? (
        <>
          <Donut items={slices} center={center} format={formatZmw} />
          <ul className="vh-list" aria-label={`${title} ranking`}>
            {share.map((item) => (
              <li key={item.name}>
                <div style={{ flex: 1 }}>
                  <strong>{item.name}</strong>
                  <span style={{ display: 'block', height: 8, marginTop: 6, borderRadius: 99, background: 'var(--surface-2)' }}><span style={{ display: 'block', height: '100%', width: `${(item.amount / max) * 100}%`, borderRadius: 99, background: 'var(--brand)' }} /></span>
                </div>
                <b>{formatZmw(item.amount)} · {Math.round(item.pct)}%</b>
              </li>
            ))}
          </ul>
        </>
      ) : <Message>{empty || `No ${center.toLowerCase()} rows were returned for this month.`}</Message>}
    </Panel>
  )
}

function FlowChart({ title, days, field, color }) {
  const width = 640
  const height = 180
  const max = Math.max(...days.map((day) => day[field]), 1)
  const points = days.map((day, index) => {
    const x = days.length === 1 ? width / 2 : (index / (days.length - 1)) * width
    const y = height - 16 - (day[field] / max) * (height - 32)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <Panel title={title}>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <polyline fill="none" stroke={color} strokeWidth="3" points={points} />
      </svg>
    </Panel>
  )
}

function TrendChart({ rows }) {
  const months = fundsByMonth(rows)
  const width = 640
  const height = 180
  const max = Math.max(...months.flatMap((month) => [month.income, month.expense]), 1)
  const line = (field, color) => {
    const points = months.map((month, index) => {
      const x = months.length === 1 ? width / 2 : (index / (months.length - 1)) * width
      const y = height - 16 - (month[field] / max) * (height - 32)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    return <polyline key={field} fill="none" stroke={color} strokeWidth="3" points={points} />
  }
  return (
    <Panel title="Monthly flow">
      {months.length ? (
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Income and expense by month">
          {line('income', 'var(--rag-green)')}
          {line('expense', 'var(--rag-red)')}
        </svg>
      ) : <Message>No dated income or expense rows were returned.</Message>}
    </Panel>
  )
}

export function AccountBars({ rows, label = 'Amount by item' }) {
  const measured = rows.filter((row) => row.amount != null && Number(row.amount) > 0)
  const max = Math.max(...measured.map((row) => Number(row.amount)), 1)
  if (!measured.length) return null
  return (
    <div role="img" aria-label={label}>
      {measured.map((row) => (
        <div key={row.id} style={{ margin: '12px 0' }}>
          <strong>{row.title}</strong>
          <span style={{ display: 'block', height: 10, marginTop: 6, borderRadius: 99, background: 'var(--brand)', width: `${(Number(row.amount) / max) * 100}%` }} />
          <small>{row.unit === 'USD' || row.unit === 'ZMW' ? formatMoney(row.amount, row.unit) : `${row.amount} ${row.unit || ''}`.trim()}</small>
        </div>
      ))}
    </div>
  )
}

function StatusShare({ rows, empty, center }) {
  const counts = new Map()
  for (const row of rows || []) {
    const name = row.status || 'Unspecified'
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  const share = [...counts.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const total = share.reduce((sum, item) => sum + item.amount, 0)
  const slices = slicesBy(share.map((item) => ({ group: item.name, amount: item.amount })), 'group')
  if (!slices.length) return <Message>{empty}</Message>
  return (
    <>
      <Donut items={slices} center={center} format={(value) => String(value)} />
      <ul className="vh-list" aria-label="Status ranking">
        {share.map((item) => (
          <li key={item.name}>
            <div style={{ flex: 1 }}>
              <strong>{item.name}</strong>
              <span style={{ display: 'block', height: 8, marginTop: 6, borderRadius: 99, background: 'var(--surface-2)' }}><span style={{ display: 'block', height: '100%', width: `${(item.amount / total) * 100}%`, borderRadius: 99, background: 'var(--brand)' }} /></span>
            </div>
            <b>{item.amount} · {Math.round((item.amount / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </>
  )
}

export function StandardOverview({ model }) {
  const split = [
    Number(model.finance.income) > 0 ? { category: 'Income', amount: model.finance.income } : null,
    Number(model.finance.expenses) > 0 ? { category: 'Expenses', amount: model.finance.expenses } : null,
  ].filter(Boolean)
  return (
    <>
      <h2 className="sr-only">Overview</h2>
      <div className="grid-4" style={{ margin: '16px 0' }}>
        <Stat label="Total spent" value={moneyTile(model.finance.expenses)} />
        <Stat label="Income" value={moneyTile(model.finance.income)} />
        <Stat label="Balance on hand" value={moneyTile(model.finance.balance)} />
        <Stat label="Profit generated" value={moneyTile(model.finance.profit)} />
      </div>
      {model.incomeNote && <Message>{model.incomeNote}</Message>}
      {model.expenseNote && <Message>{model.expenseNote}</Message>}
      <TrendChart rows={[...model.incomeRows, ...model.expenseRows]} />
      <div className="grid">
        <RankedSplit title="Income and expenses" rows={split} center="Split" empty="No income or expense total was returned." />
        <RankedSplit title="Expenses by category" rows={model.expenseRows} center="Expenses" empty="No expense categories were returned." />
      </div>
      <div className="grid">
        <Panel title="Operations" note={model.operationsNote}>
          <StatusShare rows={model.operations} center="Operations" empty={model.operationsNote || 'No operations rows were returned.'} />
          {model.upcoming.length ? (
            <ul className="vh-list" aria-label="Upcoming due items">
              {model.upcoming.slice(0, 5).map((row) => <li key={row.id}><div><strong>{row.title}</strong><small>Due {row.due}</small></div></li>)}
            </ul>
          ) : null}
        </Panel>
        <Panel title="Clients" note={model.clientsNote}>
          <StatusShare rows={model.clients} center="Clients" empty={model.clientsNote || 'No client rows were returned.'} />
        </Panel>
      </div>
    </>
  )
}

export function MonthNav({ month, onMonth }) {
  return (
    <div className="vh-actions">
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}>Previous</button>
      <strong aria-live="polite">{monthLabel(month)}</strong>
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Next month" onClick={() => onMonth(shiftMonth(month, 1))}>Next</button>
    </div>
  )
}

export function StandardFunds({ model }) {
  const dated = [...model.incomeRows, ...model.expenseRows].map((row) => row.date)
  const [month, setMonth] = useState(() => latestMonth(dated, model.today))
  const rows = monthRows([...model.incomeRows, ...model.expenseRows], month)
  const summary = monthSummary(rows)
  const expenseValue = model.expenseNote && !model.expenseRows.length ? null : summary.expense
  const incomeValue = model.incomeNote && !model.incomeRows.length ? null : summary.income
  const totalValue = expenseValue == null || incomeValue == null ? null : incomeValue - expenseValue
  const days = dailyAmounts(rows, month)
  return (
    <>
      <div className="topbar">
        <h2 className="sr-only">Funds</h2>
        <MonthNav month={month} onMonth={setMonth} />
      </div>
      {model.incomeNote && <Message>{model.incomeNote}</Message>}
      {model.expenseNote && <Message>{model.expenseNote}</Message>}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-red)' }}>{expenseValue == null ? '—' : formatZmw(expenseValue)}</div><div className="stat-desc">Expense</div></div></section>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-green)' }}>{incomeValue == null ? '—' : formatZmw(incomeValue)}</div><div className="stat-desc">Income</div></div></section>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{totalValue == null ? '—' : formatZmw(totalValue)}</div><div className="stat-desc">Total</div></div></section>
      </div>
      {rows.length ? (
        <>
          <div className="grid">
            <RankedSplit title="Expense overview" rows={rows.filter((row) => row.kind === 'expense')} center="Expenses" />
            <RankedSplit title="Income overview" rows={rows.filter((row) => row.kind === 'income')} center="Income" />
          </div>
          <div className="grid">
            <FlowChart title="Expense flow" days={days} field="expense" color="var(--rag-red)" />
            <FlowChart title="Income flow" days={days} field="income" color="var(--rag-green)" />
          </div>
        </>
      ) : null}
      <Panel title="By account">
        <AccountBars rows={model.operations} />
        {!model.operations.filter((row) => row.amount != null && Number(row.amount) > 0).length && <Message>{model.operationsNote || 'No account amounts were returned for this business.'}</Message>}
      </Panel>
    </>
  )
}

export function StandardMarketing({ model }) {
  return (
    <>
      <h2 className="sr-only">Marketing</h2>
      {model.marketingNote ? <Message>{model.marketingNote}</Message> : (
        <Panel title="Scheduled posts">
          {model.posts?.length ? <p className="stat-desc">{model.posts.length} posts recorded.</p> : <Message>No marketing rows were returned.</Message>}
        </Panel>
      )}
    </>
  )
}

export function StandardBudget({ model }) {
  const weeks = model.weeks || []
  const [week, setWeek] = useState(weeks.at(-1)?.week || '')
  const selected = weeks.find((item) => item.week === week) || null
  return (
    <>
      <h2 className="sr-only">Budget</h2>
      {model.expenseNote ? <Message>{model.expenseNote}</Message> : (
        <Panel title="Weekly expense budget">
          {selected ? (
            <>
              {weeks.length > 1 && (
                <div className="field" style={{ maxWidth: 240 }}><label>Week
                  <select aria-label="Budget week" value={week} onChange={(event) => setWeek(event.target.value)}>
                    {weeks.map((item) => <option key={item.week} value={item.week}>Week of {item.week}</option>)}
                  </select>
                </label></div>
              )}
              <ul className="vh-list">
                {selected.categories.map((row) => <li key={row.name}><div><strong>{row.name}</strong><small>{formatZmw(row.amount)}</small></div></li>)}
              </ul>
              <p className="stat-desc">Week total {formatZmw(selected.total)}</p>
            </>
          ) : <Message>No expenses recorded this week.</Message>}
        </Panel>
      )}
    </>
  )
}
