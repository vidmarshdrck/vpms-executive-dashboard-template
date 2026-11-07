import { useState } from 'react'
import { activeBusinesses, entriesFor, addEntry, removeEntry, moneyTotal, formatZmw, slicesBy, statusSlices, sharedUnit, countTotals } from './books.js'
import { Donut, PageFooter } from './Donut.jsx'

function MoneySection({ title, empty, entries, groupLabel, groupKey, onAdd, onRemove }) {
  const slices = slicesBy(entries, 'group')
  const statuses = statusSlices(entries)
  return (
    <>
      <h2 className="section-title">{title}</h2>
      <div className="two even">
        <section className="card">
          <div className="card-head"><h2>{title}</h2></div>
          <div className="card-body">
            <form className="vh-form" onSubmit={onAdd}>
              <div className="field"><label>Description<input name="title" type="text" required /></label></div>
              <div className="field"><label>{groupLabel}<input name="group" type="text" required /></label></div>
              <div className="field"><label>Amount (ZMW)<input name="amount" type="number" min="0.01" step="0.01" required /></label></div>
              <div className="field"><label>Status<select name="status" aria-label={`${title} status`}><option>Pending</option><option>Paid</option><option>Overdue</option></select></label></div>
              <div className="field"><label>Date<input name="date" type="date" /></label></div>
              <button className="btn btn-primary" type="submit">Save</button>
            </form>
            <div className="tbl-scroll">
              <table className="data">
                <thead><tr><th>Date</th><th>Description</th><th>{groupLabel}</th><th>Status</th><th>Amount (ZMW)</th><th></th></tr></thead>
                <tbody>
                  {entries.length ? entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.date || '—'}</td><td>{entry.title}</td><td>{entry.group}</td>
                      <td><span className={`chip ${entry.status === 'Paid' ? 'green' : entry.status === 'Overdue' ? 'red' : 'amber'}`}>{entry.status}</span></td>
                      <td>{formatZmw(entry.amount)}</td>
                      <td><button className="btn btn-danger btn-sm" type="button" onClick={() => onRemove(entry.id)}>Delete</button></td>
                    </tr>
                  )) : <tr><td colSpan="6">{empty}</td></tr>}
                  {entries.length > 0 && <tr className="total-row"><td colSpan="4">Total</td><td>{formatZmw(moneyTotal(entries))}</td><td></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>{groupLabel} split</h2></div>
          <div className="card-body">
            {slices.length ? <Donut items={slices} center={title} format={formatZmw} /> : <p className="empty">{empty}</p>}
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
            <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Status split</h2>
            {statuses.length ? <Donut items={statuses} center="Status" format={formatZmw} /> : <p className="empty">{empty}</p>}
          </div>
        </section>
      </div>
    </>
  )
}

export function BusinessList({ books, onOpen }) {
  const businesses = activeBusinesses(books)
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings</p><h1>Businesses</h1><p className="sub">Select a business to open its expenses, income, and counts.</p></div></div>
      {businesses.length ? <div className="grid-3">{businesses.map((business) => {
        const expenses = entriesFor(books, business.id, 'expense').length
        const income = entriesFor(books, business.id, 'income').length
        return (
          <button key={business.id} type="button" className="card-link" onClick={() => onOpen(business.id)}>
            <section className="card"><div className="card-head"><h2>{business.name}</h2></div><div className="card-body"><p className="stat-desc">{expenses || income ? `${expenses} expense line${expenses === 1 ? '' : 's'} · ${income} income line${income === 1 ? '' : 's'}` : 'No expenses recorded yet'}</p></div></section>
          </button>
        )
      })}</div> : <section className="card"><div className="card-body"><p className="stat-desc">No active businesses.</p></div></section>}
      <PageFooter />
    </div>
  )
}

export function BusinessHome({ books, businessId, onChange }) {
  const [message, setMessage] = useState('')
  const business = books.businesses.find((item) => item.id === businessId)
  if (!business) return <BusinessList books={books} onOpen={() => {}} />
  const expenses = entriesFor(books, business.id, 'expense')
  const income = entriesFor(books, business.id, 'income')
  const counts = entriesFor(books, business.id, 'count')
  const unit = sharedUnit(counts)
  function save(event, kind) {
    event.preventDefault()
    try {
      onChange(addEntry(books, { ...Object.fromEntries(new FormData(event.currentTarget)), kind, businessId: business.id }))
      event.currentTarget.reset()
      setMessage('Saved.')
    } catch (error) { setMessage(error.message) }
  }
  function remove(id) { onChange(removeEntry(books, id)); setMessage('Saved.') }
  return (
    <div className="wrap biz">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings · {business.code}</p><h1>{business.name}</h1><p className="sub">Expenses, income, and counts for this business.</p></div></div>
      {message && <p className="vh-status" role="status">{message}</p>}
      <MoneySection title="Expenses" empty="No expenses recorded yet" entries={expenses} groupLabel="Category" groupKey="group" onAdd={(event) => save(event, 'expense')} onRemove={remove} />
      <MoneySection title="Income" empty="No income recorded yet" entries={income} groupLabel="Source" groupKey="group" onAdd={(event) => save(event, 'income')} onRemove={remove} />
      <h2 className="section-title">Counts</h2>
      <div className="two even">
        <section className="card">
          <div className="card-head"><h2>Counts</h2></div>
          <div className="card-body">
            <form className="vh-form" onSubmit={(event) => save(event, 'count')}>
              <div className="field"><label>Item<input name="title" type="text" required /></label></div>
              <div className="field"><label>Count<input name="amount" type="number" min="0.01" step="any" required /></label></div>
              <div className="field"><label>Unit<input name="unit" type="text" required /></label></div>
              <button className="btn btn-primary" type="submit">Save</button>
            </form>
            <div className="tbl-scroll">
              <table className="data">
                <thead><tr><th>Item</th><th>Count</th><th>Unit</th><th></th></tr></thead>
                <tbody>
                  {counts.length ? counts.map((entry) => <tr key={entry.id}><td>{entry.title}</td><td>{entry.amount}</td><td>{entry.unit}</td><td><button className="btn btn-danger btn-sm" type="button" onClick={() => remove(entry.id)}>Delete</button></td></tr>) : <tr><td colSpan="4">No counts recorded yet</td></tr>}
                  {counts.length > 0 && countTotals(counts).map(([name, value]) => <tr className="total-row" key={name}><td>Total</td><td>{value}</td><td>{name}</td><td></td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Count split</h2></div>
          <div className="card-body">
            {counts.length && unit ? <Donut items={slicesBy(counts, 'title')} center={unit} format={(value) => `${value} ${unit}`} /> : <p className="empty">{counts.length ? 'Counts use more than one unit, so they stay in the table.' : 'No counts recorded yet'}</p>}
          </div>
        </section>
      </div>
      <PageFooter />
    </div>
  )
}
