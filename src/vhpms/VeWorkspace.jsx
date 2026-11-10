import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import SlideTabs from './SlideTabs.jsx'
import { Donut, PageFooter } from './Donut.jsx'
import { formatZmw, slicesBy } from './books.js'
import { ColumnLabel } from './icons.jsx'
import { accountPeriod, accountsByCurrency, categoryLabel, filterBankTransactions, formatMoney, formatRate, fxText } from './bankBudget.js'
import { categoryShare, dailyAmounts, monthLabel, monthSummary, sourceAnalysis } from './fundsMonth.js'
import { AccountBars, MonthCalendar, StandardOverview } from './businessPanels.jsx'
import { glanceFromVe } from './businessSources.js'
import { monthsInPeriod, rowsInPeriod, weekOverlapsPeriod } from './reportingPeriod.js'
import { useReportingPeriod } from './TimeframePopover.jsx'
import { COPY, acquisitionSummary, buildWorkspace, emptySources, fetchVeWorkspace, filterCustomers, todayIso, weeklyBudget, whatsappHref } from './veData.js'

function Panel({ title, children, note }) {
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

function Message({ children }) {
  return <p className="empty">{children}</p>
}

function StatusChip({ value }) {
  const key = String(value || '').toLowerCase()
  const tone = key === 'overdue' ? 'red' : /unpaid|inactive|disconnected/.test(key) ? 'amber' : /active|connected|paid|published|scheduled/.test(key) ? 'green' : 'na'
  return <span className={`chip ${tone}`}>{value}</span>
}

function DataTable({ columns, rows, empty, onRow }) {
  return (
    <div className="tbl-scroll">
      <table className="data">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr
              key={row.id}
              className={onRow ? 'is-clickable' : undefined}
              tabIndex={onRow ? 0 : undefined}
              onClick={onRow ? () => onRow(row) : undefined}
              onKeyDown={onRow ? (event) => { if (event.key === 'Enter') onRow(row) } : undefined}
            >{columns.map((column) => <td key={column.key}>{column.cell(row)}</td>)}</tr>
          )) : <tr><td colSpan={columns.length}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function accessMessage(access, empty, blocked) {
  if (access === 'blocked') return blocked
  if (access === 'error') return COPY.loadError
  if (access === 'signed-out') return COPY.signedOut
  if (access === 'unconfigured') return COPY.unconfigured
  if (access !== 'ok') return empty
  return ''
}

export function FamilyModal({ account, onClose }) {
  useEffect(() => {
    if (!account) return undefined
    function onKey(event) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [account, onClose])
  if (!account) return null
  const dialog = (
    <div className="vh-modal">
      <button type="button" className="vh-modal-backdrop" aria-label="Close" onClick={onClose} />
      <section className="card vh-modal-panel" role="dialog" aria-modal="true" aria-label={`${account.owner} family`}>
        <div className="card-head"><h2>{account.plan}</h2><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></div>
        <div className="card-body">
          <p className="stat-desc" style={{ marginTop: 0 }}>{account.owner}</p>
          {account.members.length ? (
            <div className="tbl-scroll">
              <table className="data">
                <thead><tr><th>Name</th><th>Slot</th><th>Last payment</th><th>Amount</th></tr></thead>
                <tbody>
                  {account.members.map((member) => (
                    <tr key={`${member.cid}-${member.slot}`}>
                      <td>{member.name}</td>
                      <td>{member.slot}</td>
                      <td>{member.lastPayment?.date || 'No payment recorded'}</td>
                      <td>{member.lastPayment ? formatZmw(member.lastPayment.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty">No one is connected.</p>}
        </div>
      </section>
    </div>
  )
  if (typeof document === 'undefined') return dialog
  return createPortal(dialog, document.querySelector('.vh-app') || document.body)
}

function AccountTable({ accounts, empty, onOpen }) {
  return (
    <DataTable
      rows={accounts}
      empty={empty}
      onRow={onOpen}
      columns={[
        { key: 'owner', label: <ColumnLabel icon="users">Account owner</ColumnLabel>, cell: (row) => row.owner },
        { key: 'status', label: <ColumnLabel icon="activity">Status</ColumnLabel>, cell: (row) => <StatusChip value={row.activity} /> },
        { key: 'plan', label: <ColumnLabel icon="package">Plan</ColumnLabel>, cell: (row) => row.plan },
        { key: 'due', label: <ColumnLabel icon="calendar">Due date</ColumnLabel>, cell: (row) => row.dueDate },
        { key: 'email', label: <ColumnLabel icon="mail">Email</ColumnLabel>, cell: (row) => row.email || <span aria-label="Email not recorded" /> },
        { key: 'slots', label: <ColumnLabel icon="layers">Slots</ColumnLabel>, cell: (row) => <button type="button" className="btn btn-ghost btn-sm" aria-label={`Slots for ${row.owner}`} onClick={(event) => { event.stopPropagation(); onOpen(row) }}>{row.slotsTaken} of {row.slotsTotal}</button> },
        { key: 'paid', label: <ColumnLabel icon="receipt">Paid status</ColumnLabel>, cell: (row) => <StatusChip value={row.paidStatus} /> },
        { key: 'agent', label: <ColumnLabel icon="user">Agent</ColumnLabel>, cell: (row) => row.agent || '—' },
      ]}
    />
  )
}

function Overview({ model }) {
  return <StandardOverview model={glanceFromVe(model)} />
}

function FamilyAccounts({ model }) {
  const [account, setAccount] = useState(null)
  const [group, setGroup] = useState('active')
  const message = accessMessage(model.access.familyAccounts, COPY.familyEmpty, COPY.familyBlocked)
  const plansMessage = accessMessage(model.access.products, COPY.plansEmpty, COPY.plansEmpty)
  const rows = group === 'active' ? model.activeAccounts : model.inactiveAccounts
  return (
    <>
      <h2 className="sr-only">Family accounts</h2>
      <FamilyModal account={account} onClose={() => setAccount(null)} />
      {message ? <Message>{message}</Message> : (
        <>
          <div className="segmented" role="tablist" aria-label="Account activity">
            <button type="button" role="tab" aria-selected={group === 'active'} className={group === 'active' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setGroup('active')}>Active ({model.activeAccounts.length})</button>
            <button type="button" role="tab" aria-selected={group === 'inactive'} className={group === 'inactive' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setGroup('inactive')}>Inactive ({model.inactiveAccounts.length})</button>
          </div>
          <Panel title={group === 'active' ? 'Active accounts' : 'Inactive accounts'}>
            <AccountTable accounts={rows} empty={group === 'active' ? COPY.activeEmpty : COPY.inactiveEmpty} onOpen={setAccount} />
          </Panel>
        </>
      )}
      <Panel title="Plans">
        {plansMessage || !model.products.length ? <Message>{plansMessage || COPY.plansEmpty}</Message> : (
          <DataTable
            rows={model.products}
            empty={COPY.plansEmpty}
            columns={[
              { key: 'name', label: 'Plan', cell: (row) => row.name },
              { key: 'category', label: 'Category', cell: (row) => row.category },
              { key: 'slots', label: 'Slots', cell: (row) => (row.shared ? `${row.slots ?? '—'} shared` : 'Not shared') },
              { key: 'price', label: 'Price', cell: (row) => (row.price == null ? 'Not recorded' : formatZmw(row.price)) },
              { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.active ? 'Active' : 'Inactive'} /> },
            ]}
          />
        )}
      </Panel>
    </>
  )
}

function Customers({ model }) {
  const [status, setStatus] = useState('All')
  const [query, setQuery] = useState('')
  const message = accessMessage(model.access.customers, COPY.customersEmpty, COPY.customersBlocked)
  const statuses = [...new Set(model.customers.map((row) => row.status))]
  const rows = filterCustomers(model.customers, { status, query })
  return (
    <>
      <h2 className="sr-only">Customers</h2>
      {message ? <Message>{message}</Message> : (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <h2 className="sr-only">Customer list</h2>
            <div className="vh-actions" style={{ marginLeft: 'auto' }}>
              <div className="field" style={{ margin: 0, minWidth: 180, maxWidth: 260 }}>
                <label htmlFor="ve-customer-search">Search</label>
                <input id="ve-customer-search" aria-label="Search customers" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="field" style={{ margin: 0, minWidth: 160, maxWidth: 220 }}>
                <label htmlFor="ve-customer-status">Status</label>
                <select id="ve-customer-status" aria-label="Customer status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option>All</option>
                  {statuses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="card-body">
            <DataTable
              rows={rows}
              empty={COPY.customersEmpty}
              columns={[
                { key: 'name', label: <ColumnLabel icon="user">Name</ColumnLabel>, cell: (row) => row.name },
                { key: 'due', label: <ColumnLabel icon="calendar">Due date</ColumnLabel>, cell: (row) => row.dueDate },
                { key: 'products', label: <ColumnLabel icon="package">Products</ColumnLabel>, cell: (row) => row.products },
                { key: 'status', label: <ColumnLabel icon="activity">Status</ColumnLabel>, cell: (row) => <StatusChip value={row.status} /> },
                { key: 'last', label: <ColumnLabel icon="receipt">Last payment</ColumnLabel>, cell: (row) => row.lastPayment?.date || 'No payment recorded' },
                { key: 'lastAmount', label: <ColumnLabel icon="wallet">Last amount</ColumnLabel>, cell: (row) => row.lastPayment ? formatZmw(row.lastPayment.amount) : '—' },
                { key: 'spent', label: <ColumnLabel icon="wallet">Total spent</ColumnLabel>, cell: (row) => formatZmw(row.totalSpent) },
                { key: 'whatsapp', label: <ColumnLabel icon="message">WhatsApp</ColumnLabel>, cell: (row) => {
                  const href = whatsappHref(row)
                  return href
                    ? <a className="btn btn-primary btn-sm" href={href} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    : <button type="button" className="btn btn-ghost btn-sm" disabled>WhatsApp</button>
                } },
              ]}
            />
          </div>
        </section>
      )}
    </>
  )
}

function RankedSplit({ title, rows, center, format = formatZmw }) {
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
                  <span style={{ display: 'block', height: 8, marginTop: 6, borderRadius: 99, background: 'var(--surface-2)' }}><span style={{ display: 'block', height: '100%', width: `${item.amount / max * 100}%`, borderRadius: 99, background: 'var(--brand)' }} /></span>
                </div>
                <b>{format(item.amount)} · {Math.round(item.pct)}%</b>
              </li>
            ))}
          </ul>
        </>
      ) : <Message>No {center.toLowerCase()} was returned for this period.</Message>}
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
        {days.map((day, index) => {
          const x = days.length === 1 ? width / 2 : (index / (days.length - 1)) * width
          const y = height - 16 - (day[field] / max) * (height - 32)
          return <circle key={day.date} cx={x} cy={y} r="3.5" fill={color}><title>{day.date}: {formatZmw(day[field])}</title></circle>
        })}
      </svg>
    </Panel>
  )
}

function BalanceChart({ title, points, currency }) {
  const width = 640
  const height = 180
  const values = points.map((point) => point.balance)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const y = height - 16 - ((point.balance - min) / span) * (height - 32)
    return { ...point, x, y }
  })
  return (
    <Panel title={title}>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <polyline fill="none" stroke="var(--brand)" strokeWidth="3" points={coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')} />
        {coords.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="3.5" fill="var(--brand)"><title>{point.date}: {formatMoney(point.balance, currency)}</title></circle>)}
      </svg>
    </Panel>
  )
}

function BankAccountBlock({ account, model, range, query, category }) {
  const period = accountPeriod(account, model.bankTransactions, range)
  const own = model.bankTransactions.filter((row) => row.accountId === account.id)
  const trail = filterBankTransactions(own, { start: range.start, end: range.end, query, category })
  const spend = filterBankTransactions(own, { start: range.start, end: range.end }).filter((row) => row.amount < 0).map((row) => ({ category: categoryLabel(row.category), amount: -row.amount }))
  const money = (amount) => formatMoney(amount, account.currency)
  return (
    <>
      <article className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>{account.label}</h2>
          <span className="chip na">{account.last4 ? `Ending ${account.last4}` : account.currency}</span>
        </div>
        <div className="card-body">
          {account.bank && <p className="stat-desc">{account.bank}</p>}
          <div className="grid-3">
            <div><div className="stat-num" style={{ fontSize: 28 }}>{money(period.current)}</div><div className="stat-desc">Current balance</div></div>
            <div><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-green)' }}>{money(period.moneyIn)}</div><div className="stat-desc">In this period</div></div>
            <div><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-red)' }}>{money(period.moneyOut)}</div><div className="stat-desc">Out this period</div></div>
          </div>
          {account.openingBalance != null && <p className="stat-desc">Opening balance {money(account.openingBalance)}</p>}
        </div>
      </article>
      {period.points.length ? <BalanceChart title="Balance over time" points={period.points} currency={account.currency} /> : <Panel title="Balance over time"><Message>No balance points in this period.</Message></Panel>}
      <RankedSplit title="Spending by category" rows={spend} center="Spending" format={money} />
      <Panel title="Transactions">
        {own.length ? (
          <DataTable
            rows={trail}
            empty={COPY.bankTrailEmpty}
            columns={[
              { key: 'date', label: 'Date', cell: (row) => row.date },
              { key: 'description', label: 'Description', cell: (row) => <>{row.description || '—'}{row.reference ? <small style={{ display: 'block' }}>{row.reference}</small> : null}</> },
              { key: 'category', label: 'Category', cell: (row) => categoryLabel(row.category) },
              { key: 'amount', label: 'Amount', cell: (row) => <span style={{ color: row.amount < 0 ? 'var(--rag-red)' : 'var(--rag-green)' }}>{money(row.amount)}</span> },
              { key: 'balance', label: 'Balance', cell: (row) => (row.balance == null ? '—' : money(row.balance)) },
              { key: 'fx', label: 'USD and FX', cell: (row) => fxText(row) || '—' },
            ]}
          />
        ) : <Message>No transactions were returned for this account.</Message>}
      </Panel>
    </>
  )
}

