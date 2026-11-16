import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { validReconciliation, validSupplement } from './veEvidence.js'
import { VE_RECONCILIATION_DISPLAY } from './veReconciliationDisplay.js'
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

function AccountTable({ accounts, empty, onOpen }) {
  if (!accounts.length) return <Message>{empty}</Message>
  const columns = [
    { key: 'fid', label: 'FID', cell: row => row.id },
    { key: 'activitySource', label: 'Activity evidence', cell: row => row.activitySource },
    { key: 'owner', label: <ColumnLabel icon="users">Account owner</ColumnLabel>, cell: (row) => row.owner },
    { key: 'status', label: <ColumnLabel icon="activity">Status</ColumnLabel>, cell: (row) => <StatusChip value={row.activity} /> },
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
            <p className="record-meta">FID {row.id} · {row.activitySource}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function Overview({ model }) {
  return <StandardOverview model={glanceFromVe(model)} />
}

function OwnerDisplayReconciliation({ model }) {
  const [fid, setFid] = useState('')
  const [month, setMonth] = useState('')
  if (!model.displaySnapshot || model.access.familyAccounts !== 'ok') return null
  const data = VE_RECONCILIATION_DISPLAY
  const cycles = data.accounts.flatMap(account => account.expected_cycle_dates.map(date => ({
    id: `${account.fid}:${date}`, fid: account.fid, product: account.product,
    anchor: account.due_date_unchanged, date,
  })))
  const mismatches = data.accounts.filter(account => {
    const source = model.accounts.find(row => Number(row.id) === account.fid)
    return source?.dueDate !== (account.due_date_unchanged || 'Not dated')
  })
  return <Panel title="Monthly provider reconciliation" note="Owner-confirmed snapshot · 14/11/2026">
    <p><strong>Display only · version {model.displaySnapshot.version}</strong> — 14 owner-confirmed active · 4 owner-confirmed inactive. Not database synchronization. Source payment status, dates and slots are unchanged; activity is separate from Account paid.</p>
    <p>{data.summary.expected_cycles} expected cycles · {data.summary.cycles_with_candidate_evidence} with candidate evidence · {data.summary.unreconciled_cycles} unreconciled.</p>
    <p><strong>Actual paid count: Unknown</strong> · Actual paid total: Unknown · Truly missing payments: Unknown · Historical costs, FNB FX and fees: Unknown.</p>
    <p className="stat-desc">Original eleven continuous from stored anchors: owner assertion, not independently verified service or finance history. Monthly anniversaries through 14/11/2026 inclusive, not monthly debts. Candidate pools may recur across accounts and must not be summed. No verified match is not evidence of no payment.</p>
    <p>Boaz report summary · 14/11/2026 · HOLD: {data.cashSummary.groups_matching_exact_order_tid} exact-TID candidates, NOT verified payments; {data.cashSummary.groups_with_order_amount_match} amount-concordant, {data.cashSummary.exact_tid_groups_with_amount_mismatch} amount mismatches; {data.cashSummary.groups_with_current_product_slot} current product-slot links, {data.cashSummary.groups_with_current_active_product_slot} active. Zero payment verifications and zero historically proven allocations. Incoming customer cash is not provider expense proof.</p>
    <p>Private detail unavailable in this display snapshot. Both MTN and Airtel CSV exports were reviewed and deduplicated by Boaz; coverage remains incomplete. No raw customer or bank evidence is bundled. Historical costs remain unavailable; no estimates posted as expenses.</p>
    <p>FID 6 annual · future anchor 2027-01-15; FID 9 future anchor 2026-12-05; FID 18 missing anchor. No monthly cycles invented for these accounts.</p>
    {mismatches.length > 0 && <p role="status">Source anchor mismatch for FID {mismatches.map(row => row.fid).join(', ')}. Anniversary rows below are the dated report snapshot, not recalculated live payment findings. Current source dates remain in the account table.</p>}
    <details><summary>56 expected anniversary rows · unchanged report anchors</summary>
      <div className="vh-actions" style={{flexWrap:'wrap'}}>
        <label>Account<select aria-label="Snapshot reconciliation account" value={fid} onChange={event => setFid(event.target.value)}><option value="">Original eleven accounts</option>{data.accounts.filter(row => row.expected_cycle_dates.length).map(row => <option key={row.fid} value={row.fid}>FID {row.fid} · {row.product}</option>)}</select></label>
        <label>Expected month<select aria-label="Snapshot reconciliation month" value={month} onChange={event => setMonth(event.target.value)}><option value="">All anniversary months</option>{[...new Set(cycles.map(row => row.date.slice(0,7)))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <DataTable rows={cycles.filter(row => (!fid || String(row.fid) === fid) && (!month || row.date.startsWith(month)))} empty="No expected anniversaries in this selection; not a payment finding." columns={[
        {key:'fid',label:'FID / plan',cell:row => `FID ${row.fid} · ${row.product}`},
        {key:'anchor',label:'Original report anchor',cell:row => row.anchor},
        {key:'date',label:'Expected anniversary',cell:row => row.date},
        {key:'status',label:'Evidence / payment',cell:() => 'Unreconciled · per-cycle private detail unavailable · actual paid unknown'},
      ]}/>
    </details>
  </Panel>
}

export function ProviderReconciliation({ model }) {
  const [fid, setFid] = useState('')
  const [month, setMonth] = useState('')
  const data = model.reconciliation
  const title = model.displaySnapshot ? 'Stored operational evidence' : 'Monthly provider reconciliation'
  if (!data && model.displaySnapshot) return null
  if (!data) return <Panel title={title}><Message>{model.reconciliationAccess === 'blocked' ? 'Reconciliation is not visible to this account.' : 'Owner-confirmed activity and Boaz reconciliation are unavailable. Existing account labels are preserved, not owner-confirmed.'}</Message></Panel>
  if (!validReconciliation(data)) return <Panel title={title}><Message>Reconciliation unavailable — malformed or incomplete evidence. Supplement absent or stale. Continuity confirmation absent or stale. Counts and detail are not validated; not evidence of no payment.</Message></Panel>
  const accounts = data.accounts || []
  const cycles = (data.cycles || []).filter(row => (!fid || String(row.fid) === fid) && (!month || row.expected_date.slice(0, 7) === month))
  const summary = data.summary || {}
  const supplement = data.finance_supplement
  const evidence = supplement?.summary || {}
  const active = [1,2,3,4,5,6,8,9,10,11,13,14,16,18]
  const original = [1,2,3,4,5,8,10,11,13,14,16]
  const currentPayload = data.version === 1 && data.as_of === '2026-11-14'
    && Object.keys(data.confirmed_activity || {}).length === 18
    && Array.from({length:18},(_,i)=>i+1).every(id => data.confirmed_activity[id] === (active.includes(id) ? 'Active' : 'Inactive'))
    && data.cycles?.length === 56 && summary.expected_cycles === 56
    && new Set(data.cycles.map(row => `${row.fid}:${row.expected_date}`)).size === 56
    && data.cycles.every(row => original.includes(Number(row.fid)))
  const ownerContinuity = currentPayload
    && data.historical_continuity === 'Original eleven continuous since anchors owner-confirmed; not new 6/9/18'
    && original.every(id => accounts.find(row => Number(row.fid) === id)?.continuous_from_anchor_owner_confirmed === true)
    && [6,9,18].every(id => accounts.find(row => Number(row.fid) === id)?.continuous_from_anchor_owner_confirmed === false)
  const currentSupplement = currentPayload && validSupplement(supplement)
    && supplement?.source === 'actual Boaz boaz-supplement-report.json'
    && supplement.sha256 === 'b704c3f39eb3f6bb605275a5b571b90e544144960087a5669a4032e7ec395660'
    && evidence.incoming_tid_groups_including_invalid === 397
    && evidence.groups_matching_exact_order_tid === 201 && evidence.groups_with_order_amount_match === 181
    && evidence.exact_tid_groups_with_amount_mismatch === 20 && evidence.groups_with_current_product_slot === 67
    && evidence.groups_with_current_active_product_slot === 64
    && evidence.payment_verifications_performed === 0 && evidence.historically_proven_family_allocations === 0
    && supplement.customer_cash_links?.length === 397
    && supplement.customer_cash_links.every(row => row.verified === false && row.historical_connection_proven === false)
  const continuity = ownerContinuity && currentSupplement
  return <Panel title={title} note={`Owner activity as of ${data.as_of}. ${currentSupplement ? 'Finance evidence reviewed by actual Boaz; not payment verification by Nathan.' : 'Supplement absent or stale — current Boaz evidence not validated.'}`}>
    <p>{Object.values(data.confirmed_activity || {}).filter(value => value === 'Active').length} owner-confirmed active · {Object.values(data.confirmed_activity || {}).filter(value => value === 'Inactive').length} owner-confirmed inactive · {Object.keys(data.preserved_activity || {}).length} preserved without confirmation.</p>
    <p>{summary.expected_cycles ?? 'Unknown'} expected cycles · {summary.cycles_with_candidate_evidence ?? 'Unknown'} with candidate evidence · {summary.unreconciled_cycles ?? 'Unknown'} unreconciled.</p>
    <p><strong>Actual paid count: Unknown</strong> · Actual paid total: Unknown · Truly missing payments: Unknown.</p>
    <p className="stat-desc">Provisional due-date anniversaries through {data.as_of}, inclusive. Anchors remain unchanged. {continuity ? 'Original eleven continuously active from stored anchors: owner-confirmed. This is the owner assertion, not independently verified historical service or finance proof; display requires valid current supplemental evidence. New fids 6/9/18 have no confirmed historical continuity.' : 'Continuity confirmation absent or stale — historical service continuity is not established by this event.'} Activity does not prove monthly payment or debt. Candidates are unallocated retrieval aids, may recur across accounts, and must not be summed. No settled match verified is not evidence of no payment.</p>
    {currentSupplement ? <p>Review status: HOLD — Boaz supplement consumed; no new payment verifications. {evidence.groups_matching_exact_order_tid} exact-TID candidates, NOT verified payments; {evidence.groups_with_order_amount_match} amount-concordant, {evidence.exact_tid_groups_with_amount_mismatch} amount mismatches. {evidence.groups_with_current_product_slot} current links, {evidence.groups_with_current_active_product_slot} active; not historical allocations. Zero historically proven allocations. Incoming cash is not provider expense proof.</p> : <p>Review status: HOLD — Supplement absent or stale. Current candidate figures and CSV coverage are not validated.</p>}
    {currentSupplement && <p>Both MTN and Airtel CSV exports found and deduped; no duplicate PDF requirement blocks this nonfinancial UI. Coverage incomplete. Historical estimates unavailable; actual paid and missing totals unknown.</p>}
    {continuity && <p>fid6 annual, future anchor 2027-01-15; fid9 future anchor 2026-12-05; fid18 null anchor. No invented cycles.</p>}
    <div className="vh-actions" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
      <label style={{ maxWidth: '100%' }}>Account<select style={{ maxWidth: '100%' }} aria-label="Reconciliation account" value={fid} onChange={event => setFid(event.target.value)}><option value="">All account anchors</option>{accounts.map(row => <option key={row.fid} value={String(row.fid)}>FID {row.fid} · {row.product} · anchor {row.due_date_unchanged || 'Unknown'}</option>)}</select></label>
      <label>Expected month<select aria-label="Reconciliation month" value={month} onChange={event => setMonth(event.target.value)}><option value="">All anniversary months</option>{[...new Set((data.cycles || []).map(row => row.expected_date.slice(0, 7)))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <DataTable rows={cycles.map(row => ({ ...row, id: row.cycle_key }))} empty="No expected cycles in this selection; not a payment finding." columns={[
      { key: 'fid', label: 'FID / plan', cell: row => <>{row.fid} · {accounts.find(account => account.fid === row.fid)?.product || 'Unknown'}</> },
      { key: 'anchor', label: 'Unchanged anchor', cell: row => accounts.find(account => account.fid === row.fid)?.due_date_unchanged || 'Unknown' },
      { key: 'expected', label: 'Expected anniversary', cell: row => row.expected_date },
      { key: 'candidate', label: 'Candidate evidence', cell: row => [...(row.ledger_candidate_expense_ids || []).map(id => `Ledger #${id}`), ...(row.unallocated_bank_candidate_handles || [])].join(', ') || 'None found in reviewed sources' },
      { key: 'classification', label: 'Classification', cell: row => (row.ledger_candidate_expense_ids?.length || row.unallocated_bank_candidate_handles?.length) ? 'Candidate only · Unreconciled' : 'Unreconciled' },
      { key: 'verified', label: 'Boaz-verified settled match', cell: () => 'No settled match verified' },
      { key: 'estimated', label: 'Historical estimate', cell: () => 'Historical estimate unavailable' },
      { key: 'fx', label: 'Billing currency / FNB rate / fees', cell: () => 'USD confirmed / historical FNB FX and fees unknown' },
    ]} />
    <details><summary>Customer cash / order / current-slot candidates</summary>
      <p>{currentSupplement ? 'Actual Boaz supplemental evidence. All HOLD, not verified payments.' : 'Unvalidated supplemental detail — source attribution and current totals are not established.'} Current membership is not historical allocation. Incoming cash does not prove provider settlement. No candidate totals summed.</p>
      <DataTable rows={(currentSupplement ? supplement.customer_cash_links : []).map(row => ({...row, id:row.key}))} empty="Supplemental detail unavailable — malformed, stale or unattested evidence; not evidence of no customer cash." columns={[
        {key:'tid',label:'Literal evidence key / provider',cell:row => row.key + ' · ' + row.provider},
        {key:'order',label:'Candidate order / customer / product',cell:row => (row.orders || []).map(order => [order.oid,order.cid || 'Unresolved cid',order.product].join(' / ')).join('; ') || 'No exact order TID'},
        {key:'slots',label:'Current same-product family / slot',cell:row => (row.current_slots || []).map(slot => [slot.cid,'FID '+slot.fid,'slot '+slot.slot].join(' / ')).join('; ') || 'No current same-product slot'},
        {key:'amount',label:'Amount concordance',cell:row => row.amount_match ? 'Candidate amount concordant' : 'Not concordant or no order'},
        {key:'verified',label:'Boaz verification / history',cell:() => 'HOLD · not verified · Historical allocation: unproven'},
      ]}/>
    </details>
    <p className="stat-desc">Historical costs remain unavailable: {currentPayload && data.source_currency === 'USD owner-confirmed' ? 'USD confirmed' : 'Currency confirmation unavailable'}; per-account invoices, service periods, transaction-specific historical FNB conversion and fees are not established. Current public list prices and published fee tariffs are not historical account costs. No estimates posted as expenses. {currentSupplement ? 'Source: owner instruction 2026-11-14; actual Boaz original finance report plus boaz-supplement-report.json and validation 2026-11-14.' : 'Current Boaz supplement source not validated.'}</p>
  </Panel>
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
      <OwnerDisplayReconciliation model={model} />
      <ProviderReconciliation model={model} />
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
