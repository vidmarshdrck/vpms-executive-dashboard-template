import { useState } from 'react'
import { Donut } from './Donut.jsx'
import { closingBalances, formatMoney } from './bankBudget.js'
import { formatZmw, slicesBy } from './books.js'
import { categoryShare, compactAmount, dailyAmounts, monthSummary } from './fundsMonth.js'
import { fundsByMonth, weeklyBudget } from './veData.js'
import { monthsInPeriod, rowsInPeriod, weekOverlapsPeriod } from './reportingPeriod.js'
import { useReportingPeriod } from './TimeframePopover.jsx'

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

function Stat({ label, value, quiet = false }) {
  return <section className="card"><div className="card-body"><div className="stat-num" style={quiet ? { fontSize: 16, lineHeight: 1.35 } : { fontSize: 28 }}>{value}</div><div className="stat-desc">{label}</div></div></section>
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
      ) : <Message>{empty || `No ${center.toLowerCase()} rows were returned for this period.`}</Message>}
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

function TrendChart({ rows, period }) {
  const months = period ? monthsInPeriod(period).map((month) => {
    const bucket = fundsByMonth(rows).find((item) => item.month === month) || { month, income: 0, expense: 0 }
    return bucket
  }) : fundsByMonth(rows)
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

function periodFinance(finance, incomeRows, expenseRows) {
  const income = finance?.income == null ? null : incomeRows.reduce((sum, row) => sum + Number(row.amount), 0)
  const expenses = finance?.expenses == null ? null : expenseRows.reduce((sum, row) => sum + Number(row.amount), 0)
  const surplus = income != null && expenses != null ? income - expenses : null
  return { income, expenses, balance: surplus, profit: surplus }
}

export function MonthCalendar({ days, month }) {
  const [year, number] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7
  const label = new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>{label}</h2></div>
      <div className="card-body">
        <div className="vh-calendar-scroll" tabIndex="0" aria-label="Funds calendar">
          <div className="vh-calendar">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <strong key={day}>{day}</strong>)}
            {Array.from({ length: offset }, (_, index) => <div key={`pad-${index}`} className="vh-day vh-blank" />)}
            {days.map((day) => {
              const active = day.income || day.expense
              const tone = day.net < 0 ? 'var(--rag-red)' : 'var(--rag-green)'
              return <div key={day.date} className="vh-day"><span>{Number(day.date.slice(-2))}</span>{active ? <strong style={{ color: tone }}>{compactAmount(day.net)}</strong> : null}</div>
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export function StandardOverview({ model }) {
  const period = useReportingPeriod(model.today)
  const incomeRows = rowsInPeriod(model.incomeRows, period)
  const expenseRows = rowsInPeriod(model.expenseRows, period)
  const finance = periodFinance(model.finance, incomeRows, expenseRows)
  const bankBlocked = Boolean(model.bankNote)
  const balances = bankBlocked ? [] : closingBalances(model.bankAccounts, model.bankTransactions, period.end)
  const balanceText = bankBlocked ? '—' : (balances.length ? balances.map((line) => formatMoney(line.amount, line.currency)).join(' · ') : 'No bank account connected')
  const split = [
    Number(finance.income) > 0 ? { category: 'Income', amount: finance.income } : null,
    Number(finance.expenses) > 0 ? { category: 'Expenses', amount: finance.expenses } : null,
  ].filter(Boolean)
  return (
    <>
      <h2 className="sr-only">Overview</h2>
      <div className="grid-4" style={{ margin: '16px 0' }}>
        <Stat label="Total spent" value={moneyTile(finance.expenses)} />
        <Stat label="Income" value={moneyTile(finance.income)} />
        <Stat label="Balance on hand" value={balanceText} quiet={!bankBlocked && !balances.length} />
        <Stat label="Profit generated" value={moneyTile(finance.profit)} />
      </div>
      {model.incomeNote && <Message>{model.incomeNote}</Message>}
      {model.expenseNote && <Message>{model.expenseNote}</Message>}
      {model.bankNote && <Message>{model.bankNote}</Message>}
      <TrendChart rows={[...incomeRows, ...expenseRows]} period={period} />
      <div className="grid">
        <RankedSplit title="Income and expenses" rows={split} center="Split" empty="No income or expense total was returned." />
        <RankedSplit title="Expenses by category" rows={expenseRows} center="Expenses" empty="No expense categories were returned." />
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

export function StandardFunds({ model }) {
  const period = useReportingPeriod(model.today)
  const rows = rowsInPeriod([...model.incomeRows, ...model.expenseRows], period)
  const summary = monthSummary(rows)
  const expenseValue = model.expenseNote && !model.expenseRows.length ? null : summary.expense
  const receivedValue = model.incomeNote && !model.incomeRows.length ? null : summary.income
  const months = monthsInPeriod(period)
  const days = months.flatMap((month) => dailyAmounts(rows, month))
  return (
    <>
      <h2 className="sr-only">Funds</h2>
      {model.incomeNote && <Message>{model.incomeNote}</Message>}
      {model.expenseNote && <Message>{model.expenseNote}</Message>}
      <div className="grid-3 funds-totals" style={{ marginBottom: 16 }}>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-red)' }}>{expenseValue == null ? '—' : formatZmw(expenseValue)}</div><div className="stat-desc">Expense</div></div></section>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{receivedValue == null ? '—' : formatZmw(receivedValue)}</div><div className="stat-desc">Total received</div></div></section>
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
      {months.map((month) => <MonthCalendar key={month} month={month} days={dailyAmounts(rows, month)} />)}
      <Panel title="By account">
        <AccountBars rows={model.operations} />
        {!model.operations.filter((row) => row.amount != null && Number(row.amount) > 0).length && <Message>{model.operationsNote || 'No account amounts were returned for this business.'}</Message>}
      </Panel>
    </>
  )
}

export function StandardMarketing({ model }) {
  const period = useReportingPeriod(model.today)
  const posts = rowsInPeriod(model.posts, period)
  return (
    <>
      <h2 className="sr-only">Marketing</h2>
      {model.marketingNote ? <Message>{model.marketingNote}</Message> : (
        <Panel title="Scheduled posts">
          {posts.length ? <p className="stat-desc">{posts.length} posts recorded.</p> : <Message>No marketing rows were returned.</Message>}
        </Panel>
      )}
    </>
  )
}

export function StandardBudget({ model }) {
  const period = useReportingPeriod(model.today)
  const weeks = weeklyBudget(rowsInPeriod(model.expenseRows, period)).filter((item) => weekOverlapsPeriod(item.week, period))
  const [week, setWeek] = useState(weeks.at(-1)?.week || '')
  const selected = weeks.find((item) => item.week === week) || weeks.at(-1) || null
  return (
    <>
      <h2 className="sr-only">Budget</h2>
      {model.expenseNote ? <Message>{model.expenseNote}</Message> : (
        <Panel title="Weekly expense budget">
          {selected ? (
            <>
              {weeks.length > 1 && (
                <div className="field" style={{ maxWidth: 240 }}><label>Week
                  <select aria-label="Budget week" value={selected?.week || ''} onChange={(event) => setWeek(event.target.value)}>
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
