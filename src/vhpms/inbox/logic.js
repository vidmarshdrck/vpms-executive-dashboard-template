export const KIND_LABEL = { approval: 'Approval', decision: 'Decision', task: 'Task' }
export const unreadCount = items => items.filter(i => i.status === 'pending' && !i.read_at).length
export const agentsOf = items => [...new Set(items.map(i => i.requested_by_agent))].sort()
export function filterItems(items, { kind = 'all', agent = 'all', status = 'all' } = {}) {
  return items.filter(i => (kind === 'all' || i.kind === kind) && (agent === 'all' || i.requested_by_agent === agent) && (status === 'all' || i.status === status))
    .sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || b.created_at.localeCompare(a.created_at))
}
// Client mirror of the server rule: reject requires a note; only pending items can be decided.
export function decisionError(item, decision, note) {
  if (item.status !== 'pending') return 'Already decided'
  if (decision === 'reject' && !note?.trim()) return 'A comment is required to reject'
  return null
}
export function applyDecision(item, decision, note, now = new Date().toISOString()) {
  return { ...item, status: decision === 'approve' ? 'approved' : 'rejected', decision_note: note?.trim() || null, decided_at: now, read_at: item.read_at || now, revision: (item.revision || 1) + 1 }
}
export function linkFor(item) {
  if (item.link_type === 'url' && /^https:\/\//.test(item.link_ref || '')) return { href: item.link_ref, external: true }
  if (item.link_type === 'project' && item.link_ref === 'bsg') return { to: '/bsg' }
  if (item.link_type === 'activity') return { to: '/support-overview' }
  if (item.link_type) return { to: `/live-workspace?${item.link_type}=${encodeURIComponent(item.link_ref || '')}` }
  return null
}
