import { useState } from 'react'
import { Donut } from './Donut.jsx'
import { balancesByAccount, closingBalances, formatMoney, formatRate } from './bankBudget.js'
import { formatZmw, slicesBy } from './books.js'
import { categoryShare, compactAmount, dailyAmounts, monthLabel, monthSummary, sourceAnalysis } from './fundsMonth.js'
import { NavIcon } from './icons.jsx'
import { monthsInPeriod, rowsInPeriod, weekOverlapsPeriod } from './reportingPeriod.js'
import { useReportingPeriod } from './TimeframePopover.jsx'
import { COPY, acquisitionSummary, weeklyBudget } from './veData.js'
import { SECTION_EMPTY, accountCaption, displayNote, formatThousands, isNeedsNote, moneyHidden, monthStripRows } from './workspaceCharts.js'

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

export function EmptyState({ icon = 'layers', children }) {
  return <p className="empty-state"><NavIcon name={icon} /><span>{children}</span></p>
}

function SectionHeading({ icon, children }) {
  return <h2 className="section-title"><NavIcon name={icon} />{children}</h2>
}

function Stat({ label, value, quiet = false }) {
  return <section className="card"><div className="card-body"><div className="stat-num" style={quiet ? { fontSize: 16, lineHeight: 1.35 } : { fontSize: 28 }}>{value}</div><div className="stat-desc">{label}</div></div></section>
}

function moneyTile(value) {
  return value == null ? '—' : formatZmw(value)
}

function StatusChip({ value }) {
  const key = String(value || '').toLowerCase()
  const tone = key === 'overdue' ? 'red' : /unpaid|inactive|disconnected/.test(key) ? 'amber' : /active|connected|paid|published|scheduled/.test(key) ? 'green' : 'na'
  return <span className={`chip ${tone}`}>{value}</span>
}

