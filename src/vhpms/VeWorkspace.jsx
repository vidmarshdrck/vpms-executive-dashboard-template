import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SlideTabs from './SlideTabs.jsx'
import { Donut, PageFooter } from './Donut.jsx'
import { formatZmw, slicesBy } from './books.js'
import { ColumnLabel } from './icons.jsx'
import { accountPeriod, accountsByCurrency, categoryLabel, filterBankTransactions, formatMoney, fxText } from './bankBudget.js'
import { categoryShare } from './fundsMonth.js'
import { StandardBudget, StandardFunds, StandardMarketing, StandardOverview } from './businessPanels.jsx'
import { glanceFromVe } from './businessSources.js'
import { useReportingPeriod } from './TimeframePopover.jsx'
import { COPY, buildWorkspace, emptySources, fetchVeWorkspace, filterCustomers, receivedInPeriod, todayIso, whatsappHref } from './veData.js'

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
        <thead><tr>{columns.map((column) => <th key={column.key} className={column.className}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr
              key={row.id}
              className={onRow ? 'is-clickable' : undefined}
              tabIndex={onRow ? 0 : undefined}
              onClick={onRow ? () => onRow(row) : undefined}
              onKeyDown={onRow ? (event) => { if (event.key === 'Enter') onRow(row) } : undefined}
            >{columns.map((column) => <td key={column.key} className={column.className}>{column.cell(row)}</td>)}</tr>
          )) : <tr><td colSpan={columns.length}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

