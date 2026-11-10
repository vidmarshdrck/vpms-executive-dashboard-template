import { useEffect, useState } from 'react'
import SlideTabs from './SlideTabs.jsx'
import { Donut, PageFooter } from './Donut.jsx'
import { formatZmw, slicesBy } from './books.js'
import { ColumnLabel } from './icons.jsx'
import { accountPeriod, accountsByCurrency, categoryLabel, filterBankTransactions, formatMoney, formatRate, fxText } from './bankBudget.js'
import { categoryShare, compactAmount, dailyAmounts, latestMonth, monthLabel, monthRows, monthSummary, shiftMonth, sourceAnalysis } from './fundsMonth.js'
import { StandardOverview } from './businessPanels.jsx'
import { glanceFromVe } from './businessSources.js'
import { COPY, buildWorkspace, emptySources, fetchVeWorkspace, filterCustomers, todayIso, whatsappHref } from './veData.js'

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

function DataTable({ columns, rows, empty }) {
  return (
    <div className="tbl-scroll">
      <table className="data">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.cell(row)}</td>)}</tr>
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

function PaymentDialog({ person, onClose }) {
  if (!person) return null
  const payment = person.lastPayment
  return (
    <section className="card" role="dialog" aria-modal="true" aria-label={`${person.name} last payment`} style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>{person.name}</h2><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></div>
      <div className="card-body">{payment ? <p>Last payment {payment.date} · {formatZmw(payment.amount)}</p> : <p>No payment recorded.</p>}</div>
    </section>
  )
}

function NameButtons({ people, onOpen }) {
  if (!people.length) return 'No one is connected.'
  return people.map((person) => <button type="button" className="btn btn-ghost btn-sm" key={`${person.cid}-${person.slot || person.name}`} onClick={() => onOpen(person)}>{person.name}</button>)
}

