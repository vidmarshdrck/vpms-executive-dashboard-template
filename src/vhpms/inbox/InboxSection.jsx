import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ShieldCheck, Scale, ListTodo, CheckCheck, ArrowUpRight, Check, X, MessageSquare, Inbox as InboxIcon, ChevronLeft, Send, Rocket, Trash2, CandlestickChart, Banknote, Circle } from 'lucide-react'
import { useInbox, loadInbox, decide, comment, markRead } from './store.js'
import { KIND_LABEL, agentInfo, agentsOf, filterItems, groupItems, counts, decisionError, linkFor, isUnread, relativeTime, absoluteTime, shortcutFor, step } from './logic.js'
import './inbox.css'

const ACTION_ICON = { send: Send, deploy: Rocket, delete: Trash2, trade: CandlestickChart, payment: Banknote, other: Circle }
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', done: 'Done', cancelled: 'Cancelled' }

function Avatar({ agent, size = 'md' }) {
  const a = agentInfo(agent)
  return <span className={`ibx-avatar ibx-avatar--${a.tone} ibx-avatar--${size}`} aria-hidden="true">{a.initials}</span>
}
function TypeChip({ item }) {
  const Icon = item.action ? ACTION_ICON[item.action] : null
  return <span className="ibx-chip">{Icon && <Icon size={12} strokeWidth={2} />}{item.action ? item.action[0].toUpperCase() + item.action.slice(1) : KIND_LABEL[item.kind]}</span>
}
function StatusTag({ status }) { return <span className={`ibx-status ibx-status--${status}`}>{STATUS_LABEL[status] || status}</span> }

function SummaryCards({ c, filters, setFilters }) {
  const cards = [
    { key: 'approval', label: 'Needs approval', value: c.approval, icon: ShieldCheck, apply: { kind: 'approval', status: 'pending' } },
    { key: 'decision', label: 'Decisions', value: c.decision, icon: Scale, apply: { kind: 'decision', status: 'pending' } },
    { key: 'task', label: 'Assigned to you', value: c.task, icon: ListTodo, apply: { kind: 'task', status: 'pending' } },
    { key: 'decided', label: 'Decided', value: c.decided, icon: CheckCheck, apply: { kind: 'all', status: 'decided' } },
  ]
  return <div className="ibx-cards" role="group" aria-label="Inbox summary">{cards.map(({ key, label, value, icon: Icon, apply }) => {
    const active = filters.kind === apply.kind && filters.status === apply.status
    return <button key={key} type="button" aria-pressed={active} className="ibx-card" onClick={() => setFilters(f => active ? { ...f, kind: 'all', status: 'pending' } : { ...f, ...apply })}>
      <span className="ibx-card__icon"><Icon size={16} strokeWidth={1.8} /></span>
      <span className="ibx-card__value">{value}</span><span className="ibx-card__label">{label}</span>
    </button>
  })}</div>
}

function Toolbar({ filters, setFilters, agents }) {
  return <div className="ibx-toolbar">
    <div className="ibx-seg" role="group" aria-label="Status">{[['pending', 'Pending'], ['decided', 'Decided'], ['all', 'All']].map(([v, l]) =>
      <button key={v} type="button" aria-pressed={filters.status === v} onClick={() => setFilters(f => ({ ...f, status: v }))}>{l}</button>)}</div>
    <label className="ibx-select"><span>Type</span><select value={filters.kind} onChange={e => setFilters(f => ({ ...f, kind: e.target.value }))}><option value="all">All types</option><option value="approval">Approvals</option><option value="decision">Decisions</option><option value="task">Tasks</option></select></label>
    <label className="ibx-select"><span>Agent</span><select value={filters.agent} onChange={e => setFilters(f => ({ ...f, agent: e.target.value }))}><option value="all">All agents</option>{agents.map(a => <option key={a} value={a}>{agentInfo(a).name}</option>)}</select></label>
    <p className="ibx-keys" aria-label="Keyboard shortcuts"><kbd>J</kbd><kbd>K</kbd> move <kbd>A</kbd> approve <kbd>R</kbd> reject</p>
  </div>
}

function Row({ item, selected, onSelect }) {
  const a = agentInfo(item.requested_by_agent)
  return <li><button type="button" id={`ibx-row-${item.id}`} className="ibx-row" aria-current={selected || undefined} onClick={() => onSelect(item.id)}>
    <Avatar agent={item.requested_by_agent} />
    <span className="ibx-row__main">
      <span className={`ibx-row__title${isUnread(item) ? ' is-unread' : ''}`}>{item.title}</span>
      <span className="ibx-row__meta"><TypeChip item={item} /><span>{a.name}</span>{item.status !== 'pending' && <StatusTag status={item.status} />}</span>
    </span>
    <span className="ibx-row__side"><time dateTime={item.created_at} title={absoluteTime(item.created_at)}>{relativeTime(item.created_at)}</time>{isUnread(item) && <span className="ibx-dot" aria-label="Unread" />}</span>
  </button></li>
}