const PAYMENT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function paymentDate(value) {
  const iso = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} ${PAYMENT_MONTHS[month - 1]} ${year}`
}

function agentLabel(row) {
  if (!row.agent) return '—'
  if (row.agent === row.owner) return <span className="same-owner">Same as owner</span>
  return row.agent
}

function slotButton(row, onOpen) {
  const count = `${row.slotsTaken}/${row.slotsTotal}`
  return <button type="button" className="btn btn-ghost btn-sm slot-count" aria-haspopup="dialog" aria-label={`Slots for ${row.owner}, ${count}`} onClick={() => onOpen(row)}>{count}</button>
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
  const panelRef = useRef(null)
  useEffect(() => {
    if (!account) return undefined
    const opener = document.activeElement
    const panel = panelRef.current
    const closeButton = panel?.querySelector('[data-family-close]')
    closeButton?.focus()
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = [...panel.querySelectorAll('button, [href], input, select, textarea')].filter((node) => !node.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [account, onClose])
  if (!account) return null
  const titleId = `family-members-${account.id || 'account'}`
  const taken = Number.isFinite(account.slotsTaken) ? account.slotsTaken : account.members.length
  const total = Number.isFinite(account.slotsTotal) ? account.slotsTotal : account.members.length
  const dialog = (
    <div className="vh-modal">
      <button type="button" className="vh-modal-backdrop" aria-label="Close family members" onClick={onClose} />
      <section ref={panelRef} className="card vh-modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="card-head">
          <div>
            <h2 id={titleId} className="family-modal-title">{account.plan}</h2>
            <p className="family-modal-sub">Owner · {account.owner} · {taken} of {total} slots</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" data-family-close onClick={onClose}>Close</button>
        </div>
        <div className="card-body">
          {account.members.length ? (
            <>
              <div className="member-table tbl-scroll">
                <table className="data">
                  <thead><tr><th>Name</th><th>Slot</th><th>Last payment</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {account.members.map((member) => (
                      <tr key={`${member.cid}-${member.slot}`}>
                        <td>{member.name}</td>
                        <td>{member.slot}</td>
                        <td>{member.lastPayment ? paymentDate(member.lastPayment.date) : 'No payment recorded'}</td>
                        <td className="num">{member.lastPayment ? formatZmw(member.lastPayment.amount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="member-cards record-cards">
                {account.members.map((member) => (
                  <li key={`${member.cid}-${member.slot}`} className="record-card">
                    <div className="record-line">
                      <strong>{member.name}</strong>
                      <span className="num">{member.lastPayment ? formatZmw(member.lastPayment.amount) : '—'}</span>
                    </div>
                    <p className="record-meta">Slot {member.slot} · {member.lastPayment ? paymentDate(member.lastPayment.date) : 'No payment recorded'}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="empty">No one is connected.</p>}
        </div>
      </section>
    </div>
  )
  if (typeof document === 'undefined') return dialog
  return createPortal(dialog, document.querySelector('.vh-app') || document.body)
}

function accountMeta(row) {
  const parts = [row.activity, row.plan, `Due ${row.dueDate}`, `Account paid: ${row.paidStatus}`]
  if (row.email) parts.push(row.email)
  parts.push(row.agent && row.agent !== row.owner ? row.agent : row.agent ? 'Same as owner' : 'No agent recorded')
  return parts.join(' · ')
}

function AccountTable({ accounts, empty, onOpen }) {
  if (!accounts.length) return <Message>{empty}</Message>
  const columns = [
    { key: 'owner', label: <ColumnLabel icon="users">Account owner</ColumnLabel>, cell: (row) => row.owner },
    { key: 'status', label: <ColumnLabel icon="activity">Status</ColumnLabel>, cell: (row) => <StatusChip value={row.activity} /> },
    { key: 'plan', label: <ColumnLabel icon="package">Plan</ColumnLabel>, cell: (row) => row.plan },
    { key: 'due', label: <ColumnLabel icon="calendar">Due date</ColumnLabel>, cell: (row) => row.dueDate },
    { key: 'email', label: <ColumnLabel icon="mail">Email</ColumnLabel>, cell: (row) => row.email || <span aria-label="Email not recorded" /> },
    { key: 'slots', label: <ColumnLabel icon="layers">Slots</ColumnLabel>, cell: (row) => slotButton(row, onOpen) },
    { key: 'paid', label: <ColumnLabel icon="receipt">Account paid</ColumnLabel>, cell: (row) => <StatusChip value={row.paidStatus} /> },
    { key: 'agent', label: <ColumnLabel icon="user">Agent</ColumnLabel>, cell: (row) => agentLabel(row) },
  ]
  return (
    <>
      <div className="family-table"><DataTable rows={accounts} empty={empty} columns={columns} /></div>
      <ul className="family-cards record-cards">
        {accounts.map((row) => (
          <li key={row.id} className="record-card">
            <div className="record-line"><strong>{row.owner}</strong>{slotButton(row, onOpen)}</div>
            <p className="record-meta">{accountMeta(row)}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function Overview({ model }) {
  return <StandardOverview model={glanceFromVe(model)} />
}

function FamilyAccounts({ model }) {
  const [account, setAccount] = useState(null)
  const [group, setGroup] = useState('active')
  const closeAccount = useCallback(() => setAccount(null), [])
  const period = useReportingPeriod(model.today)
  const ordersReadable = model.access.orders === 'ok' || model.access.orders === 'empty'
  const received = ordersReadable ? receivedInPeriod(model.income, period) : null
  const message = accessMessage(model.access.familyAccounts, COPY.familyEmpty, COPY.familyBlocked)
  const plansMessage = accessMessage(model.access.products, COPY.plansEmpty, COPY.plansEmpty)
  const rows = group === 'active' ? model.activeAccounts : model.inactiveAccounts
  return (
    <div className="family-accounts">
      <h2 className="sr-only">Family accounts</h2>
      <section className="card family-received">
        <div className="card-body">
          <div className="stat-num">{received == null ? '—' : formatZmw(received)}</div>
          <div className="stat-desc">Received · {period.label}</div>
          {!ordersReadable && <p className="stat-desc">{accessMessage(model.access.orders, '', COPY.ordersBlocked)}</p>}
        </div>
      </section>
      <FamilyModal account={account} onClose={closeAccount} />
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
          <>
            <div className="family-table">
              <DataTable
                rows={model.products}
                empty={COPY.plansEmpty}
                columns={[
                  { key: 'name', label: 'Plan', cell: (row) => row.name },
                  { key: 'category', label: 'Category', cell: (row) => row.category },
                  { key: 'slots', label: 'Slots', cell: (row) => (row.shared ? `${row.slots ?? '—'} shared` : 'Not shared') },
                  { key: 'price', className: 'num', label: 'Price', cell: (row) => (row.price == null ? 'Not recorded' : formatZmw(row.price)) },
                  { key: 'status', label: 'Status', cell: (row) => <StatusChip value={row.active ? 'Active' : 'Inactive'} /> },
                ]}
              />
            </div>
            <ul className="family-cards record-cards">
              {model.products.map((row) => (
                <li key={row.id} className="record-card">
                  <div className="record-line">
                    <strong>{row.name}</strong>
                    <span className="num">{row.price == null ? 'Not recorded' : formatZmw(row.price)}</span>
                  </div>
                  <p className="record-meta">{row.category} · {row.shared ? `${row.slots ?? '—'} shared` : 'Not shared'} · {row.active ? 'Active' : 'Inactive'}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
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
  return <StandardFunds model={glanceFromVe(model)} />
}

function Budget({ model }) {
  return <StandardBudget model={glanceFromVe(model)} />
}

function Marketing({ model }) {
  return <StandardMarketing model={glanceFromVe(model)} />
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
