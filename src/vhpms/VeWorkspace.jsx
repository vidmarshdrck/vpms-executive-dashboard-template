import { useEffect, useState } from 'react'
import SlideTabs from './SlideTabs.jsx'
import { Donut, PageFooter } from './Donut.jsx'
import { formatZmw, moneyTotal, slicesBy } from './books.js'
import { COPY, buildWorkspace, emptySources, fetchVeWorkspace, filterFunds, fundsByMonth, todayIso } from './veData.js'

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

function AccountTable({ accounts, empty }) {
  return (
    <DataTable
      rows={accounts}
      empty={empty}
      columns={[
        { key: 'account', label: 'Account', cell: (row) => row.id },
        { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.activity} /> },
        { key: 'plan', label: 'Plan', cell: (row) => row.plan },
        { key: 'due', label: 'Due date', cell: (row) => row.dueDate },
        { key: 'password', label: 'Password', cell: (row) => <span aria-label={row.passwordStored ? 'Password stored' : 'Password not stored'}>{row.passwordLabel}</span> },
        { key: 'slots', label: 'Slots', cell: (row) => `${row.slotsTaken} of ${row.slotsTotal}` },
        { key: 'paid', label: 'Paid status', cell: (row) => <StatusChip value={row.paidStatus} /> },
        { key: 'agent', label: 'Agent', cell: (row) => row.agent || '—' },
      ]}
    />
  )
}

