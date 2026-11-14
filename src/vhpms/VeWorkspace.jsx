import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SlideTabs from './SlideTabs.jsx'
import { Donut, PageFooter } from './Donut.jsx'
import { formatZmw, slicesBy } from './books.js'
import { ColumnLabel } from './icons.jsx'
import { accountPeriod, accountsByCurrency, categoryLabel, filterBankTransactions, formatMoney, fxText } from './bankBudget.js'
import { categoryShare, monthLabel } from './fundsMonth.js'
import { EmptyState, StandardBudget, StandardFunds, StandardMarketing, StandardOverview } from './businessPanels.jsx'
import { formatAmount, formatDisplayDate } from './workspaceCharts.js'
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

function StatusPill({ value }) {
  const key = String(value || '').toLowerCase()
  const tone = key === 'not confirmed' || key === 'unreconciled' ? 'amber' : key === 'confirmed' || key === 'settled' ? 'green' : 'na'
  return <span className={`chip status-pill ${tone}`}>{value}</span>
}

function knownCount(value) {
  if (value == null || value === '') return 'Unknown'
  const amount = Number(value)
  return Number.isFinite(amount) ? String(amount) : 'Unknown'
}

function AmountOr({ value, unknown }) {
  if (value == null || value === '') return unknown
  const amount = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(amount)) return unknown
  return <span className={amount < 0 ? 'num money-neg' : 'num'}>{formatAmount(amount)}</span>
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

function displayDate(value) {
  return paymentDate(value) || value
}

function sentenceCase(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function agentPlain(row) {
  if (!row.agent) return '—'
  if (row.agent === row.owner) return 'Same as owner'
  return row.agent
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

function accountCardLine(row) {
  return [row.plan, displayDate(row.dueDate), agentPlain(row)].join(' · ')
}

function AccountTable({ accounts, empty, onOpen, showConfirmation = false }) {
  if (!accounts.length) return <Message>{empty}</Message>
  const columns = [
    { key: 'owner', label: <ColumnLabel icon="users">Account owner</ColumnLabel>, cell: (row) => row.owner },
    { key: 'status', label: <ColumnLabel icon="activity">Status</ColumnLabel>, cell: (row) => <StatusChip value={row.activity} /> },
    ...(showConfirmation ? [{ key: 'confirmation', label: <ColumnLabel icon="clipboard">Confirmation</ColumnLabel>, cell: (row) => row.activitySource ? <StatusPill value={row.activitySource} /> : '—' }] : []),
    { key: 'plan', label: <ColumnLabel icon="package">Plan</ColumnLabel>, cell: (row) => row.plan },
    { key: 'due', label: <ColumnLabel icon="calendar">Due date</ColumnLabel>, cell: (row) => displayDate(row.dueDate) },
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
          <li key={row.id} className="record-card account-card">
            <div className="record-line">
              <div className="record-title">
                <strong>{row.owner}</strong>
                <StatusChip value={row.activity} />
                <StatusChip value={row.paidStatus} />
              </div>
              {slotButton(row, onOpen)}
            </div>
            <p className="record-meta">{accountCardLine(row)}</p>
            {showConfirmation && row.activitySource ? <p className="record-meta"><StatusPill value={row.activitySource} /></p> : null}
          </li>
        ))}
      </ul>
    </>
  )
}

function Overview({ model }) {
  return <StandardOverview model={glanceFromVe(model)} />
}

function reconciliationAccountLabel(row, family, withAnniversary = false) {
  const plan = String(row.product || family?.plan || 'Account').trim() || 'Account'
  const owner = family?.owner && family.owner !== 'Not recorded' ? family.owner : ''
  const anniversary = withAnniversary && row.due_date_unchanged ? `anniversary ${formatDisplayDate(row.due_date_unchanged)}` : ''
  return [plan, owner, anniversary].filter(Boolean).join(' · ')
}

function candidateParts(row) {
  return [
    ...(row.ledger_candidate_expense_ids || []).map((id) => `Expense ${id}`),
    ...(row.unallocated_bank_candidate_handles || []).map((handle) => String(handle || '').trim()).filter(Boolean),
  ]
}

function cycleSettled(row) {
  return row.verified_bank_match != null || (row.verified_amount_zmw != null && row.verified_amount_zmw !== '' && Number.isFinite(Number(row.verified_amount_zmw)))
}

function ReconciliationStatus({ row }) {
  if (cycleSettled(row)) return <StatusPill value="Settled" />
  return (
    <span className="recon-status">
      {candidateParts(row).length ? <StatusPill value="Candidate only" /> : null}
      <StatusPill value="Unreconciled" />
    </span>
  )
}