function EmptyList({ filtered }) {
  return <div className="ibx-empty"><span className="ibx-empty__icon"><InboxIcon size={20} strokeWidth={1.6} /></span>
    <p className="ibx-empty__title">{filtered ? 'Nothing matches these filters' : 'You are all caught up'}</p>
    <p className="ibx-empty__text">{filtered ? 'Try another type, agent or status.' : 'New approvals, decisions and tasks from your agents land here.'}</p></div>
}

function Detail({ item, events, onBack, composerRef, actRef }) {
  const [note, setNote] = useState(''), [err, setErr] = useState(null), [busy, setBusy] = useState(false)
  const run = useCallback(async fn => { setBusy(true); setErr(null); try { await fn(); setNote('') } catch (e) { setErr(e.message) } finally { setBusy(false) } }, [])
  const act = useCallback(d => {
    if (!item) return
    const e = decisionError(item, d, note)
    if (e) { setErr(e); if (d === 'reject') composerRef.current?.focus(); return }
    run(() => decide(item, d, note))
  }, [item, note, run, composerRef])
  useEffect(() => { actRef.current = act; return () => { actRef.current = null } }, [act, actRef])
  if (!item) return <div className="ibx-detail ibx-detail--empty"><div className="ibx-empty"><span className="ibx-empty__icon"><InboxIcon size={20} strokeWidth={1.6} /></span><p className="ibx-empty__title">Select an item</p><p className="ibx-empty__text">Use J and K to move through the list.</p></div></div>
  const a = agentInfo(item.requested_by_agent), link = linkFor(item), pending = item.status === 'pending'
  const thread = [{ who: 'agent', event: 'created', body: item.summary, at: item.created_at },
    ...(item.decided_at && !(events || []).some(e => e.event === item.status) ? [{ who: 'owner', event: item.status, body: item.decision_note, at: item.decided_at }] : []),
    ...(events || []).map(e => ({ who: 'owner', event: e.event, body: e.body, at: e.created_at }))]
  return <article className="ibx-detail" aria-labelledby="ibx-detail-title">
    <div className="ibx-detail__scroll">
      {onBack && <button type="button" className="ibx-back" onClick={onBack}><ChevronLeft size={16} />Inbox</button>}
      <div className="ibx-detail__chips"><span className="ibx-chip ibx-chip--kind">{KIND_LABEL[item.kind]}</span>{item.action && <TypeChip item={item} />}<StatusTag status={item.status} /></div>
      <h3 id="ibx-detail-title" className="ibx-detail__title">{item.title}</h3>
      <div className="ibx-detail__from"><Avatar agent={item.requested_by_agent} size="sm" /><span><b>{a.name}</b> · {a.role}</span><span className="ibx-sep" /><time dateTime={item.created_at}>{absoluteTime(item.created_at)}</time><span className="ibx-sep" /><span>{item.business_id}</span></div>
      {item.payload && Object.keys(item.payload).length > 0 && <dl className="ibx-facts">{Object.entries(item.payload).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>}
      {link && (link.external
        ? <a className="ibx-related" href={link.href} target="_blank" rel="noreferrer noopener"><span><small>Related</small>{link.label}</span><ArrowUpRight size={16} /></a>
        : <Link className="ibx-related" to={link.to}><span><small>Related</small>{link.label}</span><ArrowUpRight size={16} /></Link>)}
      <section className="ibx-thread" aria-label="Activity"><h4>Activity</h4><ol>{thread.map((e, i) => <li key={i} className={`ibx-msg ibx-msg--${e.who}`}>
        {e.who === 'agent' ? <Avatar agent={item.requested_by_agent} size="sm" /> : <span className="ibx-avatar ibx-avatar--you ibx-avatar--sm" aria-hidden="true">SV</span>}
        <div><p className="ibx-msg__head"><b>{e.who === 'agent' ? a.name : 'You'}</b> {e.event === 'created' ? 'requested this' : e.event}<time dateTime={e.at}>{relativeTime(e.at)}</time></p>{e.body && <p className="ibx-msg__body">{e.body}</p>}</div>
      </li>)}</ol></section>
    </div>
    <div className="ibx-bar">
      <label htmlFor="ibx-comment" className="ibx-bar__label">Comment{pending ? <span> · required to reject</span> : null}</label>
      <textarea id="ibx-comment" ref={composerRef} rows={1} maxLength={4000} value={note} onChange={e => { setNote(e.target.value); setErr(null) }} placeholder={pending ? `Reply to ${a.name}` : 'Add a note'} />
      {err && <p role="alert" className="ibx-bar__err">{err}</p>}
      <div className="ibx-bar__actions">
        {pending && item.kind === 'approval' && <p className="ibx-bar__hint">Approving records your decision. {a.name} carries out the {item.action}; VHPMS never runs it.</p>}
        <button type="button" className="ibx-btn ibx-btn--ghost" disabled={busy || !note.trim()} onClick={() => run(() => comment(item, note))}><MessageSquare size={15} />Comment</button>
        {pending && <><button type="button" className="ibx-btn" disabled={busy} onClick={() => act('reject')}><X size={15} />Reject<kbd>R</kbd></button>
          <button type="button" className="ibx-btn ibx-btn--primary" disabled={busy} onClick={() => act('approve')}><Check size={15} />Approve<kbd>A</kbd></button></>}
      </div>
    </div>
  </article>
}

const useMobile = () => {
  const q = '(max-width: 1023px)'
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => { const mq = window.matchMedia(q), f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [])
  return m
}

export default function InboxSection() {
  const { items, events, loading, error } = useInbox()
  const [filters, setFilters] = useState({ kind: 'all', agent: 'all', status: 'pending' })
  const [selectedId, setSelectedId] = useState(null), [sheetOpen, setSheetOpen] = useState(false)
  const mobile = useMobile(), composerRef = useRef(null), actRef = useRef(null)
  useEffect(() => { loadInbox() }, [])
  const rows = useMemo(() => filterItems(items, filters), [items, filters])
  const groups = useMemo(() => groupItems(rows), [rows])
  const ids = useMemo(() => groups.flatMap(g => g.items.map(i => i.id)), [groups])
  const current = selectedId && ids.includes(selectedId) ? selectedId : (mobile ? null : ids[0] ?? null)
  const item = items.find(i => i.id === current) || null
  const select = useCallback(id => { setSelectedId(id); const it = items.find(i => i.id === id); if (it) markRead(it); if (mobile) setSheetOpen(true) }, [items, mobile])
  useEffect(() => { if (!mobile && item && isUnread(item)) markRead(item) }, [mobile, item])
  useEffect(() => {
    const onKey = e => {
      const s = shortcutFor(e); if (!s) return
      if (s === 'next' || s === 'prev') { const n = step(ids, current, s); if (n) { e.preventDefault(); select(n); document.getElementById(`ibx-row-${n}`)?.scrollIntoView({ block: 'nearest' }) } }
      else if (s === 'close') setSheetOpen(false)
      else if (actRef.current && item?.status === 'pending' && (!mobile || sheetOpen)) { e.preventDefault(); actRef.current(s) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [ids, current, item, select, mobile, sheetOpen])
  const filtered = filters.kind !== 'all' || filters.agent !== 'all' || filters.status !== 'pending'
  return <div className="ibx">
    <SummaryCards c={counts(items)} filters={filters} setFilters={setFilters} />
    <div className="ibx-panes">
      <div className="ibx-list">
        <Toolbar filters={filters} setFilters={setFilters} agents={agentsOf(items)} />
        <div className="ibx-list__scroll">
          {loading ? <ul className="ibx-skeleton" aria-label="Loading">{[0, 1, 2, 3].map(i => <li key={i}><span /><span /></li>)}</ul>
            : error ? <div className="ibx-empty"><p className="ibx-empty__title">Inbox unavailable</p><p className="ibx-empty__text">{error}</p></div>
              : !groups.length ? <EmptyList filtered={filtered} />
                : groups.map(g => <section key={g.kind} aria-label={g.label} className="ibx-group"><h3 className="ibx-group__head">{g.label}<span>{g.items.length}</span></h3>
                  <ul>{g.items.map(i => <Row key={i.id} item={i} selected={i.id === current} onSelect={select} />)}</ul></section>)}
        </div>
      </div>
      {!mobile && <Detail key={item?.id ?? 'none'} item={item} events={item ? events[item.id] : null} composerRef={composerRef} actRef={actRef} />}
    </div>
    {mobile && createPortal(<div className={`ibx ibx-sheet${sheetOpen && item ? ' is-open' : ''}`} aria-hidden={!(sheetOpen && item)}>
      <div className="ibx-sheet__backdrop" onClick={() => setSheetOpen(false)} />
      <div className="ibx-sheet__panel" role="dialog" aria-modal="true" aria-label={item?.title || 'Item'}>
        <span className="ibx-sheet__handle" aria-hidden="true" />
        {item && <Detail key={item.id} item={item} events={events[item.id]} composerRef={composerRef} actRef={actRef} onBack={() => setSheetOpen(false)} />}
      </div>
    </div>, document.body)}
  </div>
}
