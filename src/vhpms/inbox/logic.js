export const KIND_LABEL = { approval: 'Approval', decision: 'Decision', task: 'Task' }
export const GROUPS = [
  { kind: 'approval', label: 'Needs approval' },
  { kind: 'decision', label: 'Decisions' },
  { kind: 'task', label: 'Assigned to you' },
]
export const AGENTS = {
  boaz: { name: 'Boaz', role: 'BSG desk', initials: 'BZ', tone: 'solid' },
  bags: { name: 'Bags', role: 'Operations', initials: 'BG', tone: 'tint' },
  bagheera: { name: 'Bagheera', role: 'Assistant', initials: 'BH', tone: 'ink' },
}
export const agentInfo = id => AGENTS[id] || { name: id, role: 'Agent', initials: (id || '?').slice(0, 2).toUpperCase(), tone: 'tint' }
export const isUnread = i => i.status === 'pending' && !i.read_at
export const unreadCount = items => items.filter(isUnread).length
export const agentsOf = items => [...new Set(items.map(i => i.requested_by_agent))].sort()
const DECIDED = ['approved', 'rejected', 'done', 'cancelled']
export function filterItems(items, { kind = 'all', agent = 'all', status = 'all' } = {}) {
  return items.filter(i => (kind === 'all' || i.kind === kind) && (agent === 'all' || i.requested_by_agent === agent) &&
    (status === 'all' || (status === 'decided' ? DECIDED.includes(i.status) : i.status === status)))
    .sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || b.created_at.localeCompare(a.created_at))
}
// Ordered groups for the list; the flat order is what j/k walks.
export function groupItems(items) {
  return GROUPS.map(g => ({ ...g, items: items.filter(i => i.kind === g.kind) })).filter(g => g.items.length)
}
export function counts(items) {
  const pending = k => items.filter(i => i.kind === k && i.status === 'pending').length
  return { approval: pending('approval'), decision: pending('decision'), task: pending('task'), decided: items.filter(i => DECIDED.includes(i.status)).length }
}
export function relativeTime(iso, now = Date.now()) {
  const s = Math.round((now - Date.parse(iso)) / 1000)
  if (!Number.isFinite(s)) return ''
  if (s < 60) return 'now'
  const m = Math.round(s / 60); if (m < 60) return `${m}m`
  const h = Math.round(m / 60); if (h < 24) return `${h}h`
  const d = Math.round(h / 24); if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
export const absoluteTime = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : ''
// Client mirror of the server rule: reject requires a note; only pending items can be decided.
export function decisionError(item, decision, note) {
  if (item.status !== 'pending') return 'Already decided'
  if (decision === 'reject' && !note?.trim()) return 'Add a comment so the agent knows why'
  return null
}
export function applyDecision(item, decision, note, now = new Date().toISOString()) {
  return { ...item, status: decision === 'approve' ? 'approved' : 'rejected', decision_note: note?.trim() || null, decided_at: now, read_at: item.read_at || now, revision: (item.revision || 1) + 1 }
}
export function linkFor(item) {
  if (item.link_type === 'url' && /^https:\/\//.test(item.link_ref || '')) return { href: item.link_ref, external: true, label: new URL(item.link_ref).host }
  if (item.link_type === 'project' && item.link_ref === 'bsg') return { to: '/bsg', label: 'BSG trading' }
  if (item.link_type === 'activity') return { to: '/support-overview', label: 'Activities' }
  if (item.link_type && item.link_type !== 'url') return { to: `/live-workspace?${item.link_type}=${encodeURIComponent(item.link_ref || '')}`, label: `${item.link_type === 'project' ? 'Project' : 'Task'} ${item.link_ref}` }
  return null
}
// Keyboard: j/k move, a approve, r reject. Ignored while typing.
export function shortcutFor(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return null
  return { j: 'next', k: 'prev', a: 'approve', r: 'reject', Escape: 'close' }[e.key] || null
}
export function step(ids, current, dir) {
  if (!ids.length) return null
  const i = ids.indexOf(current)
  if (i < 0) return ids[0]
  return ids[Math.min(ids.length - 1, Math.max(0, i + (dir === 'next' ? 1 : -1)))]
}