function Accounts({ model }) {
  const reporting = useReportingPeriod(model.today)
  const range = { start: reporting.start, end: reporting.end }
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const access = model.access.bankAccounts
  const readable = access === 'ok' || access === 'empty'
  const monthCategories = [...new Set(model.bankTransactions.filter((row) => row.date >= range.start && row.date <= range.end).map((row) => row.category))].sort()
  const selectedCategory = monthCategories.includes(category) ? category : 'All'
  const groups = accountsByCurrency(model.bankAccounts)
  return (
    <>
      <h2 className="sr-only">Accounts</h2>
      {!readable ? <Message>{accessMessage(access, '', COPY.bankAccountsBlocked)}</Message> : (
        <>
          {model.bankAccounts.length > 0 && (
            <div className="vh-actions" style={{ marginBottom: 16 }}>
              <div className="field" style={{ margin: 0, minWidth: 180, maxWidth: 260 }}>
                <label htmlFor="ve-bank-search">Search</label>
                <input id="ve-bank-search" aria-label="Search transactions" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="field" style={{ margin: 0, minWidth: 180, maxWidth: 260 }}>
                <label htmlFor="ve-bank-category">Category</label>
                <select id="ve-bank-category" aria-label="Transaction category" value={selectedCategory} onChange={(event) => setCategory(event.target.value)}>
                  <option>All</option>
                  {monthCategories.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}
                </select>
              </div>
            </div>
          )}
          {groups.map((group) => (
            <section key={group.currency} style={{ marginBottom: 8 }}>
              <h3 className="section-title" style={{ fontSize: 18, margin: '18px 0 8px' }}>{group.currency}</h3>
              {group.accounts.length ? group.accounts.map((account) => <BankAccountBlock key={account.id} account={account} model={model} range={range} query={query} category={selectedCategory} />) : <Message>No {group.currency} account was returned.</Message>}
            </section>
          ))}
        </>
      )}
    </>
  )
}