function DataTable({ columns, rows, empty }) {
  return (
    <div className="tbl-scroll">
      <table className="data">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.cell(row)}</td>)}</tr>) : <tr><td colSpan={columns.length}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function RankedSplit({ title, rows, center, empty, format = formatThousands }) {
  const share = categoryShare(rows)
  const slices = slicesBy(share.map((item) => ({ group: item.name, amount: item.amount })), 'group')
  const max = Math.max(...share.map((item) => item.amount), 1)
  return (
    <Panel title={title}>
      {share.length ? (
        <>
          <Donut items={slices} center={center} format={format} />
          <ul className="vh-list" aria-label={`${title} ranking`}>
            {share.map((item) => (
              <li key={item.name}>
                <div style={{ flex: 1 }}>
                  <strong>{item.name}</strong>
                  <span className="bar-track" style={{ marginTop: 6 }}><span className="bar-fill" style={{ width: `${(item.amount / max) * 100}%` }} /></span>
                </div>
                <b>{format(item.amount)} · {Math.round(item.pct)}%</b>
              </li>
            ))}
          </ul>
        </>
      ) : <EmptyState icon="pie">{empty || `No ${center.toLowerCase()} rows were returned for this period.`}</EmptyState>}
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

export function AccountBars({ rows, label = 'Amount by item' }) {
  const measured = rows.filter((row) => row.amount != null && Number(row.amount) > 0)
  const max = Math.max(...measured.map((row) => Number(row.amount)), 1)
  if (!measured.length) return null
  return (
    <div role="img" aria-label={label}>
      {measured.map((row) => (
        <div key={row.id} style={{ margin: '12px 0' }}>
          <strong>{row.title}</strong>
          <span className="bar-track" style={{ marginTop: 6, width: `${(Number(row.amount) / max) * 100}%`, background: 'var(--brand)' }} />
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
  if (!slices.length) return <EmptyState icon="activity">{empty}</EmptyState>
  return (
    <>
      <Donut items={slices} center={center} format={(value) => String(value)} />
      <ul className="vh-list" aria-label="Status ranking">
        {share.map((item) => (
          <li key={item.name}>
            <div style={{ flex: 1 }}>
              <strong>{item.name}</strong>
              <span className="bar-track" style={{ marginTop: 6 }}><span className="bar-fill" style={{ width: `${(item.amount / total) * 100}%` }} /></span>
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

function MonthStrip({ rows, months }) {
  const items = monthStripRows(rows, months)
  return (
    <Panel title="Month strip">
      <div className="month-strip" role="img" aria-label="Month strip">
        {items.map((item) => (
          <article key={item.month}>
            <span>{item.label}</span>
            <strong>{formatThousands(item.income - item.expense)}</strong>
            <small>In {formatThousands(item.income)}</small>
            <small>Out {formatThousands(item.expense)}</small>
          </article>
        ))}
      </div>
    </Panel>
  )
}

function DailyBars({ days }) {
  const width = 720
  const height = 220
  const padL = 72
  const padB = 28
  const padT = 12
  const plotW = width - padL - 8
  const plotH = height - padB - padT
  const max = Math.max(...days.flatMap((day) => [day.income, day.expense]), 1)
  const slot = plotW / Math.max(days.length, 1)
  const ticks = [max, max / 2, 0]
  return (
    <Panel title="Daily bars">
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily bars">
        {ticks.map((tick) => {
          const y = padT + plotH - (tick / max) * plotH
          return (
            <g key={tick}>
              <line x1={padL} x2={width - 8} y1={y} y2={y} stroke="var(--border)" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{formatThousands(tick)}</text>
            </g>
          )
        })}
        {days.map((day, index) => {
          const x = padL + index * slot
          const barW = Math.max(slot * 0.28, 1)
          const incomeH = (day.income / max) * plotH
          const expenseH = (day.expense / max) * plotH
          const showLabel = day.date.endsWith('-01') || day.date.endsWith('-15')
          return (
            <g key={day.date}>
              <rect x={x} y={padT + plotH - incomeH} width={barW} height={Math.max(incomeH, 0)} fill="var(--rag-green)"><title>{`${day.date} income ${formatThousands(day.income)}`}</title></rect>
              <rect x={x + barW + 1} y={padT + plotH - expenseH} width={barW} height={Math.max(expenseH, 0)} fill="var(--rag-red)"><title>{`${day.date} expense ${formatThousands(day.expense)}`}</title></rect>
              {showLabel ? <text x={x} y={height - 8} fontSize="10" fill="var(--text-muted)">{Number(day.date.slice(-2))}</text> : null}
            </g>
          )
        })}
      </svg>
      <div className="legend"><span><i className="dot" style={{ background: 'var(--rag-green)' }} />Income</span><span><i className="dot" style={{ background: 'var(--rag-red)' }} />Expense</span></div>
    </Panel>
  )
}

function ByAccountBars({ rows }) {
  const max = Math.max(...rows.map((row) => Math.abs(Number(row.amount))), 1)
  return (
    <Panel title="By account">
      <div role="img" aria-label="By account">
        {rows.map((row) => (
          <div className="bar-row" key={row.id}>
            <strong>{accountCaption(row)}</strong>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(Math.abs(Number(row.amount)) / max) * 100}%` }} /></span>
            <b className="bar-value">{formatThousands(row.amount, row.currency)}</b>
          </div>
        ))}
      </div>
    </Panel>
  )
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

function uniqueNotes(notes) {
  return [...new Set(notes.filter(Boolean))]
}

export function StandardOverview({ model }) {
  const period = useReportingPeriod(model.today)
  const incomeRows = rowsInPeriod(model.incomeRows, period)
  const expenseRows = rowsInPeriod(model.expenseRows, period)
  const finance = periodFinance(model.finance, incomeRows, expenseRows)
  const bankBlocked = Boolean(model.bankNote)
  const balances = bankBlocked ? [] : closingBalances(model.bankAccounts, model.bankTransactions, period.end)
  const accountRows = bankBlocked ? [] : balancesByAccount(model.bankAccounts, model.bankTransactions, period.end)
  const balanceText = bankBlocked ? '—' : (balances.length ? balances.map((line) => formatMoney(line.amount, line.currency)).join(' · ') : 'No bank account connected')
  const moneyRows = [...incomeRows, ...expenseRows]
  const showCharts = moneyRows.length > 0 || accountRows.length > 0
  const categoryRows = expenseRows.length ? expenseRows : incomeRows
  const categoryTitle = expenseRows.length ? 'Expenses by category' : 'Income by category'
  const quietNotes = uniqueNotes([
    moneyHidden(model.incomeNote) ? displayNote(model.incomeNote, SECTION_EMPTY.income) : '',
    moneyHidden(model.expenseNote) ? displayNote(model.expenseNote, SECTION_EMPTY.expenses) : '',
    model.bankNote || '',
  ])
  const months = monthsInPeriod(period)
  return (
    <>
      <h2 className="sr-only">Overview</h2>
      <section aria-label="Finances">
        <SectionHeading icon="wallet">Finances</SectionHeading>
        <div className="grid-4" style={{ margin: '16px 0' }}>
          <Stat label="Total spent" value={moneyTile(finance.expenses)} />
          <Stat label="Income" value={moneyTile(finance.income)} />
          <Stat label="Balance on hand" value={balanceText} quiet={!bankBlocked && !balances.length} />
          <Stat label="Profit generated" value={moneyTile(finance.profit)} />
        </div>
        {quietNotes.map((note) => <EmptyState key={note} icon="wallet">{note}</EmptyState>)}
        {showCharts && moneyRows.length ? (
          <>
            <MonthStrip rows={moneyRows} months={months} />
            <div className="grid">
              <RankedSplit title={categoryTitle} rows={categoryRows} center={expenseRows.length ? 'Expenses' : 'Income'} empty="No categories were returned for this period." />
              <DailyBars days={months.flatMap((month) => dailyAmounts(moneyRows, month))} />
            </div>
          </>
        ) : null}
        {showCharts && accountRows.length ? <ByAccountBars rows={accountRows} /> : null}
        {showCharts && moneyRows.length && !accountRows.length ? <EmptyState icon="landmark">{SECTION_EMPTY.accounts}</EmptyState> : null}
        {!showCharts && !quietNotes.length ? <EmptyState icon="wallet">{displayNote(model.expenseNote || model.incomeNote, 'No income or expenses were returned for this period.') || 'No income or expenses were returned for this period.'}</EmptyState> : null}
      </section>
      <section aria-label="Operations">
        <SectionHeading icon="activity">Operations</SectionHeading>
        {model.operations.length ? (
          <Panel title="Status">
            <StatusShare rows={model.operations} center="Status" empty={displayNote(model.operationsNote, SECTION_EMPTY.operations)} />
            {model.upcoming.length ? (
              <ul className="vh-list" aria-label="Upcoming due items">
                {model.upcoming.slice(0, 5).map((row) => <li key={row.id}><div><strong>{row.title}</strong><small>Due {row.due}</small></div></li>)}
              </ul>
            ) : null}
          </Panel>
        ) : <EmptyState icon="activity">{displayNote(model.operationsNote, SECTION_EMPTY.operations) || SECTION_EMPTY.operations}</EmptyState>}
      </section>
      <section aria-label="Clients">
        <SectionHeading icon="users">Clients</SectionHeading>
        {model.clients.length ? (
          <Panel title="Status">
            <StatusShare rows={model.clients} center="Status" empty={displayNote(model.clientsNote, SECTION_EMPTY.clients)} />
          </Panel>
        ) : <EmptyState icon="users">{displayNote(model.clientsNote, SECTION_EMPTY.clients) || SECTION_EMPTY.clients}</EmptyState>}
      </section>
    </>
  )
}

export function StandardFunds({ model }) {
  const period = useReportingPeriod(model.today)
  const rows = rowsInPeriod([...(model.incomeRows || []), ...(model.expenseRows || [])], period)
  const summary = monthSummary(rows)
  const expenseValue = moneyHidden(model.expenseNote) && !rows.some((row) => row.kind === 'expense') ? null : summary.expense
  const receivedValue = moneyHidden(model.incomeNote) && !rows.some((row) => row.kind === 'income') ? null : summary.income
  const months = monthsInPeriod(period)
  const days = months.flatMap((month) => dailyAmounts(rows, month))
  const sources = sourceAnalysis(rows)
  const maxSource = Math.max(...sources.flatMap((item) => [item.income, item.expense]), 1)
  const incomeLine = displayNote(model.incomeNote, SECTION_EMPTY.income)
  const expenseLine = displayNote(model.expenseNote, SECTION_EMPTY.expenses)
  const bothNeeds = isNeedsNote(model.incomeNote) && isNeedsNote(model.expenseNote)
  return (
    <>
      <h2 className="sr-only">Funds</h2>
      {bothNeeds ? <EmptyState icon="wallet">{SECTION_EMPTY.funds}</EmptyState> : (
        <>
          {moneyHidden(model.incomeNote) && incomeLine && <EmptyState icon="wallet">{incomeLine}</EmptyState>}
          {moneyHidden(model.expenseNote) && expenseLine && expenseLine !== incomeLine && <EmptyState icon="receipt">{expenseLine}</EmptyState>}
        </>
      )}
      {!bothNeeds && (
        <div className="grid-3 funds-totals" style={{ marginBottom: 16 }}>
          <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-red)' }}>{expenseValue == null ? '—' : formatZmw(expenseValue)}</div><div className="stat-desc">Expense</div></div></section>
          <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{receivedValue == null ? '—' : formatZmw(receivedValue)}</div><div className="stat-desc">Total received</div></div></section>
        </div>
      )}
      {!moneyHidden(model.expenseNote) && model.expenseNote && <EmptyState icon="receipt">{expenseLine}</EmptyState>}
      {rows.length ? (
        <>
          <div className="grid">
            <RankedSplit title="Expense overview" rows={rows.filter((row) => row.kind === 'expense')} center="Expenses" format={formatZmw} />
            <RankedSplit title="Income overview" rows={rows.filter((row) => row.kind === 'income')} center="Income" format={formatZmw} />
          </div>
          <div className="grid">
            <FlowChart title="Expense flow" days={days} field="expense" color="var(--rag-red)" />
            <FlowChart title="Income flow" days={days} field="income" color="var(--rag-green)" />
          </div>
          <Panel title="Account analysis">
            <div role="img" aria-label="Expense and income by source">
              {sources.map((item) => (
                <div key={item.name} style={{ margin: '12px 0' }}>
                  <strong>{item.name}</strong>
                  <span className="bar-track" style={{ marginTop: 6, width: `${(item.expense / maxSource) * 100}%`, background: 'var(--rag-red)' }} />
                  <span className="bar-track" style={{ marginTop: 4, width: `${(item.income / maxSource) * 100}%`, background: 'var(--rag-green)' }} />
                </div>
              ))}
            </div>
            <ul className="vh-list">
              {sources.map((item) => <li key={item.name}><div><strong>{item.name}</strong><small>Expense {formatZmw(item.expense)} · Income {formatZmw(item.income)}</small></div></li>)}
            </ul>
          </Panel>
        </>
      ) : (!bothNeeds && <Message>{COPY.fundsEmpty}</Message>)}
      {!bothNeeds && months.map((month) => <MonthCalendar key={month} month={month} days={dailyAmounts(rows, month)} />)}
    </>
  )
}

function bankTxnMessage(access) {
  if (access === 'blocked') return COPY.bankTxnsBlocked
  if (access === 'signed-out') return COPY.signedOut
  if (access === 'unconfigured') return COPY.unconfigured
  if (access === 'error') return COPY.loadError
  return ''
}

function BudgetProjection({ budget, access, period }) {
  const blocked = bankTxnMessage(access)
  if (access !== 'ok' && access !== 'empty') return <EmptyState icon="landmark">{blocked}</EmptyState>
  const months = new Set(monthsInPeriod(period))
  return (
    <>
      <h2 className="section-title"><NavIcon name="calculator" />Monthly provider projection</h2>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <section className="card"><div className="card-body">
          <div className="stat-num" style={{ fontSize: 28 }} aria-label="Current FX rate">{budget.fx.rate == null ? 'Not recorded' : formatRate(budget.fx.rate)}</div>
          <div className="stat-desc">Current FX rate, ZMW per USD{budget.fx.month ? `, ${monthLabel(budget.fx.month)}` : ''}</div>
        </div></section>
        <section className="card"><div className="card-body">
          <div className="stat-num" style={{ fontSize: 28 }}>{budget.projection == null ? 'Not recorded' : formatZmw(budget.projection)}</div>
          <div className="stat-desc">Projected monthly cost</div>
        </div></section>
        <section className="card"><div className="card-body">
          <div className="stat-num" style={{ fontSize: 28 }}>{budget.gapLatest == null ? 'Not recorded' : formatZmw(budget.gapLatest)}</div>
          <div className="stat-desc">Gap against the latest month</div>
          {budget.gapAverage != null && <p className="stat-desc">Gap against the 12-month average: {formatZmw(budget.gapAverage)}</p>}
        </div></section>
      </div>
      <Panel title="Plan prices">
        {budget.lines.length ? (
          <>
            {['USD', 'ZMW'].map((currency) => {
              const priced = budget.lines.filter((line) => line.currency === currency && (currency === 'USD' ? line.unitUsd : line.unitZmw) != null).map((line) => ({
                id: line.plan,
                title: `${line.plan} (${line.count} active)`,
                amount: currency === 'USD' ? line.unitUsd : line.unitZmw,
                unit: currency,
              }))
              return <AccountBars key={currency} rows={priced} label={`${currency} plan prices`} />
            })}
            <DataTable
              rows={budget.lines.map((line) => ({ ...line, id: line.plan }))}
              empty="No active family accounts."
              columns={[
                { key: 'plan', label: 'Plan', cell: (row) => `${row.plan} (${row.count} active)` },
                { key: 'price', label: 'Typical price', cell: (row) => (row.currency === 'USD' && row.unitUsd != null ? formatMoney(row.unitUsd, 'USD') : row.currency === 'ZMW' && row.unitZmw != null ? formatZmw(row.unitZmw) : 'Not recorded') },
                { key: 'each', label: 'Each account', cell: (row) => (row.unitZmw == null ? 'Not recorded' : formatZmw(row.unitZmw)) },
                { key: 'total', label: 'Monthly', cell: (row) => (row.total == null ? 'Left out' : formatZmw(row.total)) },
              ]}
            />
          </>
        ) : <EmptyState icon="calculator">No active family accounts, so there are no plan prices in the projection.</EmptyState>}
        <p className="stat-desc">USD plans converted {formatZmw(budget.usdConverted)}. Kwacha-billed plans {formatZmw(budget.kwachaBilled)}. Average monthly bank charges {formatZmw(budget.charges.average)}.</p>
        {!budget.complete && <p className="stat-desc">Plans with no matched price are left out of the projected total.</p>}
      </Panel>
      <Panel title="Actual provider subscriptions">
        {budget.actual.latest ? (
          <>
            <p>Latest month, {monthLabel(budget.actual.latest.month)}: {formatZmw(budget.actual.latest.amount)}</p>
            <p>12-month average: {formatZmw(budget.actual.average)}</p>
            <DataTable
              rows={budget.actual.months.filter((row) => months.has(row.month)).map((row) => ({ ...row, id: row.month }))}
              empty={COPY.bankTxnsEmpty}
              columns={[
                { key: 'month', label: 'Month', cell: (row) => monthLabel(row.month) },
                { key: 'amount', label: 'VE provider subscriptions', cell: (row) => formatZmw(row.amount) },
              ]}
            />
          </>
        ) : <EmptyState icon="landmark">{budget.actual.source}</EmptyState>}
      </Panel>
    </>
  )
}

function categoryTotals(rows) {
  const totals = new Map()
  for (const row of rows) totals.set(row.category, (totals.get(row.category) || 0) + row.amount)
  return [...totals.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
}

function CategoryTable({ title, rows, empty }) {
  return (
    <Panel title={title}>
      {rows.length ? (
        <DataTable
          rows={rows.map((row) => ({ ...row, id: row.name }))}
          empty={empty}
          columns={[
            { key: 'name', label: 'Category', cell: (row) => row.name },
            { key: 'amount', label: 'Amount', cell: (row) => formatZmw(row.amount) },
          ]}
        />
      ) : <EmptyState icon="calculator">{empty}</EmptyState>}
    </Panel>
  )
}

export function StandardBudget({ model }) {
  const period = useReportingPeriod(model.today)
  const expenses = rowsInPeriod(model.expenseRows || [], period)
  const income = rowsInPeriod(model.incomeRows || [], period)
  const weeks = weeklyBudget(expenses).filter((item) => weekOverlapsPeriod(item.week, period))
  const [week, setWeek] = useState(weeks.at(-1)?.week || '')
  const selected = weeks.find((item) => item.week === week) || weeks.at(-1) || null
  const expenseMessage = moneyHidden(model.expenseNote) ? displayNote(model.expenseNote, SECTION_EMPTY.budget) : (model.expenseNote || '')
  const incomeMessage = moneyHidden(model.incomeNote) ? displayNote(model.incomeNote, SECTION_EMPTY.income) : (model.incomeNote || 'No income was returned for this account.')
  const needsBudget = isNeedsNote(model.expenseNote) && !model.budget && !expenses.length
  return (
    <>
      <h2 className="sr-only">Budget</h2>
      {model.budget ? <BudgetProjection budget={model.budget} access={model.bankTxnAccess || 'empty'} period={period} /> : null}
      {needsBudget ? <EmptyState icon="calculator">{SECTION_EMPTY.budget}</EmptyState> : (
        expenseMessage && !expenses.length ? <EmptyState icon="calculator">{expenseMessage}</EmptyState> : (
          <Panel title="Weekly expense budget">
            {weeks.length > 0 && (
              <div className="field" style={{ maxWidth: 240 }}>
                <label>Week
                  <select aria-label="Budget week" value={selected?.week || ''} onChange={(event) => setWeek(event.target.value)}>
                    {weeks.map((item) => <option key={item.week} value={item.week}>Week of {item.week}</option>)}
                  </select>
                </label>
              </div>
            )}
            {selected ? <DataTable rows={selected.categories.map((row) => ({ ...row, id: row.name }))} empty={COPY.budgetEmpty} columns={[{ key: 'name', label: 'Category', cell: (row) => row.name }, { key: 'amount', label: 'Recorded', cell: (row) => formatZmw(row.amount) }]} /> : <EmptyState icon="calculator">{COPY.budgetEmpty}</EmptyState>}
            {selected && <p className="stat-desc">Week total {formatZmw(selected.total)}</p>}
          </Panel>
        )
      )}
      <div className="grid">
        <CategoryTable title="Income categories" rows={categoryTotals(income)} empty={incomeMessage || 'No income was returned for this account.'} />
        <CategoryTable title="Expense categories" rows={categoryTotals(expenses)} empty={expenseMessage || COPY.expensesEmpty} />
      </div>
    </>
  )
}

export function StandardMarketing({ model }) {
  const period = useReportingPeriod(model.today)
  const posts = rowsInPeriod(model.posts || [], period)
  const spend = rowsInPeriod(model.spend || [], period)
  const postsNote = model.postsNote != null ? model.postsNote : (isNeedsNote(model.marketingNote) ? model.marketingNote : '')
  const spendNote = model.spendNote != null ? model.spendNote : (isNeedsNote(model.marketingNote) ? model.marketingNote : '')
  if (!posts.length && !spend.length && isNeedsNote(postsNote) && isNeedsNote(spendNote)) {
    return <><h2 className="sr-only">Marketing</h2><EmptyState icon="megaphone">{SECTION_EMPTY.marketing}</EmptyState></>
  }
  const acquisition = acquisitionSummary(spend)
  const postsMessage = displayNote(postsNote, SECTION_EMPTY.marketing) || (!posts.length ? COPY.postsEmpty : '')
  const spendMessage = displayNote(spendNote, SECTION_EMPTY.marketing) || (!spend.length ? COPY.cacEmpty : '')
  const cac = acquisition.value == null ? 'Not recorded' : formatZmw(acquisition.value)
  return (
    <>
      <h2 className="sr-only">Marketing</h2>
      <div className="grid">
        <Panel title="Scheduled posts">
          {postsMessage && !posts.length ? <EmptyState icon="megaphone">{postsMessage}</EmptyState> : (
            <DataTable
              rows={posts}
              empty={COPY.postsEmpty}
              columns={[
                { key: 'date', label: 'Scheduled for', cell: (row) => row.date },
                { key: 'channel', label: 'Channel', cell: (row) => row.channel },
                { key: 'post', label: 'Post', cell: (row) => row.post },
                { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.status} /> },
              ]}
            />
          )}
        </Panel>
        <Panel title="Customer acquisition cost (CAC)">
          {spendMessage && !spend.length ? <EmptyState icon="megaphone">{spendMessage}</EmptyState> : (
            <>
              <div className="stat-num" style={{ fontSize: 28 }}>CAC {cac}</div>
              <DataTable
                rows={spend}
                empty={COPY.cacEmpty}
                columns={[
                  { key: 'date', label: 'Date', cell: (row) => row.date },
                  { key: 'channel', label: 'Channel', cell: (row) => row.channel },
                  { key: 'campaign', label: 'Campaign', cell: (row) => row.campaign },
                  { key: 'amount', label: 'Spend', cell: (row) => formatZmw(row.amount) },
                  { key: 'conversions', label: 'Conversions', cell: (row) => (row.conversions == null ? '—' : row.conversions) },
                  { key: 'cac', label: 'CAC', cell: (row) => row.cacLabel || (row.computed == null ? 'Not recorded' : formatZmw(row.computed)) },
                ]}
              />
            </>
          )}
        </Panel>
      </div>
    </>
  )
}