function Overview({ model }) {
  const message = accessMessage(model.access.familyAccounts, COPY.familyEmpty, COPY.familyBlocked)
  const stats = [['Accounts', model.overview.accounts], ['Active', model.overview.active], ['Inactive', model.overview.inactive], ['People connected', model.overview.connected]]
  return (
    <>
      <h2 className="section-title">Overview</h2>
      {message ? <Message>{message}</Message> : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>{stats.map(([label, value]) => <section className="card" key={label}><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{value}</div><div className="stat-desc">{label}</div></div></section>)}</div>
          {model.access.customers === 'blocked' && <p className="vh-status" role="status">{COPY.customersBlocked} Slot references stay visible.</p>}
          <div className="grid-3">
            {model.accounts.map((account) => (
              <section className="card" key={account.id}>
                <div className="card-head"><h2>{account.plan}</h2><StatusChip value={account.activity} /></div>
                <div className="card-body">
                  <p className="stat-desc">Account {account.id} · due {account.dueDate} · {account.slotsTaken} of {account.slotsTotal} slots taken</p>
                  <h2 style={{ fontSize: 15, margin: '12px 0' }}>Who is connected</h2>
                  {account.members.length ? <ul className="vh-list">{account.members.map((member) => <li key={`${account.id}-${member.slot}`}><div><strong>{member.name}</strong>{member.unmatched && <small>Name not visible</small>}</div></li>)} </ul> : <p className="empty">No one is connected.</p>}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function FamilyAccounts({ model }) {
  const message = accessMessage(model.access.familyAccounts, COPY.familyEmpty, COPY.familyBlocked)
  const plansMessage = accessMessage(model.access.products, COPY.plansEmpty, COPY.plansEmpty)
  return (
    <>
      <h2 className="section-title">Family accounts</h2>
      <p className="stat-desc">Active means the due date is today or later. Paid status is shown separately.</p>
      {message ? <Message>{message}</Message> : (
        <>
          <h2 className="section-title">Active</h2>
          <Panel title="Active accounts"><AccountTable accounts={model.activeAccounts} empty={COPY.activeEmpty} /></Panel>
          <h2 className="section-title">Inactive</h2>
          <Panel title="Inactive accounts"><AccountTable accounts={model.inactiveAccounts} empty={COPY.inactiveEmpty} /></Panel>
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
  const message = accessMessage(model.access.customers, COPY.customersEmpty, COPY.customersBlocked)
  const statuses = [...new Set(model.customers.map((row) => row.status))]
  const rows = status === 'All' ? model.customers : model.customers.filter((row) => row.status === status)
  return (
    <>
      <h2 className="section-title">Customers</h2>
      {message ? <Message>{message}</Message> : (
        <Panel title="Customers">
          <div className="vh-toolbar">
            <label>Status
              <select aria-label="Customer status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option>All</option>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <DataTable
            rows={rows}
            empty={COPY.customersEmpty}
            columns={[
              { key: 'name', label: 'Name', cell: (row) => row.name },
              { key: 'due', label: 'Due date', cell: (row) => row.dueDate },
              { key: 'products', label: 'Products', cell: (row) => row.products },
              { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.status} /> },
              { key: 'spent', label: 'Total spent', cell: (row) => formatZmw(row.totalSpent) },
            ]}
          />
          {rows.length > 0 && <p className="stat-desc">Total spent on this list: {formatZmw(rows.reduce((sum, row) => sum + row.totalSpent, 0))}</p>}
        </Panel>
      )}
    </>
  )
}

function FundsCalendar({ rows }) {
  const dated = rows.map((row) => row.date).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort()
  const [cursor, setCursor] = useState(() => (dated.at(-1) || todayIso()).slice(0, 7))
  const [year, month] = cursor.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const offset = (first.getUTCDay() + 6) % 7
  const undated = rows.filter((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date || ''))
  const label = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  function shift(delta) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1))
    setCursor(next.toISOString().slice(0, 7))
  }
  return (
    <section className="card"><div className="card-head"><h2>{label}</h2><div className="vh-actions"><button className="btn btn-ghost btn-sm" type="button" aria-label="Previous month" onClick={() => shift(-1)}>Previous</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => setCursor(todayIso().slice(0, 7))}>Today</button><button className="btn btn-ghost btn-sm" type="button" aria-label="Next month" onClick={() => shift(1)}>Next</button></div></div>
      <div className="card-body">
        <div className="vh-calendar-scroll" tabIndex="0" aria-label="Funds calendar">
          <div className="vh-calendar">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <strong key={day}>{day}</strong>)}
            {Array.from({ length: offset }, (_, index) => <div key={`pad-${index}`} className="vh-day vh-blank" />)}
            {Array.from({ length: days }, (_, index) => {
              const date = `${cursor}-${String(index + 1).padStart(2, '0')}`
              const matches = rows.filter((row) => row.date === date)
              return <div key={date} className="vh-day"><span>{index + 1}</span>{matches.map((row) => <p key={row.id}>{row.kind === 'income' ? 'Income' : 'Expense'} · {row.title} · {formatZmw(row.amount)}</p>)}</div>
            })}
          </div>
        </div>
        {undated.length > 0 && <div><h2 className="section-title">Not dated</h2>{undated.map((row) => <p key={row.id}>{row.title} · {formatZmw(row.amount)}</p>)}</div>}
      </div>
    </section>
  )
}

function FundsGraph({ rows }) {
  const points = fundsByMonth(rows)
  const max = Math.max(...points.flatMap((point) => [point.income, point.expense]), 1)
  return (
    <section className="card"><div className="card-head"><h2>Income and expenditure by month</h2></div><div className="card-body">
      <div role="img" aria-label="Income and expenditure by month">
        {points.map((point) => (
          <div key={point.month} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 12, margin: '12px 0' }}>
            <strong>{point.month}</strong>
            <div>
              {point.income > 0 && <span style={{ display: 'block', height: 12, margin: '4px 0', borderRadius: 3, background: 'var(--brand)', width: `${point.income / max * 100}%` }} />}
              <small>Income {formatZmw(point.income)}</small>
              {point.expense > 0 && <span style={{ display: 'block', height: 12, margin: '4px 0', borderRadius: 3, background: '#8fb4e3', width: `${point.expense / max * 100}%` }} />}
              <small>Expense {formatZmw(point.expense)}</small>
            </div>
          </div>
        ))}
      </div>
    </div></section>
  )
}

