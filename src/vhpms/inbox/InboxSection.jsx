import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInbox, loadInbox, decide, comment, markRead, INBOX_FIXTURE } from './store.js'
import { KIND_LABEL, agentsOf, filterItems, decisionError, linkFor, unreadCount } from './logic.js'
const when = s => s ? new Date(s).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'
const STATUS_CLASS = { pending: 'pending', approved: 'ok', rejected: 'bad' }
function Item({ item, events }) {
  const [note, setNote] = useState(''), [err, setErr] = useState(null), [busy, setBusy] = useState(false), [open, setOpen] = useState(false)
  const link = linkFor(item)
  const run = async fn => { setBusy(true); setErr(null); try { await fn(); setNote('') } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const act = d => { const e = decisionError(item, d, note); if (e) return setErr(e); run(() => decide(item, d, note)) }
  return <li className={`vh-inbox-item${!item.read_at && item.status === 'pending' ? ' unread' : ''}`}>
    <button className="vh-inbox-head" aria-expanded={open} onClick={() => { setOpen(!open); markRead(item) }}>
      <span className="vh-badge">{KIND_LABEL[item.kind]}{item.action ? ` · ${item.action}` : ''}</span>
      <strong>{item.title}</strong>
      <span className={`vh-badge ${STATUS_CLASS[item.status] || ''}`}>{item.status}</span>
    </button>
    <div className="vh-inbox-meta"><span>From <b>{item.requested_by_agent}</b></span><span>{when(item.created_at)}</span><span>{item.business_id}</span>
      {link && (link.external ? <a href={link.href} target="_blank" rel="noreferrer noopener">Open related ↗</a> : <Link to={link.to}>Open related →</Link>)}</div>
    {open && <div className="vh-inbox-body">
      {item.summary && <p>{item.summary}</p>}
      {item.decision_note && <p className="vh-muted">Decision note: {item.decision_note}</p>}
      {(events || []).map((e, i) => <p key={i} className="vh-muted">{when(e.created_at)} · you {e.event}{e.body ? `: ${e.body}` : ''}</p>)}
      <textarea aria-label="Comment" placeholder={item.status === 'pending' ? 'Comment (required to reject)' : 'Comment'} value={note} maxLength={4000} onChange={e => setNote(e.target.value)} />
      <div className="vh-inbox-actions">
        {item.status === 'pending' && <><button className="vh-btn primary" disabled={busy} onClick={() => act('approve')}>Approve</button><button className="vh-btn" disabled={busy} onClick={() => act('reject')}>Reject</button></>}
        <button className="vh-btn" disabled={busy || !note.trim()} onClick={() => run(() => comment(item, note))}>Comment</button>
        {err && <span role="alert" className="vh-neg">{err}</span>}
      </div>
      {item.status === 'pending' && item.kind === 'approval' && <p className="vh-muted">Approving records your decision only. The agent carries out the action; this app never runs it.</p>}
    </div>}
  </li>
}
export default function InboxSection() {
  const { items, events, loading, error } = useInbox()
  const [f, setF] = useState({ kind: 'all', agent: 'all', status: 'pending' })
  useEffect(() => { loadInbox() }, [])
  const rows = filterItems(items, f)
  const sel = (k, opts, label) => <label className="vh-inbox-filter">{label}<select value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}><option value="all">All</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select></label>
  return <>{INBOX_FIXTURE && <div role="alert" className="vh-bsg-fixture">FIXTURE DATA, not real approvals</div>}
    <section className="vh-panel"><div className="vh-section-head"><h2>Inbox</h2><span className="vh-badge pending">{unreadCount(items)} unread</span></div>
      <div className="vh-inbox-filters">{sel('kind', ['approval', 'decision', 'task'], 'Type')}{sel('agent', agentsOf(items), 'Agent')}{sel('status', ['pending', 'approved', 'rejected', 'done', 'cancelled'], 'Status')}</div>
      {loading ? <p className="vh-muted">Loading…</p> : error ? <p role="alert" className="vh-neg">Inbox unavailable: {error}</p> : !rows.length ? <p className="vh-muted">Nothing here.</p> :
        <ul className="vh-inbox-list">{rows.map(i => <Item key={i.id} item={i} events={events[i.id]} />)}</ul>}
    </section></>
}