function AccountTable({ accounts, empty, onOpen }) {
  return (
    <DataTable
      rows={accounts}
      empty={empty}
      columns={[
        { key: 'names', label: <ColumnLabel icon="users">Account / Names</ColumnLabel>, cell: (row) => <NameButtons people={row.members} onOpen={onOpen} /> },
        { key: 'status', label: <ColumnLabel icon="activity">Status</ColumnLabel>, cell: (row) => <StatusChip value={row.activity} /> },
        { key: 'plan', label: <ColumnLabel icon="package">Plan</ColumnLabel>, cell: (row) => row.plan },
        { key: 'due', label: <ColumnLabel icon="calendar">Due date</ColumnLabel>, cell: (row) => row.dueDate },
        { key: 'email', label: <ColumnLabel icon="mail">Email</ColumnLabel>, cell: (row) => row.email || <span aria-label="Email not recorded" /> },
        { key: 'slots', label: <ColumnLabel icon="layers">Slots</ColumnLabel>, cell: (row) => `${row.slotsTaken} of ${row.slotsTotal}` },
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
  const [person, setPerson] = useState(null)
  const message = accessMessage(model.access.familyAccounts, COPY.familyEmpty, COPY.familyBlocked)
  const plansMessage = accessMessage(model.access.products, COPY.plansEmpty, COPY.plansEmpty)
  return (
    <>
      <h2 className="sr-only">Family accounts</h2>
      <p className="stat-desc">Active means the due date is today or later. Paid status is shown separately.</p>
      <PaymentDialog person={person} onClose={() => setPerson(null)} />
      {message ? <Message>{message}</Message> : (
        <>
          <Panel title="Active accounts"><AccountTable accounts={model.activeAccounts} empty={COPY.activeEmpty} onOpen={setPerson} /></Panel>
          <Panel title="Inactive accounts"><AccountTable accounts={model.inactiveAccounts} empty={COPY.inactiveEmpty} onOpen={setPerson} /></Panel>
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
            {rows.length > 0 && <p className="stat-desc">Total spent on this list: {formatZmw(rows.reduce((sum, row) => sum + row.totalSpent, 0))}</p>}
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
      ) : <Message>No {center.toLowerCase()} was returned for this month.</Message>}
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

function AmountCalendar({ days, month }) {
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

function MonthNav({ month, onMonth, name }) {
  return (
    <div className="vh-actions">
      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Previous month for ${name}`} onClick={() => onMonth(shiftMonth(month, -1))}>Previous</button>
      <strong aria-live="polite">{monthLabel(month)}</strong>
      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Next month for ${name}`} onClick={() => onMonth(shiftMonth(month, 1))}>Next</button>
    </div>
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

function BankAccountBlock({ account, model, month, query, category }) {
  const period = accountPeriod(account, model.bankTransactions, month)
  const own = model.bankTransactions.filter((row) => row.accountId === account.id)
  const trail = filterBankTransactions(own, { month, query, category })
  const spend = filterBankTransactions(own, { month }).filter((row) => row.amount < 0).map((row) => ({ category: categoryLabel(row.category), amount: -row.amount }))
  const money = (amount) => formatMoney(amount, account.currency)
  const hasBalance = own.some((row) => row.balance != null)
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
            <div><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-green)' }}>{money(period.moneyIn)}</div><div className="stat-desc">In this month</div></div>
            <div><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-red)' }}>{money(period.moneyOut)}</div><div className="stat-desc">Out this month</div></div>
          </div>
          <p className="stat-desc">{hasBalance ? 'Current balance is the latest transaction balance.' : 'Current balance is the opening balance.'}{account.openingBalance != null ? ` Opening balance ${money(account.openingBalance)}.` : ''}</p>
        </div>
      </article>
      {period.points.length ? <BalanceChart title="Balance over time" points={period.points} currency={account.currency} /> : <Panel title="Balance over time"><Message>No balance points in this month.</Message></Panel>}
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

function Accounts({ model, month, onMonth }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const access = model.access.bankAccounts
  const readable = access === 'ok' || access === 'empty'
  const monthCategories = [...new Set(model.bankTransactions.filter((row) => row.date.startsWith(`${month}-`)).map((row) => row.category))].sort()
  const selectedCategory = monthCategories.includes(category) ? category : 'All'
  const groups = accountsByCurrency(model.bankAccounts)
  return (
    <>
      <div className="topbar">
        <h2 className="sr-only">Accounts</h2>
        <MonthNav month={month} onMonth={onMonth} name="Accounts" />
      </div>
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
              {group.accounts.length ? group.accounts.map((account) => <BankAccountBlock key={account.id} account={account} model={model} month={month} query={query} category={selectedCategory} />) : <Message>No {group.currency} account was returned.</Message>}
            </section>
          ))}
        </>
      )}
    </>
  )
}

function Funds({ model, month, onMonth }) {
  const rows = monthRows([...model.income, ...model.expenses], month)
  const summary = monthSummary(rows)
  const days = dailyAmounts(rows, month)
  const sources = sourceAnalysis(rows)
  const maxSource = Math.max(...sources.flatMap((item) => [item.income, item.expense]), 1)
  const ordersNote = accessMessage(model.access.orders, '', COPY.ordersBlocked)
  const expensesNote = accessMessage(model.access.expenses, model.access.expenses === 'empty' ? COPY.expensesEmpty : '', COPY.expensesBlocked)
  return (
    <>
      <div className="topbar">
        <h2 className="sr-only">Funds</h2>
        <MonthNav month={month} onMonth={onMonth} name="Funds" />
      </div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-red)' }}>{formatZmw(summary.expense)}</div><div className="stat-desc">Expense</div></div></section>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28, color: 'var(--rag-green)' }}>{formatZmw(summary.income)}</div><div className="stat-desc">Income</div></div></section>
        <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{formatZmw(summary.total)}</div><div className="stat-desc">Total</div></div></section>
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
          <AmountCalendar days={days} month={month} />
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
  const access = model.access.bankTransactions
  if (access !== 'ok' && access !== 'empty') return <Message>{accessMessage(access, '', COPY.bankTxnsBlocked)}</Message>
  const budget = model.budget
  return (
    <>
      <h2 className="section-title">Monthly provider projection</h2>
      <p className="stat-desc">{budget.formula}</p>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <section className="card"><div className="card-body">
          <div className="stat-num" style={{ fontSize: 28 }} aria-label="Current FX rate">{budget.fx.rate == null ? 'Not recorded' : formatRate(budget.fx.rate)}</div>
          <div className="stat-desc">Current FX rate, ZMW per USD{budget.fx.month ? `, ${monthLabel(budget.fx.month)}` : ''}</div>
          <p className="stat-desc">{budget.fx.source}</p>
        </div></section>
        <section className="card"><div className="card-body">
          <div className="stat-num" style={{ fontSize: 28 }}>{budget.projection == null ? 'Not recorded' : formatZmw(budget.projection)}</div>
          <div className="stat-desc">Projected monthly cost</div>
        </div></section>
        <section className="card"><div className="card-body">
          <div className="stat-num" style={{ fontSize: 28 }}>{budget.gapLatest == null ? 'Not recorded' : formatZmw(budget.gapLatest)}</div>
          <div className="stat-desc">Gap against the latest month</div>
          <p className="stat-desc">{budget.gapLabel}</p>
          {budget.gapAverage != null && <p className="stat-desc">Gap against the 12-month average: {formatZmw(budget.gapAverage)}</p>}
        </div></section>
      </div>
      <Panel title="Where the projection comes from" note="USD plan prices are the typical orig_amount_usd on matching bank transactions. ve.products does not store a USD price. Kwacha-billed plans use the kwacha amount on those same rows.">
        {budget.lines.length ? (
          <DataTable
            rows={budget.lines.map((line) => ({ ...line, id: line.plan }))}
            empty="No active family accounts."
            columns={[
              { key: 'plan', label: 'Plan', cell: (row) => `${row.plan} (${row.count} active)` },
              { key: 'price', label: 'Typical price', cell: (row) => (row.currency === 'USD' && row.unitUsd != null ? formatMoney(row.unitUsd, 'USD') : row.currency === 'ZMW' && row.unitZmw != null ? formatZmw(row.unitZmw) : 'Not recorded') },
              { key: 'each', label: 'Each account', cell: (row) => (row.unitZmw == null ? 'Not recorded' : formatZmw(row.unitZmw)) },
              { key: 'total', label: 'Monthly', cell: (row) => (row.total == null ? 'Left out' : formatZmw(row.total)) },
              { key: 'source', label: 'Where this comes from', cell: (row) => <span style={{ display: 'block', maxWidth: 360 }}>{row.source}</span> },
            ]}
          />
        ) : <Message>No active family accounts, so there are no plan prices in the projection.</Message>}
        <p className="stat-desc">USD plans converted {formatZmw(budget.usdConverted)}. Kwacha-billed plans {formatZmw(budget.kwachaBilled)}. Average monthly bank charges {formatZmw(budget.charges.average)}.</p>
        <p className="stat-desc">{budget.charges.source}</p>
        {!budget.complete && <p className="stat-desc">Plans with no matched price are left out of the projected total.</p>}
      </Panel>
      <Panel title="Actual provider subscriptions">
        {budget.actual.latest ? (
          <>
            <p className="stat-desc">{budget.actual.source}</p>
            <p>Latest month, {monthLabel(budget.actual.latest.month)}: {formatZmw(budget.actual.latest.amount)}</p>
            <p>12-month average: {formatZmw(budget.actual.average)}</p>
            <DataTable
              rows={budget.actual.months.map((row) => ({ ...row, id: row.month }))}
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

function Budget({ model }) {
  const weeks = model.weeks
  const [week, setWeek] = useState(weeks.at(-1)?.week || '')
  const selected = weeks.find((item) => item.week === week) || null
  const expenseMessage = accessMessage(model.access.expenses, COPY.expensesEmpty, COPY.expensesBlocked)
  const incomeMessage = accessMessage(model.access.orders, 'No income was returned for this account.', COPY.ordersBlocked)
  return (
    <>
      <BudgetProjection model={model} />
      <p className="stat-desc">{COPY.budgetNote}</p>
      {expenseMessage ? <Message>{expenseMessage}</Message> : (
        <Panel title="Weekly expense budget">
          {weeks.length > 0 && (
            <div className="field" style={{ maxWidth: 240 }}><label>Week
              <select aria-label="Budget week" value={week} onChange={(event) => setWeek(event.target.value)}>
                {weeks.map((item) => <option key={item.week} value={item.week}>Week of {item.week}</option>)}
              </select>
            </label></div>
          )}
          {selected ? <DataTable rows={selected.categories.map((row) => ({ ...row, id: row.name }))} empty={COPY.budgetEmpty} columns={[{ key: 'name', label: 'Category', cell: (row) => row.name }, { key: 'amount', label: 'Recorded', cell: (row) => formatZmw(row.amount) }]} /> : <Message>{COPY.budgetEmpty}</Message>}
          {selected && <p className="stat-desc">Week total {formatZmw(selected.total)}</p>}
        </Panel>
      )}
      <div className="grid">
        <CategoryTable title="Income categories" rows={model.incomeCategories} empty={incomeMessage || 'No income was returned for this account.'} />
        <CategoryTable title="Expense categories" rows={model.expenseCategories} empty={expenseMessage || COPY.expensesEmpty} />
      </div>
    </>
  )
}

function Marketing({ model }) {
  const postsMessage = accessMessage(model.access.marketing, COPY.postsEmpty, COPY.postsBlocked)
  const spendMessage = accessMessage(model.access.marketingSpend, COPY.cacEmpty, COPY.cacBlocked)
  const cac = model.acquisition.value == null ? 'Not recorded' : formatZmw(model.acquisition.value)
  return (
    <div className="grid">
      <Panel title="Scheduled posts">
        {postsMessage || !model.posts.length ? <Message>{postsMessage || COPY.postsEmpty}</Message> : (
          <DataTable
            rows={model.posts}
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
        {spendMessage || !model.spend.length ? <Message>{spendMessage || COPY.cacEmpty}</Message> : (
          <>
            <div className="stat-num" style={{ fontSize: 28 }}>CAC {cac}</div>
            <p className="stat-desc">CAC is spend divided by conversions where a conversion count was recorded. A stored CAC value is shown beside it.</p>
            <DataTable
              rows={model.spend}
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
  const [month, setMonth] = useState(() => latestMonth([
    ...view.income.map((row) => row.date),
    ...view.expenses.map((row) => row.date),
    ...view.bankTransactions.map((row) => row.date),
  ], view.today))
  return (
    <div className="wrap biz">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings · {business?.code || 'VE'}</p><h1>{business?.name || 'Vidmar Entertainment'}</h1><p className="sub">Family accounts, customers, bank accounts, funds, budget, and marketing.</p></div></div>
      <SlideTabs label="VE sections" tabs={['Overview', 'Family Accounts', 'Customers', 'Funds', 'Accounts', 'Budget', 'Marketing']}>
        <div><Overview model={view} /></div>
        <div><FamilyAccounts model={view} /></div>
        <div><Customers model={view} /></div>
        <div><Funds model={view} month={month} onMonth={setMonth} /></div>
        <div><Accounts model={view} month={month} onMonth={setMonth} /></div>
        <div><Budget model={view} /></div>
        <div><Marketing model={view} /></div>
      </SlideTabs>
      <PageFooter />
    </div>
  )
}