function Funds({ model }) {
  const reporting = useReportingPeriod(model.today)
  const rows = rowsInPeriod([...model.income, ...model.expenses], reporting)
  const summary = monthSummary(rows)
  const months = monthsInPeriod(reporting)
  const days = months.flatMap((month) => dailyAmounts(rows, month))
  const sources = sourceAnalysis(rows)
  const maxSource = Math.max(...sources.flatMap((item) => [item.income, item.expense]), 1)
  const ordersNote = accessMessage(model.access.orders, '', COPY.ordersBlocked)
  const expensesNote = accessMessage(model.access.expenses, model.access.expenses === 'empty' ? COPY.expensesEmpty : '', COPY.expensesBlocked)
  return (
    <>
      <h2 className="sr-only">Funds</h2>
      <div className="grid-3 funds-totals" style={{ marginBottom: 16 }}>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-red)' }}>{model.access.expenses === 'ok' || model.access.expenses === 'empty' ? formatZmw(summary.expense) : '—'}</div><div className="stat-desc">Expense</div></div></section>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{model.access.orders === 'ok' || model.access.orders === 'empty' ? formatZmw(summary.income) : '—'}</div><div className="stat-desc">Total received</div></div></section>
      </div>
      {ordersNote && model.access.orders !== 'ok' && model.access.orders !== 'empty' && <p className="vh-status" role="status">{ordersNote}</p>}
      {expensesNote && model.access.expenses !== 'ok' && <p className="vh-status" role="status">{expensesNote}</p>}
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
          <Panel title="Account analysis">
            <div role="img" aria-label="Expense and income by source">
              {sources.map((item) => (
                <div key={item.name} style={{ margin: '12px 0' }}>
                  <strong>{item.name}</strong>
                  <span style={{ display: 'block', height: 10, marginTop: 6, borderRadius: 99, background: 'var(--rag-red)', width: `${item.expense / maxSource * 100}%` }} />
                  <span style={{ display: 'block', height: 10, marginTop: 4, borderRadius: 99, background: 'var(--rag-green)', width: `${item.income / maxSource * 100}%` }} />
                </div>
              ))}
            </div>
            <ul className="vh-list">
              {sources.map((item) => <li key={item.name}><div><strong>{item.name}</strong><small>Expense {formatZmw(item.expense)} · Income {formatZmw(item.income)}</small></div></li>)}
            </ul>
          </Panel>
        </>
      ) : <Message>{COPY.fundsEmpty}</Message>}
      {months.map((month) => <MonthCalendar key={month} month={month} days={dailyAmounts(rows, month)} />)}
    </>
  )
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
      ) : <Message>{empty}</Message>}
    </Panel>
  )
}

