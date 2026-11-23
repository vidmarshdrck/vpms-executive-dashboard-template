import { useState } from 'react'
import { PageFooter } from './Donut.jsx'
import { publicDepartmentName } from './score.js'
import { saveOwnerScorecard } from './ownerScorecards.js'

const blankMetric = () => ({ id: crypto.randomUUID(), name: '', target: '' })

function subjectLabel(card, departments, users, businesses) {
  if (card.subjectType === 'department') {
    const department = departments.find((item) => item.code === card.subjectId)
    return department ? publicDepartmentName(department) : card.subjectId
  }
  if (card.subjectType === 'business') {
    const business = businesses.find((item) => item.code === card.subjectId || item.id === card.subjectId)
    return business?.name || card.subjectId
  }
  const user = users.find((item) => item.username === card.subjectId)
  return user?.name || card.subjectId
}

function subjectKind(card) {
  if (card.subjectType === 'user') return 'User'
  if (card.subjectType === 'business') return 'Business'
  return 'Department'
}

export default function ScorecardsPage({ departments, users, businesses = [], cards, onChange }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const list = cards?.cards || []

  function openNew() {
    setError('')
    setEditingId('new')
    setDraft({
      name: '',
      subjectType: 'department',
      subjectId: departments[0]?.code || '',
      metrics: [blankMetric()],
    })
  }

  function openEdit(card) {
    setError('')
    setEditingId(card.id)
    setDraft({
      name: card.name,
      subjectType: card.subjectType,
      subjectId: card.subjectId,
      metrics: card.metrics.map((metric) => ({ ...metric })),
    })
  }

  function close() {
    setEditingId(null)
    setDraft(null)
    setError('')
  }

  function save(event) {
    event.preventDefault()
    try {
      onChange(saveOwnerScorecard(cards, draft, editingId === 'new' ? undefined : editingId))
      close()
    } catch (err) {
      setError(err.message)
    }
  }

  function setSubjectType(subjectType) {
    const subjectId = subjectType === 'user' ? (users[0]?.username || '') : subjectType === 'business' ? (businesses[0]?.code || '') : (departments[0]?.code || '')
    setDraft({ ...draft, subjectType, subjectId })
  }

  function setMetric(id, field, value) {
    setDraft({ ...draft, metrics: draft.metrics.map((metric) => (metric.id === id ? { ...metric, [field]: value } : metric)) })
  }

  return (
    <div className="wrap">
      {draft ? (
        <section className="card" style={{ maxWidth: 720 }}>
          <div className="card-head"><h2>{editingId === 'new' ? 'Create scorecard' : 'Edit scorecard'}</h2></div>
          <div className="card-body">
            {error && <p className="form-msg error" role="alert">{error}</p>}
            <form onSubmit={save}>
              <div className="field"><label htmlFor="scorecard-name">Name</label><input id="scorecard-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></div>
              <div className="field">
                <span className="role-legend">Applies to</span>
                <div className="row-actions">
                  <label className="vh-check"><input type="radio" name="scorecard-subject" checked={draft.subjectType === 'department'} onChange={() => setSubjectType('department')} /> Department</label>
                  <label className="vh-check"><input type="radio" name="scorecard-subject" checked={draft.subjectType === 'user'} onChange={() => setSubjectType('user')} /> User</label>
                  <label className="vh-check"><input type="radio" name="scorecard-subject" checked={draft.subjectType === 'business'} onChange={() => setSubjectType('business')} /> Business</label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="scorecard-subject">{draft.subjectType === 'user' ? 'User' : draft.subjectType === 'business' ? 'Business' : 'Department'}</label>
                <select id="scorecard-subject" value={draft.subjectId} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })} required>
                  {draft.subjectType === 'department'
                    ? departments.map((department) => <option key={department.code} value={department.code}>{publicDepartmentName(department)}</option>)
                    : draft.subjectType === 'business'
                      ? businesses.map((business) => <option key={business.id} value={business.code}>{business.name}</option>)
                      : users.map((user) => <option key={user.username} value={user.username}>{user.name}</option>)}
                </select>
              </div>
              <div className="field">
                <span className="role-legend">Metrics</span>
                {draft.metrics.map((metric, index) => (
                  <div className="field-row" key={metric.id} style={{ marginBottom: 8 }}>
                    <div className="field"><label htmlFor={`metric-name-${metric.id}`}>Metric {index + 1}</label><input id={`metric-name-${metric.id}`} value={metric.name} onChange={(event) => setMetric(metric.id, 'name', event.target.value)} required /></div>
                    <div className="field"><label htmlFor={`metric-target-${metric.id}`}>Target</label><input id={`metric-target-${metric.id}`} value={metric.target} onChange={(event) => setMetric(metric.id, 'target', event.target.value)} required /></div>
                  </div>
                ))}
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDraft({ ...draft, metrics: [...draft.metrics, blankMetric()] })}>Add metric</button>
                  {draft.metrics.length > 1 && <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDraft({ ...draft, metrics: draft.metrics.slice(0, -1) })}>Remove last metric</button>}
                </div>
              </div>
              <div className="row-actions">
                <button className="btn btn-primary" type="submit">Save scorecard</button>
                <button className="btn btn-ghost" type="button" onClick={close}>Cancel</button>
              </div>
            </form>
          </div>
        </section>
      ) : list.length === 0 ? (
        <section className="card empty-card">
          <div className="card-body">
            <p className="empty-state"><strong>No scorecards yet</strong></p>
            <button className="btn btn-primary" type="button" onClick={openNew} style={{ marginTop: 12 }}>Create scorecard</button>
          </div>
        </section>
      ) : (
        <>
          <div className="vh-actions" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" type="button" onClick={openNew}>Create scorecard</button>
          </div>
          <div className="grid-3">
            {list.map((card) => (
              <section className="card" key={card.id}>
                <div className="card-head"><h2>{card.name}</h2></div>
                <div className="card-body">
                  <p className="stat-desc">{subjectKind(card)} · {subjectLabel(card, departments, users, businesses)}</p>
                  <ul className="vh-list">
                    {card.metrics.map((metric) => <li key={metric.id}><div><strong>{metric.name}</strong><small>Target {metric.target}</small></div></li>)}
                  </ul>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => openEdit(card)}>Edit</button>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      <PageFooter />
    </div>
  )
}
