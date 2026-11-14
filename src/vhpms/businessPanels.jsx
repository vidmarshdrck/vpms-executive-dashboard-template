import { useEffect, useRef, useState } from 'react'
import { Donut } from './Donut.jsx'
import { balancesByAccount, closingBalances, formatRate } from './bankBudget.js'
import { slicesBy } from './books.js'
import { categoryShare, dailyAmounts, monthLabel, monthSummary, sourceAnalysis } from './fundsMonth.js'
import { NavIcon } from './icons.jsx'
import { MONTHS, monthsInPeriod, rowsInPeriod, weekOverlapsPeriod } from './reportingPeriod.js'
import { useReportingPeriod } from './TimeframePopover.jsx'
import { COPY, acquisitionSummary, weeklyBudget } from './veData.js'
import { EMPTY, accountCaption, formatAmount, formatDayHeading, formatDisplayDate, isNeedsNote, moneyHidden, monthStripRows, sectionDetail, sentenceCase, statusLabel } from './workspaceCharts.js'

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

export function EmptyState({ icon = 'layers', title, detail }) {
  return (
    <div className="empty-state">
      <NavIcon name={icon} />
      <div>
        <strong>{title}</strong>
        {detail ? <p className="empty-detail">{detail}</p> : null}
      </div>
    </div>
  )
}

function EmptyCard({ icon, title, detail }) {
  return (
    <section className="card empty-card">
      <div className="card-body">
        <EmptyState icon={icon} title={title} detail={detail} />
      </div>
    </section>
  )
}

function Money({ amount, currency = 'ZMW' }) {
  const negative = Number(amount) < 0
  return <span className={negative ? 'money-neg' : undefined}>{formatAmount(amount, currency)}</span>
}

function StatusPill({ status }) {
  const label = statusLabel(status)
  return <span className={`chip status-pill ${label === 'Connected' ? 'green' : 'na'}`}>{label}</span>
}

function SectionHeading({ icon, children }) {
  return <h2 className="section-title"><NavIcon name={icon} />{children}</h2>
}

function Stat({ label, value, quiet = false, negative = false }) {
  return <section className="card"><div className="card-body"><div className={`stat-num kpi-figure${negative ? ' money-neg' : ''}${quiet ? ' is-quiet' : ''}`}>{value}</div><div className="stat-desc">{label}</div></div></section>
}