export function ProviderReconciliation({ model }) {
  const [accountId, setAccountId] = useState('')
  const [month, setMonth] = useState('')
  const data = model.reconciliation
  if (!data) {
    const detail = accessMessage(model.reconciliationAccess, COPY.reconciliationEmpty, COPY.reconciliationBlocked) || COPY.reconciliationEmpty
    return <Panel title="Monthly provider reconciliation"><EmptyState icon="receipt" title={detail} /></Panel>
  }
  const families = new Map((model.accounts || []).map((account) => [account.id, account]))
  const accountRows = data.accounts?.length
    ? data.accounts
    : [...new Map((data.cycles || []).map((row) => [String(row.fid), { fid: row.fid }])).values()]
  const months = [...new Set((data.cycles || []).map((row) => String(row.expected_date || '').slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)))].sort()
  const cycles = (data.cycles || []).filter((row) => {
    if (accountId && String(row.fid) !== accountId) return false
    if (month && String(row.expected_date || '').slice(0, 7) !== month) return false
    return true
  }).sort((a, b) => String(a.expected_date).localeCompare(String(b.expected_date)) || String(a.fid).localeCompare(String(b.fid), undefined, { numeric: true }))
  const summary = data.summary || {}
  const confirmedActive = data.confirmed_activity ? Object.values(data.confirmed_activity).filter((value) => value === 'Active').length : null
  const confirmedInactive = data.confirmed_activity ? Object.values(data.confirmed_activity).filter((value) => value === 'Inactive').length : null
  const notConfirmed = data.preserved_activity ? Object.keys(data.preserved_activity).length : null
  const estimatesRecorded = (data.cycles || []).some((row) => row.estimated_amount_zmw != null && row.estimated_amount_zmw !== '' && Number.isFinite(Number(row.estimated_amount_zmw)))
  const asOf = formatDisplayDate(data.as_of)
  const labelFor = (fid) => {
    const listed = accountRows.find((account) => String(account.fid) === String(fid)) || { fid, product: families.get(String(fid))?.plan || '' }
    return reconciliationAccountLabel(listed, families.get(String(fid)))
  }
  const columns = [
    { key: 'account', label: 'Account', cell: (row) => labelFor(row.fid) },
    { key: 'expected', label: 'Expected anniversary', cell: (row) => <time dateTime={row.expected_date}>{formatDisplayDate(row.expected_date)}</time> },
    { key: 'status', label: 'Status', cell: (row) => <ReconciliationStatus row={row} /> },
    { key: 'candidate', label: 'Candidate', cell: (row) => candidateParts(row).join(', ') || 'No candidate' },
    { key: 'settled', label: 'Settled match', cell: (row) => <AmountOr value={row.verified_amount_zmw} unknown="No settled match verified" /> },
    { key: 'estimate', label: 'Estimate', cell: (row) => <AmountOr value={row.estimated_amount_zmw} unknown="Historical estimate unavailable" /> },
  ]
  return (
    <Panel title="Monthly provider reconciliation" note={asOf && asOf !== String(data.as_of || '') ? `Activity as of ${asOf}.` : undefined}>
      <div className="month-strip" aria-label="Reconciliation summary">
        <article><span>Expected cycles</span><strong>{knownCount(summary.expected_cycles)}</strong></article>
        <article><span>With a candidate</span><strong>{knownCount(summary.cycles_with_candidate_evidence)}</strong></article>
        <article><span>Unreconciled</span><strong>{knownCount(summary.unreconciled_cycles)}</strong></article>
      </div>
      <p>{knownCount(confirmedActive)} confirmed active · {knownCount(confirmedInactive)} confirmed inactive · {knownCount(notConfirmed)} not confirmed.</p>
      <p><strong>Actual paid count: {knownCount(summary.payment_count_actually_made)}</strong> · Actual paid total: <AmountOr value={summary.actual_paid_total} unknown="Unknown" />.</p>
      <p className="stat-desc">A candidate is a possible match. It stays unreconciled until a settled payment is recorded.</p>
      <div className="field-row recon-filters">
        <div className="field">
          <label htmlFor="recon-account">Account</label>
          <select id="recon-account" aria-label="Reconciliation account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">All accounts</option>
            {accountRows.map((row) => <option key={row.fid} value={String(row.fid)}>{reconciliationAccountLabel(row, families.get(String(row.fid)), true)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="recon-month">Month</label>
          <select id="recon-month" aria-label="Reconciliation month" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="">All months</option>
            {months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
          </select>
        </div>
      </div>
      {(accountId || month) && cycles.length > 0 ? <p className="stat-desc">Showing {cycles.length} {cycles.length === 1 ? 'cycle' : 'cycles'} for this filter.</p> : null}
      {cycles.length ? (
        <>
          <div className="family-table recon-table"><DataTable rows={cycles.map((row) => ({ ...row, id: row.cycle_key }))} empty="" columns={columns} /></div>
          <ul className="family-cards record-cards">
            {cycles.map((row) => (
              <li key={row.cycle_key} className="record-card recon-card">
                <div className="record-line">
                  <strong>{labelFor(row.fid)}</strong>
                  <ReconciliationStatus row={row} />
                </div>
                <p className="record-meta">Expected anniversary <time dateTime={row.expected_date}>{formatDisplayDate(row.expected_date)}</time></p>
                <p className="record-meta">{candidateParts(row).join(', ') || 'No candidate'}</p>
                <p className="record-meta"><AmountOr value={row.verified_amount_zmw} unknown="No settled match verified" /></p>
                <p className="record-meta"><AmountOr value={row.estimated_amount_zmw} unknown="Historical estimate unavailable" /></p>
              </li>
            ))}
          </ul>
        </>
      ) : <Message>{accountId || month ? 'No cycles for this account and month.' : 'No cycles were returned.'}</Message>}
      {!estimatesRecorded && <p className="stat-desc">Historical provider costs are not recorded yet.</p>}
    </Panel>
  )
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
            <AccountTable accounts={rows} empty={group === 'active' ? COPY.activeEmpty : COPY.inactiveEmpty} onOpen={setAccount} showConfirmation={Boolean(model.reconciliation)} />
          </Panel>
        </>
      )}
      <ProviderReconciliation model={model} />
      <Panel title="Plans">
        {plansMessage || !model.products.length ? <Message>{plansMessage || COPY.plansEmpty}</Message> : (
          <>
            <div className="family-table">
              <DataTable
                rows={model.products}
                empty={COPY.plansEmpty}
                columns={[
                  { key: 'name', label: 'Plan', cell: (row) => row.name },
                  { key: 'category', label: 'Category', cell: (row) => sentenceCase(row.category) },
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
                  <p className="record-meta">{sentenceCase(row.category)} · {row.shared ? `${row.slots ?? '—'} shared` : 'Not shared'} · {row.active ? 'Active' : 'Inactive'}</p>
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
