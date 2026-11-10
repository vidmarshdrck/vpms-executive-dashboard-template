import { useEffect, useState } from 'react'
import SlideTabs from './SlideTabs.jsx'
import { Donut, PageFooter } from './Donut.jsx'
import { formatZmw, slicesBy } from './books.js'
import { categoryShare, compactAmount, dailyAmounts, monthRows, monthSummary, shiftMonth, sourceAnalysis } from './fundsMonth.js'
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

function moneyTile(value) {
  return value == null ? '—' : formatZmw(value)
}

function Stat({ label, value }) {
  return <section className="card"><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{value}</div><div className="stat-desc">{label}</div></div></section>
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
        { key: 'names', label: 'Account / Names', cell: (row) => <NameButtons people={row.members} onOpen={onOpen} /> },
        { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.activity} /> },
        { key: 'plan', label: 'Plan', cell: (row) => row.plan },
        { key: 'due', label: 'Due date', cell: (row) => row.dueDate },
        { key: 'email', label: 'Email', cell: (row) => row.email || <span aria-label="Email not recorded" /> },
        { key: 'slots', label: 'Slots', cell: (row) => `${row.slotsTaken} of ${row.slotsTotal}` },
        { key: 'paid', label: 'Paid status', cell: (row) => <StatusChip value={row.paidStatus} /> },
        { key: 'agent', label: 'Agent', cell: (row) => row.agent || '—' },
      ]}
    />
  )
}

function Overview({ model }) {
  const [person, setPerson] = useState(null)
  const message = accessMessage(model.access.familyAccounts, COPY.familyEmpty, COPY.familyBlocked)
  const finance = model.overview.finance
  const counts = model.access.familyAccounts === 'ok'
    ? [['Accounts', model.overview.accounts], ['Active', model.overview.active], ['Inactive', model.overview.inactive], ['People connected', model.overview.connected]]
    : []
  return (
    <>
      <h2 className="section-title">Overview</h2>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {counts.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
        <Stat label="Total spent" value={moneyTile(finance.expenses)} />
        <Stat label="Income" value={moneyTile(finance.income)} />
        <Stat label="Balance on hand" value={moneyTile(finance.balance)} />
        <Stat label="Profit generated" value={moneyTile(finance.profit)} />
      </div>
      <PaymentDialog person={person} onClose={() => setPerson(null)} />
      {message ? <Message>{message}</Message> : (
        <Panel title="Family accounts">
          {model.access.customers === 'blocked' && <p className="vh-status" role="status">{COPY.customersBlocked} Slot references stay visible.</p>}
          <DataTable
            rows={model.accounts}
            empty={COPY.familyEmpty}
            columns={[
              { key: 'plan', label: 'Plan', cell: (row) => row.plan },
              { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.activity} /> },
              { key: 'due', label: 'Due date', cell: (row) => row.dueDate },
              { key: 'names', label: 'Connected', cell: (row) => <NameButtons people={row.members} onOpen={setPerson} /> },
              { key: 'slots', label: 'Slots', cell: (row) => `${row.slotsTaken} of ${row.slotsTotal}` },
            ]}
          />
        </Panel>
      )}
    </>
  )
}

function FamilyAccounts({ model }) {
  const [person, setPerson] = useState(null)
  const message = accessMessage(model.access.familyAccounts, COPY.familyEmpty, COPY.familyBlocked)
  const plansMessage = accessMessage(model.access.products, COPY.plansEmpty, COPY.plansEmpty)
  return (
    <>
      <h2 className="section-title">Family accounts</h2>
      <p className="stat-desc">Active means the due date is today or later. Paid status is shown separately.</p>
      <PaymentDialog person={person} onClose={() => setPerson(null)} />
      {message ? <Message>{message}</Message> : (
        <>
          <h2 className="section-title">Active</h2>
          <Panel title="Active accounts"><AccountTable accounts={model.activeAccounts} empty={COPY.activeEmpty} onOpen={setPerson} /></Panel>
          <h2 className="section-title">Inactive</h2>
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
      <h2 className="section-title">Customers</h2>
      {message ? <Message>{message}</Message> : (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <h2>Customers</h2>
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
                { key: 'name', label: 'Name', cell: (row) => row.name },
                { key: 'due', label: 'Due date', cell: (row) => row.dueDate },
                { key: 'products', label: 'Products', cell: (row) => row.products },
                { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.status} /> },
                { key: 'last', label: 'Last payment', cell: (row) => row.lastPayment?.date || 'No payment recorded' },
                { key: 'lastAmount', label: 'Last amount', cell: (row) => row.lastPayment ? formatZmw(row.lastPayment.amount) : '—' },
                { key: 'spent', label: 'Total spent', cell: (row) => formatZmw(row.totalSpent) },
                { key: 'whatsapp', label: 'WhatsApp', cell: (row) => {
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

function RankedSplit({ title, rows, center }) {
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
                  <span style={{ display: 'block', height: 8, marginTop: 6, borderRadius: 99, background: 'var(--surface-2)' }}><span style={{ display: 'block', height: '100%', width: `${item.amount / max * 100}%`, borderRadius: 99, background: 'var(--brand)' }} /></span>
                </div>
                <b>{formatZmw(item.amount)} · {Math.round(item.pct)}%</b>
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

function Funds({ model }) {
  const dated = [...model.income, ...model.expenses].map((row) => row.date).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort()
  const [month, setMonth] = useState(() => (dated.at(-1) || todayIso()).slice(0, 7))
  const rows = monthRows([...model.income, ...model.expenses], month)
  const summary = monthSummary(rows)
  const days = dailyAmounts(rows, month)
  const sources = sourceAnalysis(rows)
  const maxSource = Math.max(...sources.flatMap((item) => [item.income, item.expense]), 1)
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const ordersNote = accessMessage(model.access.orders, '', COPY.ordersBlocked)
  const expensesNote = accessMessage(model.access.expenses, model.access.expenses === 'empty' ? COPY.expensesEmpty : '', COPY.expensesBlocked)
  return (
    <>
      <div className="topbar">
        <h2 className="section-title" style={{ margin: 0 }}>Funds</h2>
        <div className="vh-actions">
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</button>
          <strong aria-live="polite">{label}</strong>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>Next</button>
        </div>
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