function moneyTile(value) {
  return value == null ? '—' : formatAmount(value)
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

function casedRows(rows) {
  return (rows || []).map((row) => ({ ...row, category: sentenceCase(row.category) }))
}

function RankedSplit({ title, rows, center, empty }) {
  const share = categoryShare(casedRows(rows))
  const slices = slicesBy(share.map((item) => ({ group: item.name, amount: item.amount })), 'group')
  return (
    <Panel title={title}>
      {share.length ? <Donut items={slices} center={center} format={formatAmount} /> : <EmptyState icon="pie" title={empty.title} detail={empty.detail} />}
    </Panel>
  )
}

function usePlotBox() {
  const ref = useRef(null)
  const [box, setBox] = useState({ width: 640, height: 220 })
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => {
      const rect = node.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      setBox((current) => (Math.abs(current.width - width) < 2 && Math.abs(current.height - height) < 2 ? current : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, box]
}

function monthBlocks(days) {
  const blocks = []
  days.forEach((day, index) => {
    const month = day.date.slice(0, 7)
    const last = blocks.at(-1)
    if (!last || last.month !== month) blocks.push({ month, start: index, count: 1 })
    else last.count += 1
  })
  return blocks
}

function PixelPlot({ title, days, series, legend = null }) {
  const [scrollRef, box] = usePlotBox()
  const barW = 4
  const slot = series.length > 1 ? 14 : 10
  const axisH = 34
  const plotH = Math.max(48, box.height - axisH)
  const contentWidth = Math.max(days.length, 1) * slot
  const svgWidth = Math.max(box.width, contentWidth)
  const max = Math.max(...days.flatMap((day) => series.map((item) => Number(day[item.field]) || 0)), 1)
  const ticks = [max, max / 2, 0]
  return (
    <Panel title={title}>
      <div className="plot-block" data-plot={title}>
        <div className="plot-y" aria-hidden="true">
          {ticks.map((tick) => <span key={tick} className="plot-label">{formatAmount(tick)}</span>)}
        </div>
        <div className="plot-scroll" ref={scrollRef}>
          <svg className="plot-svg" width={svgWidth} height={plotH} viewBox={`0 0 ${svgWidth} ${plotH}`} role="img" aria-label={title}>
            {ticks.map((tick, index) => {
              const y = plotH - (tick / max) * (plotH - 1)
              return <line key={index} x1="0" x2={svgWidth} y1={y} y2={y} stroke="var(--border)" />
            })}
            {days.map((day, index) => series.map((item, seriesIndex) => {
              const value = Number(day[item.field]) || 0
              const height = (value / max) * (plotH - 1)
              const x = index * slot + seriesIndex * (barW + 2)
              return <rect key={`${day.date}-${item.field}`} className="plot-bar" x={x} y={plotH - height} width={barW} height={Math.max(height, 0)} fill={item.color}><title>{`${formatDisplayDate(day.date)} ${formatAmount(value)}`}</title></rect>
            }))}
          </svg>
          <div className="plot-x" style={{ width: svgWidth }} aria-hidden="true">
            {days.map((day, index) => {
              const dayNum = Number(day.date.slice(-2))
              if (![1, 8, 15, 22, 29].includes(dayNum)) return null
              return <span key={day.date} className="plot-label plot-tick" style={{ left: index * slot }}>{dayNum}</span>
            })}
            {monthBlocks(days).map((block) => (
              <span key={block.month} className="plot-label plot-month" style={{ left: (block.start + block.count / 2) * slot }}>{MONTHS[Number(block.month.slice(5)) - 1]}</span>
            ))}
          </div>
        </div>
      </div>
      {legend}
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
          <small>{row.unit === 'USD' || row.unit === 'ZMW' ? formatAmount(row.amount, row.unit) : `${row.amount} ${row.unit || ''}`.trim()}</small>
        </div>
      ))}
    </div>
  )
}

