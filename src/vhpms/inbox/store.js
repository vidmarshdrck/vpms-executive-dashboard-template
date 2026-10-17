import { useSyncExternalStore } from 'react'
import { supabase } from '../supabaseClient.js'
import { taskApiBase } from '../backendStatus.js'
import { inboxFixture } from './fixture.js'
import { applyDecision } from './logic.js'
export const INBOX_FIXTURE = import.meta.env.VITE_BSG_FIXTURE === 'true'
let state = INBOX_FIXTURE ? { items: inboxFixture, events: {} } : { items: [], events: {}, loading: true }
const subs = new Set()
const set = next => { state = { ...state, ...next }; subs.forEach(f => f()) }
export const useInbox = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => state)
const api = path => taskApiBase(import.meta.env).replace(/\/api\/tasks$/, '/api/inbox') + path
async function call(path, body) {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) throw new Error('Sign in on Live workspace first')
  const r = await fetch(api(path), { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}
export async function loadInbox() {
  if (INBOX_FIXTURE) return
  try { const d = await call(''); set({ items: d.items, loading: false, error: null }) } catch (e) { set({ loading: false, error: e.message }) }
}
const addEvent = (id, ev) => set({ events: { ...state.events, [id]: [...(state.events[id] || []), ev] } })
// Records the decision only. Nothing is executed by the app.
export async function decide(item, decision, note) {
  const now = new Date().toISOString()
  if (INBOX_FIXTURE) set({ items: state.items.map(i => i.id === item.id ? applyDecision(i, decision, note, now) : i) })
  else { const d = await call(`/${item.id}/decision`, { decision, note: note || null, revision: item.revision }); set({ items: state.items.map(i => i.id === item.id ? d.item : i) }) }
  addEvent(item.id, { event: decision === 'approve' ? 'approved' : 'rejected', body: note?.trim() || null, created_at: now })
}
export async function comment(item, body) {
  if (!INBOX_FIXTURE) await call(`/${item.id}/comment`, { body })
  addEvent(item.id, { event: 'commented', body: body.trim(), created_at: new Date().toISOString() })
}
export function markRead(item) { if (INBOX_FIXTURE && !item.read_at) set({ items: state.items.map(i => i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i) }) }