function FundsPie({ rows }) {
  const income = slicesBy(rows.filter((row) => row.kind === 'income').map((row) => ({ group: row.category, amount: row.amount })), 'group')
  const expenses = slicesBy(rows.filter((row) => row.kind === 'expense').map((row) => ({ group: row.category, amount: row.amount })), 'group')
  return (
    <div className="grid">
      <Panel title="Income category split">{income.length ? <Donut items={income} center="Income" format={formatZmw} /> : <Message>No income was returned for this account.</Message>}</Panel>
      <Panel title="Expense category split">{expenses.length ? <Donut items={expenses} center="Expenses" format={formatZmw} /> : <Message>No expenses were returned for this account.</Message>}</Panel>
    </div>
  )
}

function Funds({ model }) {
  const [filter, setFilter] = useState('all')
  const rows = filterFunds(model.income, model.expenses, filter)
  const ordersNote = accessMessage(model.access.orders, '', COPY.ordersBlocked)
  const expensesNote = accessMessage(model.access.expenses, model.access.expenses === 'empty' ? COPY.expensesEmpty : '', COPY.expensesBlocked)
  return (
    <>
      <h2 className="section-title">Funds</h2>
      <p className="stat-desc">Income is recorded orders. Expenses are recorded costs.</p>
      <div className="vh-toolbar">
        <label>Show
          <select aria-label="Income and expense filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>
      </div>
      {ordersNote && model.access.orders !== 'ok' && model.access.orders !== 'empty' && <p className="vh-status" role="status">{ordersNote}</p>}
      {expensesNote && model.access.expenses !== 'ok' && <p className="vh-status" role="status">{expensesNote}</p>}
      <SlideTabs label="Funds views" tabs={['Table', 'Calendar', 'Graph', 'Pie']}>
        <div>
          {rows.length ? (
            <Panel title="Income and expenditure">
              <DataTable
                rows={rows}
                empty={COPY.fundsEmpty}
                columns={[
                  { key: 'date', label: 'Date', cell: (row) => row.date || 'Not dated' },
                  { key: 'title', label: 'Description', cell: (row) => row.title },
                  { key: 'kind', label: 'Type', cell: (row) => (row.kind === 'income' ? 'Income' : 'Expense') },
                  { key: 'category', label: 'Category', cell: (row) => row.category },
                  { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.status} /> },
                  { key: 'amount', label: 'Amount', cell: (row) => formatZmw(row.amount) },
                ]}
              />
              <p className="stat-desc">Total {formatZmw(moneyTotal(rows))}</p>
            </Panel>
          ) : <Message>{COPY.fundsEmpty}</Message>}
        </div>
        <div>{rows.length ? <FundsCalendar rows={rows} /> : <Message>{COPY.fundsEmpty}</Message>}</div>
        <div>{rows.length ? <FundsGraph rows={rows} /> : <Message>{COPY.fundsEmpty}</Message>}</div>
        <div>{rows.length ? <FundsPie rows={rows} /> : <Message>{COPY.fundsEmpty}</Message>}</div>
      </SlideTabs>
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

function Budget({ model }) {
  const weeks = model.weeks
  const [week, setWeek] = useState(weeks.at(-1)?.week || '')
  const selected = weeks.find((item) => item.week === week) || null
  const expenseMessage = accessMessage(model.access.expenses, COPY.expensesEmpty, COPY.expensesBlocked)
  const incomeMessage = accessMessage(model.access.orders, 'No income was returned for this account.', COPY.ordersBlocked)
  return (
    <>
      <h2 className="section-title">Weekly expense budget</h2>
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
  return (
    <div className="wrap biz">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings · {business?.code || 'VE'}</p><h1>{business?.name || 'Vidmar Entertainment'}</h1><p className="sub">Family accounts, customers, funds, budget, and marketing.</p></div></div>
      <SlideTabs label="VE sections" tabs={['Overview', 'Family Accounts', 'Customers', 'Funds', 'Budget', 'Marketing']}>
        <div><Overview model={view} /></div>
        <div><FamilyAccounts model={view} /></div>
        <div><Customers model={view} /></div>
        <div><Funds model={view} /></div>
        <div><Budget model={view} /></div>
        <div><Marketing model={view} /></div>
      </SlideTabs>
      <PageFooter />
    </div>
  )
}