function StatusShare({ rows, empty, center, pills = false }) {
  const counts = new Map()
  for (const row of rows || []) {
    const name = statusLabel(row.status)
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  const share = [...counts.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const slices = slicesBy(share.map((item) => ({ group: item.name, amount: item.amount })), 'group')
  if (!slices.length) return <EmptyState icon={empty.icon} title={empty.title} detail={empty.detail} />
  return <Donut items={slices} center={center} format={(value) => String(value)} renderName={pills ? (item) => <StatusPill status={item.name} /> : undefined} />
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
        {items.map((item) => {
          const quiet = !item.income && !item.expense
          return (
            <article key={item.month}>
              <span>{item.label}</span>
              <strong className={!quiet && item.income - item.expense < 0 ? 'money-neg' : undefined}>{quiet ? '—' : formatAmount(item.income - item.expense)}</strong>
              {quiet ? <small>No movement</small> : <><small>In {formatAmount(item.income)}</small><small>Out {formatAmount(item.expense)}</small></>}
            </article>
          )
        })}
      </div>
    </Panel>
  )
}

function DailyBars({ days }) {
  return (
    <PixelPlot
      title="Daily income & expense"
      days={days}
      series={[{ field: 'income', color: 'var(--rag-green)' }, { field: 'expense', color: 'var(--rag-red)' }]}
      legend={<div className="legend"><span><i className="dot" style={{ background: 'var(--rag-green)' }} />Income</span><span><i className="dot" style={{ background: 'var(--rag-red)' }} />Expense</span></div>}
    />
  )
}

function FlowChart({ title, days, field, color }) {
  return <PixelPlot title={title} days={days} series={[{ field, color }]} />
}

function ByAccountBars({ rows }) {
  const max = Math.max(...rows.map((row) => Math.abs(Number(row.amount))), 1)
  return (
    <Panel title="By account">
      <div role="img" aria-label="By account">
        {rows.map((row) => (
          <div className="bar-row" key={row.id}>
            <strong className="bar-name" title={accountCaption(row)}>{accountCaption(row)}</strong>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(Math.abs(Number(row.amount)) / max) * 100}%` }} /></span>
            <b className={`bar-value${Number(row.amount) < 0 ? ' money-neg' : ''}`}>{formatAmount(row.amount, row.currency)}</b>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function MonthCalendar({ days, month, bare = false }) {
  const [year, number] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7
  const grid = (
    <div className="vh-calendar-scroll" tabIndex="0" aria-label="Funds calendar">
      <div className="vh-calendar">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <strong key={day}>{day}</strong>)}
        {Array.from({ length: offset }, (_, index) => <div key={`pad-${index}`} className="vh-day vh-blank" />)}
        {days.map((day) => {
          const active = day.income || day.expense
          return <div key={day.date} className="vh-day"><span>{Number(day.date.slice(-2))}</span>{active ? <strong className={day.net < 0 ? 'money-neg' : 'money-pos'}>{formatAmount(day.net)}</strong> : null}</div>
        })}
      </div>
    </div>
  )
  if (bare) return grid
  const label = new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>{label}</h2></div>
      <div className="card-body">{grid}</div>
    </section>
  )
}

function DayList({ days }) {
  const active = (days || []).filter((day) => day.income || day.expense)
  return (
    <ul className="day-list" aria-label="Days with movement">
      {active.length ? active.map((day) => (
        <li key={day.date}>
          <span>{formatDayHeading(day.date)}</span>
          <strong className={day.net < 0 ? 'money-neg' : 'money-pos'}>{formatAmount(day.net)}</strong>
        </li>
      )) : <li>No movement</li>}
    </ul>
  )
}

function ClientList({ clients }) {
  const [open, setOpen] = useState(false)
  const shown = open ? clients : clients.slice(0, 5)
  return (
    <>
      <ul className="vh-list" aria-label="Clients">
        {shown.map((row) => <li key={row.id}><div><strong>{row.name}</strong></div><StatusPill status={row.status} /></li>)}
      </ul>
      {clients.length > 5 ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((current) => !current)}>{open ? 'Show less' : `Show all ${clients.length}`}</button> : null}
    </>
  )
}

export function StandardOverview({ model }) {
  const period = useReportingPeriod(model.today)
  const incomeRows = rowsInPeriod(model.incomeRows, period)
  const expenseRows = rowsInPeriod(model.expenseRows, period)
  const finance = periodFinance(model.finance, incomeRows, expenseRows)
  const bankBlocked = Boolean(model.bankNote)
  const balances = bankBlocked ? [] : closingBalances(model.bankAccounts, model.bankTransactions, period.end)
  const accountRows = bankBlocked ? [] : balancesByAccount(model.bankAccounts, model.bankTransactions, period.end)
  const balanceText = bankBlocked ? '—' : (balances.length ? balances.map((line) => formatAmount(line.amount, line.currency)).join(' · ') : 'No bank account connected')
  const moneyRows = [...incomeRows, ...expenseRows]
  const categoryRows = expenseRows.length ? expenseRows : incomeRows
  const categoryTitle = expenseRows.length ? 'Expenses by category' : 'Income by category'
  const months = monthsInPeriod(period)
  const next = model.upcoming?.[0]
  const financeDetail = sectionDetail(model.expenseNote || model.incomeNote, 'finances', model.businessId)
  return (
    <>
      <h2 className="sr-only">Overview</h2>
      <section aria-label="Finances">
        <SectionHeading icon="wallet">Finances</SectionHeading>
        <div className="kpi-grid">
          <Stat label="Total spent" value={moneyTile(finance.expenses)} />
          <Stat label="Income" value={moneyTile(finance.income)} />
          <Stat label="Balance on hand" value={balanceText} quiet={!bankBlocked && !balances.length} />
          <Stat label="Profit generated" value={moneyTile(finance.profit)} negative={Number(finance.profit) < 0} />
        </div>
        {bankBlocked ? <EmptyCard icon="landmark" title="Bank accounts are not visible" detail={sectionDetail(model.bankNote, 'accounts', model.businessId)} /> : null}
        {moneyRows.length ? (
          <>
            <MonthStrip rows={moneyRows} months={months} />
            <div className="chart-split">
              <RankedSplit title={categoryTitle} rows={categoryRows} center={expenseRows.length ? 'Expenses' : 'Income'} empty={expenseRows.length ? EMPTY.expenses : EMPTY.income} />
              <DailyBars days={months.flatMap((month) => dailyAmounts(moneyRows, month))} />
            </div>
          </>
        ) : (!bankBlocked && <EmptyCard icon={EMPTY.finances.icon} title={EMPTY.finances.title} detail={financeDetail} />)}
        {accountRows.length ? <ByAccountBars rows={accountRows} /> : null}
      </section>
      <section aria-label="Operations">
        <SectionHeading icon="activity">Operations</SectionHeading>
        {model.operations.length ? (
          <Panel title="Status">
            <StatusShare rows={model.operations} center="Status" empty={EMPTY.operations} />
            {next ? <div className="next-renewal"><h3>Next renewal</h3><strong>{next.title}</strong><p>{formatDisplayDate(next.due)}</p></div> : null}
          </Panel>
        ) : <EmptyCard icon={EMPTY.operations.icon} title={EMPTY.operations.title} detail={sectionDetail(model.operationsNote, 'operations', model.businessId)} />}
      </section>
      <section aria-label="Clients">
        <SectionHeading icon="users">Clients</SectionHeading>
        {model.clients.length ? (
          <Panel title="Status">
            <StatusShare rows={model.clients} center="Status" empty={EMPTY.clients} pills />
            <ClientList clients={model.clients} />
          </Panel>
        ) : <EmptyCard icon={EMPTY.clients.icon} title={EMPTY.clients.title} detail={sectionDetail(model.clientsNote, 'clients', model.businessId)} />}
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
  const sources = sourceAnalysis(casedRows(rows))
  const maxSource = Math.max(...sources.flatMap((item) => [item.income, item.expense]), 1)
  const bothNeeds = isNeedsNote(model.incomeNote) && isNeedsNote(model.expenseNote)
  return (
    <>
      <h2 className="sr-only">Funds</h2>
      {bothNeeds ? <EmptyCard icon={EMPTY.funds.icon} title={EMPTY.funds.title} detail={sectionDetail(model.incomeNote, 'funds', model.businessId)} /> : (
        <>
          {moneyHidden(model.incomeNote) && !rows.some((row) => row.kind === 'income') ? <EmptyCard icon={EMPTY.income.icon} title={EMPTY.income.title} detail={sectionDetail(model.incomeNote, 'income', model.businessId)} /> : null}
          {moneyHidden(model.expenseNote) && !rows.some((row) => row.kind === 'expense') && sectionDetail(model.expenseNote, 'expenses', model.businessId) !== sectionDetail(model.incomeNote, 'income', model.businessId) ? <EmptyCard icon={EMPTY.expenses.icon} title={EMPTY.expenses.title} detail={sectionDetail(model.expenseNote, 'expenses', model.businessId)} /> : null}
          <div className="kpi-grid">
            <section className="card"><div className="card-body"><div className="stat-num kpi-figure">{expenseValue == null ? '—' : formatAmount(expenseValue)}</div><div className="stat-desc">Expense</div></div></section>
            <section className="card"><div className="card-body"><div className="stat-num kpi-figure">{receivedValue == null ? '—' : formatAmount(receivedValue)}</div><div className="stat-desc">Total received</div></div></section>
          </div>
        </>
      )}
      {!moneyHidden(model.expenseNote) && model.expenseNote && !rows.some((row) => row.kind === 'expense') ? <EmptyCard icon={EMPTY.expenses.icon} title={EMPTY.expenses.title} detail={sectionDetail(model.expenseNote, 'expenses', model.businessId)} /> : null}
      {rows.length ? (
        <>
          <div className="grid">
            <RankedSplit title="Expense overview" rows={rows.filter((row) => row.kind === 'expense')} center="Expenses" empty={EMPTY.expenses} />
            <RankedSplit title="Income overview" rows={rows.filter((row) => row.kind === 'income')} center="Income" empty={EMPTY.income} />
          </div>
          <div className="grid">
            <FlowChart title="Expense flow" days={days} field="expense" color="var(--rag-red)" />
            <FlowChart title="Income flow" days={days} field="income" color="var(--rag-green)" />
          </div>
          <Panel title="Account analysis">
            <div role="img" aria-label="Expense and income by source">
              {sources.map((item) => (
                <div key={item.name} style={{ margin: '12px 0 16px' }}>
                  <div className="account-line"><strong>{item.name}</strong><span>Expense {formatAmount(item.expense)} · Income {formatAmount(item.income)}</span></div>
                  <span className="bar-track" style={{ marginTop: 8 }}><span className="bar-fill" style={{ width: `${(item.expense / maxSource) * 100}%`, background: 'var(--rag-red)' }} /></span>
                  <span className="bar-track" style={{ marginTop: 4 }}><span className="bar-fill" style={{ width: `${(item.income / maxSource) * 100}%`, background: 'var(--rag-green)' }} /></span>
                </div>
              ))}
            </div>
            <div className="legend"><span><i className="dot" style={{ background: 'var(--rag-red)' }} />Expense</span><span><i className="dot" style={{ background: 'var(--rag-green)' }} />Income</span></div>
          </Panel>
        </>
      ) : (!bothNeeds && !model.expenseNote && !model.incomeNote && <EmptyCard icon={EMPTY.funds.icon} title={EMPTY.funds.title} detail={sectionDetail('', 'funds', model.businessId)} />)}
      {!bothNeeds && <FundsMonth months={months} rows={rows} />}
    </>
  )
}

function FundsMonth({ months, rows }) {
  const movement = months.filter((month) => dailyAmounts(rows, month).some((day) => day.income || day.expense))
  const fallback = movement.at(-1) || months.at(-1) || ''
  const [month, setMonth] = useState(fallback)
  const selected = months.includes(month) ? month : fallback
  const index = Math.max(months.indexOf(selected), 0)
  if (!selected) return null
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head month-nav">
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Previous month" disabled={index <= 0} onClick={() => setMonth(months[index - 1])}>‹</button>
        <h2>{monthLabel(selected)}</h2>
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Next month" disabled={index >= months.length - 1} onClick={() => setMonth(months[index + 1])}>›</button>
      </div>
      <div className="card-body">
        <MonthCalendar month={selected} days={dailyAmounts(rows, selected)} bare />
        <DayList days={dailyAmounts(rows, selected)} />
      </div>
    </section>
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
  if (access !== 'ok' && access !== 'empty') return <EmptyCard icon="landmark" title="Bank accounts are not visible" detail={blocked} />
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
          <div className="stat-num" style={{ fontSize: 28 }}>{budget.projection == null ? 'Not recorded' : formatAmount(budget.projection)}</div>
          <div className="stat-desc">Projected monthly cost</div>
        </div></section>
        <section className="card"><div className="card-body">
          <div className="stat-num" style={{ fontSize: 28 }}>{budget.gapLatest == null ? 'Not recorded' : formatAmount(budget.gapLatest)}</div>
          <div className="stat-desc">Gap against the latest month</div>
          {budget.gapAverage != null && <p className="stat-desc">Gap against the 12-month average: {formatAmount(budget.gapAverage)}</p>}
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
                { key: 'price', label: 'Typical price', cell: (row) => (row.currency === 'USD' && row.unitUsd != null ? formatAmount(row.unitUsd, 'USD') : row.currency === 'ZMW' && row.unitZmw != null ? formatAmount(row.unitZmw) : 'Not recorded') },
                { key: 'each', label: 'Each account', cell: (row) => (row.unitZmw == null ? 'Not recorded' : formatAmount(row.unitZmw)) },
                { key: 'total', label: 'Monthly', cell: (row) => (row.total == null ? 'Left out' : formatAmount(row.total)) },
              ]}
            />
          </>
        ) : <EmptyState icon="calculator" title="No plan prices recorded" detail="No active family accounts are in the projection." />}
        <p className="stat-desc">USD plans converted {formatAmount(budget.usdConverted)}. Kwacha-billed plans {formatAmount(budget.kwachaBilled)}. Average monthly bank charges {formatAmount(budget.charges.average)}.</p>
        {!budget.complete && <p className="stat-desc">Plans with no matched price are left out of the projected total.</p>}
      </Panel>
      <Panel title="Actual provider subscriptions">
        {budget.actual.latest ? (
          <>
            <p>Latest month, {monthLabel(budget.actual.latest.month)}: {formatAmount(budget.actual.latest.amount)}</p>
            <p>12-month average: {formatAmount(budget.actual.average)}</p>
            <DataTable
              rows={budget.actual.months.filter((row) => months.has(row.month)).map((row) => ({ ...row, id: row.month }))}
              empty={COPY.bankTxnsEmpty}
              columns={[
                { key: 'month', label: 'Month', cell: (row) => monthLabel(row.month) },
                { key: 'amount', label: 'VE provider subscriptions', cell: (row) => formatAmount(row.amount) },
              ]}
            />
          </>
        ) : <EmptyState icon="landmark" title="No provider subscriptions recorded" detail={budget.actual.source} />}
      </Panel>
    </>
  )
}

function categoryTotals(rows) {
  const totals = new Map()
  for (const row of rows) {
    const name = sentenceCase(row.category)
    totals.set(name, (totals.get(name) || 0) + row.amount)
  }
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
            { key: 'name', label: 'Category', cell: (row) => sentenceCase(row.name) },
            { key: 'amount', label: 'Amount', cell: (row) => formatAmount(row.amount) },
          ]}
        />
      ) : <EmptyState icon="calculator" title={empty?.title || EMPTY.expenses.title} detail={empty?.detail || empty} />}
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
  const needsBudget = isNeedsNote(model.expenseNote) && !model.budget && !expenses.length
  return (
    <>
      <h2 className="sr-only">Budget</h2>
      {model.budget ? <BudgetProjection budget={model.budget} access={model.bankTxnAccess || 'empty'} period={period} /> : null}
      {needsBudget ? <EmptyCard icon={EMPTY.budget.icon} title={EMPTY.budget.title} detail={sectionDetail(model.expenseNote, 'budget', model.businessId)} /> : (
        !expenses.length ? <EmptyCard icon={EMPTY.expenses.icon} title={EMPTY.expenses.title} detail={sectionDetail(model.expenseNote, 'expenses', model.businessId)} /> : (
          <Panel title="Weekly expense budget">
            {weeks.length > 0 && (
              <div className="field" style={{ maxWidth: 240 }}>
                <label>Week
                  <select aria-label="Budget week" value={selected?.week || ''} onChange={(event) => setWeek(event.target.value)}>
                    {weeks.map((item) => <option key={item.week} value={item.week}>Week of {formatDisplayDate(item.week)}</option>)}
                  </select>
                </label>
              </div>
            )}
            {selected ? <DataTable rows={selected.categories.map((row) => ({ ...row, id: row.name }))} empty={COPY.budgetEmpty} columns={[{ key: 'name', label: 'Category', cell: (row) => sentenceCase(row.name) }, { key: 'amount', label: 'Recorded', cell: (row) => formatAmount(row.amount) }]} /> : <EmptyState icon="calculator" title={EMPTY.budget.title} detail={COPY.budgetEmpty} />}
            {selected && <p className="stat-desc">Week total {formatAmount(selected.total)}</p>}
          </Panel>
        )
      )}
      {!needsBudget && expenses.length ? (
        <div className="grid">
          <CategoryTable title="Income categories" rows={categoryTotals(income)} empty={{ title: EMPTY.income.title, detail: sectionDetail(model.incomeNote, 'income', model.businessId) }} />
          <CategoryTable title="Expense categories" rows={categoryTotals(expenses)} empty={{ title: EMPTY.expenses.title, detail: sectionDetail(model.expenseNote, 'expenses', model.businessId) }} />
        </div>
      ) : null}
    </>
  )
}

export function StandardMarketing({ model }) {
  const period = useReportingPeriod(model.today)
  const posts = rowsInPeriod(model.posts || [], period)
  const spend = rowsInPeriod(model.spend || [], period)
  const postsNote = model.postsNote != null ? model.postsNote : (isNeedsNote(model.marketingNote) ? model.marketingNote : '')
  const spendNote = model.spendNote != null ? model.spendNote : (isNeedsNote(model.marketingNote) ? model.marketingNote : '')
  if (!posts.length && !spend.length && (isNeedsNote(postsNote) || isNeedsNote(model.marketingNote)) && (isNeedsNote(spendNote) || isNeedsNote(model.marketingNote))) {
    return <><h2 className="sr-only">Marketing</h2><EmptyCard icon={EMPTY.marketing.icon} title={EMPTY.marketing.title} detail={sectionDetail(model.marketingNote || postsNote, 'marketing', model.businessId)} /></>
  }
  const acquisition = acquisitionSummary(spend)
  const postsDetail = sectionDetail(postsNote, 'posts', model.businessId)
  const spendDetail = sectionDetail(spendNote, 'spend', model.businessId)
  const cac = acquisition.value == null ? 'Not recorded' : formatAmount(acquisition.value)
  return (
    <>
      <h2 className="sr-only">Marketing</h2>
      <div className="grid">
        <Panel title="Scheduled posts">
          {!posts.length ? <EmptyState icon="megaphone" title={EMPTY.posts.title} detail={postsDetail} /> : (
            <DataTable
              rows={posts}
              empty={COPY.postsEmpty}
              columns={[
                { key: 'date', label: 'Scheduled for', cell: (row) => formatDisplayDate(row.date) },
                { key: 'channel', label: 'Channel', cell: (row) => row.channel },
                { key: 'post', label: 'Post', cell: (row) => row.post },
                { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.status} /> },
              ]}
            />
          )}
        </Panel>
        <Panel title="Customer acquisition cost (CAC)">
          {!spend.length ? <EmptyState icon="megaphone" title={EMPTY.spend.title} detail={spendDetail} /> : (
            <>
              <div className="stat-num" style={{ fontSize: 28 }}>CAC {cac}</div>
              <DataTable
                rows={spend}
                empty={COPY.cacEmpty}
                columns={[
                  { key: 'date', label: 'Date', cell: (row) => formatDisplayDate(row.date) },
                  { key: 'channel', label: 'Channel', cell: (row) => row.channel },
                  { key: 'campaign', label: 'Campaign', cell: (row) => row.campaign },
                  { key: 'amount', label: 'Spend', cell: (row) => formatAmount(row.amount) },
                  { key: 'conversions', label: 'Conversions', cell: (row) => (row.conversions == null ? '—' : row.conversions) },
                  { key: 'cac', label: 'CAC', cell: (row) => row.cacLabel || (row.computed == null ? 'Not recorded' : formatAmount(row.computed)) },
                ]}
              />
            </>
          )}
        </Panel>
      </div>
    </>
  )
}
