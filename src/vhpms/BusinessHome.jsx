import { activeBusinesses, entriesFor } from './books.js'
import { PageFooter } from './Donut.jsx'
import VeWorkspace from './VeWorkspace.jsx'
import BusinessWorkspace from './BusinessWorkspace.jsx'

export function BusinessList({ books, onOpen }) {
  const businesses = activeBusinesses(books)
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings</p><h1>Businesses</h1></div></div>
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

export function BusinessHome({ books, businessId, onChange, token = '' }) {
  void onChange
  const business = books.businesses.find((item) => item.id === businessId)
  if (!business) return <BusinessList books={books} onOpen={() => {}} />
  if (business.id === 've') return <VeWorkspace business={business} token={token} />
  return <BusinessWorkspace business={business} token={token} />
}