function BudgetProjection({ model }) {
  const reporting = useReportingPeriod(model.today)
  const months = new Set(monthsInPeriod(reporting))
  const access = model.access.bankTransactions
  if (access !== 'ok' && access !== 'empty') return <Message>{accessMessage(access, '', COPY.bankTxnsBlocked)}</Message>
  const budget = model.budget
  return (
    <>
      <h2 className="section-title">Monthly provider projection</h2>
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
            const rows = budget.lines.filter((line) => line.currency === currency && (currency === 'USD' ? line.unitUsd : line.unitZmw) != null).map((line) => ({
              id: line.plan,
              title: `${line.plan} (${line.count} active)`,
              amount: currency === 'USD' ? line.unitUsd : line.unitZmw,
              unit: currency,
            }))
            return <AccountBars key={currency} rows={rows} label={`${currency} plan prices`} />
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
        ) : <Message>No active family accounts, so there are no plan prices in the projection.</Message>}
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
        ) : <Message>{budget.actual.source}</Message>}
      </Panel>
    </>
  )
}

function categoryTotals(rows) {
  const totals = new Map()
  for (const row of rows) totals.set(row.category, (totals.get(row.category) || 0) + row.amount)
  return [...totals.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
}

function Budget({ model }) {
  const reporting = useReportingPeriod(model.today)
  const expenses = rowsInPeriod(model.expenses, reporting)
  const income = rowsInPeriod(model.income, reporting)
  const weeks = weeklyBudget(expenses).filter((item) => weekOverlapsPeriod(item.week, reporting))
  const [week, setWeek] = useState(weeks.at(-1)?.week || '')
  const selected = weeks.find((item) => item.week === week) || weeks.at(-1) || null
  const selectedWeek = selected?.week || ''
  const expenseMessage = accessMessage(model.access.expenses, COPY.expensesEmpty, COPY.expensesBlocked)
  const incomeMessage = accessMessage(model.access.orders, 'No income was returned for this account.', COPY.ordersBlocked)
  return (
    <>
      <BudgetProjection model={model} />
      {expenseMessage ? <Message>{expenseMessage}</Message> : (
        <Panel title="Weekly expense budget">
          {weeks.length > 0 && (
            <div className="field" style={{ maxWidth: 240 }}><label>Week
                  <select aria-label="Budget week" value={selectedWeek} onChange={(event) => setWeek(event.target.value)}>
                {weeks.map((item) => <option key={item.week} value={item.week}>Week of {item.week}</option>)}
              </select>
            </label></div>
          )}
          {selected ? <DataTable rows={selected.categories.map((row) => ({ ...row, id: row.name }))} empty={COPY.budgetEmpty} columns={[{ key: 'name', label: 'Category', cell: (row) => row.name }, { key: 'amount', label: 'Recorded', cell: (row) => formatZmw(row.amount) }]} /> : <Message>{COPY.budgetEmpty}</Message>}
          {selected && <p className="stat-desc">Week total {formatZmw(selected.total)}</p>}
        </Panel>
      )}
      <div className="grid">
        <CategoryTable title="Income categories" rows={categoryTotals(income)} empty={incomeMessage || 'No income was returned for this account.'} />
        <CategoryTable title="Expense categories" rows={categoryTotals(expenses)} empty={expenseMessage || COPY.expensesEmpty} />
      </div>
    </>
  )
}

function Marketing({ model }) {
  const reporting = useReportingPeriod(model.today)
  const posts = rowsInPeriod(model.posts, reporting)
  const spend = rowsInPeriod(model.spend, reporting)
  const acquisition = acquisitionSummary(spend)
  const postsMessage = accessMessage(model.access.marketing, COPY.postsEmpty, COPY.postsBlocked)
  const spendMessage = accessMessage(model.access.marketingSpend, COPY.cacEmpty, COPY.cacBlocked)
  const cac = acquisition.value == null ? 'Not recorded' : formatZmw(acquisition.value)
  return (
    <div className="grid">
      <Panel title="Scheduled posts">
        {postsMessage || !posts.length ? <Message>{postsMessage || COPY.postsEmpty}</Message> : (
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
        {spendMessage || !spend.length ? <Message>{spendMessage || COPY.cacEmpty}</Message> : (
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
  )
}

export default function VeWorkspace({ business, token = '', model = null, today, loadWorkspace }) {
  const clock = today || todayIso()
  const [remote, setRemote] = useState(null)
  const [remoteToken, setRemoteToken] = useState('')
  const [failureToken, setFailureToken] = useState('')
  useEffect(() => {
    if (model != null || !token) return undefined
    let cancelled = false
    const run = loadWorkspace || ((accessToken) => fetchVeWorkspace({ token: accessToken, today: clock, env: import.meta.env }))
    run(token).then((next) => {
      if (!cancelled) { setRemote(next); setRemoteToken(token) }
    }).catch(() => { if (!cancelled) setFailureToken(token) })
    return () => { cancelled = true }
  }, [model, token, clock, loadWorkspace])
  const loaded = token && remoteToken === token ? remote : null
  const failed = Boolean(token) && failureToken === token && !loaded
  const view = model || loaded || (failed ? buildWorkspace(emptySources('error'), clock) : (!token ? buildWorkspace(emptySources('signed-out'), clock) : null))
  if (!view) return <div className="wrap biz"><p className="empty" role="status">{COPY.loading}</p><PageFooter /></div>
  return <VePages business={business} view={view} />
}

function VePages({ business, view }) {
  return (
    <div className="wrap biz">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings · {business?.code || 'VE'}</p><h1>{business?.name || 'Vidmar Entertainment'}</h1></div></div>
      <SlideTabs label="VE sections" tabs={['Overview', 'Family Accounts', 'Customers', 'Funds', 'Accounts', 'Budget', 'Marketing']}>
        <div><Overview model={view} /></div>
        <div><FamilyAccounts model={view} /></div>
        <div><Customers model={view} /></div>
        <div><Funds model={view} /></div>
        <div><Accounts model={view} /></div>
        <div><Budget model={view} /></div>
        <div><Marketing model={view} /></div>
      </SlideTabs>
      <PageFooter />
    </div>
  )
}
