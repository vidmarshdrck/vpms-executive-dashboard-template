import { useState } from 'react'
import { activeBusinesses, formatZmw } from './books.js'
import { filterTransactions, amountSlices, isUnlabelled, labelTransaction, inboxFromSms } from './sms.js'
import { pushSmsLabel } from './smsClient.js'
import { Donut, PageFooter } from './Donut.jsx'

export function InboxView({ rows, books, onLabel, onOpenSms }) {
  const [note, setNote] = useState('')
  const businesses = activeBusinesses(books)
  const items = inboxFromSms(rows)
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings</p><h1>Inbox</h1><p className="sub">Items that need attention now.</p></div></div>
      {note && <p className="vh-status" role="status">{note}</p>}
      {items.length ? items.map((item) => {
        const row = rows.find((entry) => entry.id === item.smsId)
        return (
          <section className="card needs-label" key={item.id} style={{ marginBottom: 12 }}><div className="card-body">
            <div className="card-head" style={{ padding: 0 }}><h2>{item.title}</h2><span className="chip amber">Needs attention</span></div>
            <p className="stat-desc">{item.detail}</p>
            <p className="vh-muted">Source {item.source} · {item.age}</p>
            <form className="vh-form" onSubmit={async (event) => { event.preventDefault(); try { await onLabel(row.id, Object.fromEntries(new FormData(event.currentTarget))); setNote('Saved.') } catch (error) { setNote(error.message) } }}>
              <div className="field"><label>Business<select name="businessId" required><option value="">Select</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label></div>
              <div className="field"><label>What it is for<input name="purpose" type="text" required /></label></div>
              <button className="btn btn-primary" type="submit">Label</button>
              <button className="btn btn-ghost" type="button" onClick={() => onOpenSms(row.id)}>Open in SMS</button>
            </form>
          </div></section>
        )
      }) : <section className="card"><div className="card-body"><p className="empty">Nothing needs attention.</p></div></section>}
      <PageFooter />
    </div>
  )
}

export function SmsDashboard({ user, books, rows, loadError, labels, onLabelled, focusId }) {
  const [message, setMessage] = useState('')
  const [filters, setFilters] = useState({ business: '', labelStatus: 'all', from: '', to: '' })
  const [opened, setOpened] = useState(null)
  const openId = opened === null ? (focusId || '') : opened
  const visible = filterTransactions(rows, filters)
  const businesses = activeBusinesses(books)
  const named = rows.map((row) => ({ ...row, businessName: businesses.find((business) => business.id === row.businessId)?.name || '' }))
  const byBusiness = amountSlices(named.map((row) => ({ ...row, businessId: row.businessName })), 'businessId')
  const byPurpose = amountSlices(rows, 'purpose')
  async function label(event, row) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const next = labelTransaction(labels, row.id, fields.businessId, fields.purpose)
      const saved = await pushSmsLabel({ env: import.meta.env, token: user.token || '', id: row.id, businessId: fields.businessId, purpose: fields.purpose })
      if (!saved.ok) { setMessage('The SMS service did not confirm the label.'); return }
      onLabelled(next)
      setMessage('Saved.')
    } catch (error) { setMessage(error.message) }
  }
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings · SMSGate</p><h1>SMS Transactions</h1><p className="sub">Incoming mobile-money messages. Unlabelled rows stay in the Inbox.</p></div></div>
      {message && <p className="vh-status" role="status">{message}</p>}
      <div className="vh-form">
        <div className="field"><label>Business<select aria-label="Filter by business" value={filters.business} onChange={(event) => setFilters({ ...filters, business: event.target.value })}><option value="">All businesses</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label></div>
        <div className="field"><label>Labels<select aria-label="Filter by label status" value={filters.labelStatus} onChange={(event) => setFilters({ ...filters, labelStatus: event.target.value })}><option value="all">All</option><option value="unlabelled">Unlabelled</option><option value="labelled">Labelled</option></select></label></div>
        <div className="field"><label>From<input aria-label="From date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label></div>
        <div className="field"><label>To<input aria-label="To date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label></div>
      </div>
      <section className="card"><div className="card-body pad-0"><div className="tbl-scroll"><table className="data">
        <thead><tr><th>Received</th><th>Sender</th><th>Transaction ID</th><th>Amount (ZMW)</th><th>Direction</th><th>Counterparty</th><th>Message</th><th>Business</th><th>Purpose</th></tr></thead>
        <tbody>
          {loadError && !visible.length ? <tr><td colSpan="9">SMS transactions could not be loaded.</td></tr> : visible.length ? visible.map((row) => (
            <tr key={row.id} id={`sms-${row.id}`} className={isUnlabelled(row) ? 'needs-label' : ''}>
              <td>{row.receivedAt ? new Date(row.receivedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
              <td>{row.sender}</td>
              <td>{row.transactionId || '—'}</td>
              <td>{formatZmw(row.amount)}</td>
              <td>{row.direction === 'in' ? 'In' : 'Out'}</td>
              <td>{row.counterparty || '—'}</td>
              <td>{openId === row.id ? <span>{row.rawMessage}</span> : <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpened(row.id)}>Show message</button>}</td>
              <td colSpan="2">
                {isUnlabelled(row) ? (
                  <form className="row-actions" onSubmit={(event) => label(event, row)}>
                    <select name="businessId" aria-label={`Business for ${row.transactionId || row.id}`} required defaultValue=""><option value="">Business</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.code}</option>)}</select>
                    <input name="purpose" aria-label={`Purpose for ${row.transactionId || row.id}`} type="text" required style={{ width: 140 }} />
                    <button className="btn btn-primary btn-sm" type="submit">Label</button>
                  </form>
                ) : <span>{businesses.find((business) => business.id === row.businessId)?.name || row.businessId} · {row.purpose}</span>}
              </td>
            </tr>
          )) : <tr><td colSpan="9">No SMS transactions received yet</td></tr>}
        </tbody>
      </table></div></div></section>
      {(byBusiness.length > 0 || byPurpose.length > 0) && <div className="two even" style={{ marginTop: 18 }}>
        <section className="card"><div className="card-head"><h2>Amount by business</h2></div><div className="card-body">{byBusiness.length ? <Donut items={byBusiness} center="Business" format={formatZmw} /> : <p className="empty">No labelled business amounts yet.</p>}</div></section>
        <section className="card"><div className="card-head"><h2>Amount by purpose</h2></div><div className="card-body">{byPurpose.length ? <Donut items={byPurpose} center="Purpose" format={formatZmw} /> : <p className="empty">No labelled purposes yet.</p>}</div></section>
      </div>}
      <PageFooter />
    </div>
  )
}
