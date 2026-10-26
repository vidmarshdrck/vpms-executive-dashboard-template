import { useState } from 'react'
import { STORAGE_KEY, addRecord, emptyState, parseState, totals } from '../model.js'

function load() {
  if (typeof localStorage === 'undefined') return emptyState()
  return parseState(localStorage.getItem(STORAGE_KEY) || '')
}

function formatZmw(value) {
  return new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', currencyDisplay: 'symbol' })
    .format(Number(value) || 0)
    .replace('ZMW', 'K')
}

export default function LocalNotes() {
  const [state, setState] = useState(load)
  const [error, setError] = useState('')
  function save(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const next = addRecord(state, 'ledger', {
        title: form.get('title'),
        amount: form.get('amount'),
        status: form.get('status') || 'Pending',
        scope: form.get('scope') || 'Personal',
        date: form.get('date') || '',
        business: 'Vidmar Holdings',
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setState(next)
      setError('')
      event.currentTarget.reset()
    } catch (err) { setError(err.message || 'Could not save that note.') }
  }
  const personal = totals(state.ledger, 'Personal')
  const business = totals(state.ledger, 'Business')
  return <details className="vh-panel"><summary>Browser notes</summary>
    <p className="vh-muted">Saved on this browser only. Payment records above stay separate.</p>
    <form className="vh-form" onSubmit={save}>
      <label>Description<input name="title" required maxLength="180" /></label>
      <label>Amount (ZMW)<input name="amount" type="number" required min="0.01" step="0.01" /></label>
      <label>Status<select name="status" defaultValue="Pending" aria-label="Note status"><option>Pending</option><option>Paid</option><option>Overdue</option></select></label>
      <label>Scope<select name="scope" defaultValue="Personal" aria-label="Note scope"><option>Personal</option><option>Business</option></select></label>
      <label>Date<input name="date" type="date" /></label>
      <button type="submit">Save note</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {state.ledger.length > 0 && <p className="vh-muted">Personal paid {formatZmw(personal.paid)} · Business paid {formatZmw(business.paid)}</p>}
    {state.ledger.length > 0 && <ul className="vh-list">{state.ledger.map((row) => <li key={row.id}><div><strong>{row.title}</strong><small>{row.date || 'No date'} · {row.scope} · {row.status}</small></div><strong>{formatZmw(row.amount)}</strong></li>)}</ul>}
  </details>
}
