// Staff Forum service layer.
//
// Storage is localStorage because this sanitized copy has no backend. Every
// function takes the authenticated `user` (from AuthContext) and resolves
// identity, staff number and permissions itself — callers never pass a staff
// number, role or moderation status. When the real API exists, replace the
// bodies with fetch calls and keep these signatures; all authorization must
// then be enforced server-side (this client-side check is UX only).
//
// "Show my name" is presentation-level privacy: `authorId` is always stored
// and moderators can always see it.

import { getUserProfile } from './userProfiles.js'
import { hasPermission } from '../auth/permissions.js'

const STORE_KEY = 'vpms-forum-v2'
const CHANGE_EVENT = 'vpms:forum-changed'

export const CATEGORIES = ['General', 'Safety', 'Workplace Concern', 'Suggestion', 'Operations', 'Ethics & Integrity', 'Anti-Corruption', 'Other']
export const DEFAULT_CATEGORY = 'Other'
export const SENSITIVE_CATEGORIES = ['Safety', 'Ethics & Integrity', 'Anti-Corruption']
export const REPORT_REASONS = ['Harassment', 'Threatening content', 'False/misleading information', 'Offensive content', 'Spam', 'Safety concern', 'Other']
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 800 * 1024
export const MAX_TEXT = 1500
export const MAX_COMMENT = 600

const HOUR = 3600 * 1000

// Clearly marked development data — not real employees or real concerns.
// `department` holds the author's department id (the same ids the PMS uses).
function seed() {
  const now = Date.now()
  const P = (id, authorId, staffNo, displayName, showName, department, category, text, hoursAgo, extra = {}) => ({
    id, type: 'POST', authorId, staffNo, displayName, showName, department, category, text, image: null,
    createdAt: now - hoursAgo * HOUR, status: 'VISIBLE', ...extra,
  })
  return {
    nextId: 100,
    posts: [
      P('a1', 'gm', 'EMP-0001', 'General Manager', true, null, null, 'Month-end KPI submissions are due on the 5th. Department heads, please enter your figures for GM approval. (Sample announcement)', 3, { type: 'ANNOUNCEMENT' }),
      P('a2', 'gm', 'EMP-0001', 'General Manager', true, null, null, 'The staff forum is now open. Share concerns, ideas and updates, and keep posts factual and respectful. (Sample announcement)', 30, { type: 'ANNOUNCEMENT' }),
      P('e1', 'gm', 'EMP-0001', 'General Manager', true, null, null, 'Safety toolbox talk for all depot staff. (Sample event)', 28, { type: 'EVENT', eventAt: now + 2 * 24 * HOUR, location: 'Main depot' }),
      P('e2', 'gm', 'EMP-0001', 'General Manager', true, null, null, 'Quarterly performance review with department heads. (Sample event)', 40, { type: 'EVENT', eventAt: now + 6 * 24 * HOUR, location: 'Boardroom' }),
      P('e3', 'gm', 'EMP-0001', 'General Manager', true, null, null, 'Staff recognition awards. (Sample event)', 52, { type: 'EVENT', eventAt: now + 20 * 24 * HOUR, location: 'Head office' }),
      P('p1', 'seed-1', 'EMP-1042', 'Sample Staff A', true, 'operations', 'Safety', 'The walkway near the loading bay gets slippery after rain. Could we get anti-slip strips or a warning sign? (Sample post)', 2),
      P('p2', 'seed-2', 'EMP-2210', 'Sample Staff B', false, 'finance', 'Suggestion', 'Suggestion: a shared calendar for month-end deadlines so departments stop sending the same reminder emails. (Sample post)', 7),
      P('p3', 'seed-3', 'EMP-3318', 'Sample Staff C', true, 'hr', 'Workplace Concern', 'The ICT help desk takes a long time to respond to password reset requests. This has happened several times. (Sample post)', 26),
      P('p4', 'seed-4', 'EMP-4107', 'Sample Staff D', true, 'productMonitoring', 'General', 'Welcome to the VPMS Staff Forum. Please keep posts factual and respectful. (Sample post)', 50),
      P('p5', 'seed-5', 'EMP-5120', 'Sample Staff E', false, 'operations', 'Operations', 'Truck turnaround at the gantry slows down after 3pm. Could we stagger loading slots between the two bays? (Sample post)', 12),
      P('p6', 'seed-6', 'EMP-6044', 'Sample Staff F', false, 'procurement', 'Ethics & Integrity', 'Please remind everyone to declare gifts from suppliers in line with the code of conduct. (Sample post)', 18),
      P('p7', 'seed-7', 'EMP-7031', 'Sample Staff G', false, 'security', 'Anti-Corruption', 'Reminder that any request for payment to speed up a service should be reported through the proper channel. (Sample post)', 34),
      P('p8', 'seed-8', 'EMP-8002', 'Sample Staff H', true, 'engineering', 'Other', 'Lost and found: a blue hard hat was left at the workshop. Please collect it from the front desk. (Sample post)', 60),
    ],
    comments: [
      { id: 'c1', postId: 'p1', authorId: 'seed-5', staffNo: 'EMP-5120', displayName: 'Sample Staff E', showName: false, text: 'Agreed, a sign would be a quick fix. (Sample comment)', createdAt: now - 1 * HOUR, status: 'VISIBLE' },
      { id: 'c2', postId: 'p3', authorId: 'seed-6', staffNo: 'EMP-6044', displayName: 'Sample Staff F', showName: true, text: 'Same here. It took two days last week. (Sample comment)', createdAt: now - 20 * HOUR, status: 'VISIBLE' },
    ],
    reactions: { 'p1::seed-2': 'LIKE', 'p1::seed-3': 'LIKE', 'p1::seed-4': 'LIKE', 'p2::seed-1': 'LIKE', 'p3::seed-1': 'LIKE', 'p3::seed-2': 'LIKE', 'p3::seed-4': 'DISLIKE', 'a1::seed-1': 'LIKE', 'p5::seed-1': 'LIKE', 'p6::seed-2': 'LIKE' },
    reports: [],
    audit: [],
  }
}

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to seed */ }
  return seed()
}

function write(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch { throw new Error('Your change could not be saved. Free some browser storage and try again.') }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeToForum(onChange) {
  const onStorage = (event) => { if (event.key === STORE_KEY) onChange() }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

// Stable demo staff number derived from the account id. In the real system
// this comes from the staff record, never from the client.
export function staffNumberFor(user) {
  let h = 0
  for (const ch of String(user.id)) h = (h * 31 + ch.charCodeAt(0)) % 9000
  return `EMP-${1000 + h}`
}

export const canModerate = (user) => hasPermission(user, 'forum.moderate')

function requireUser(user) {
  if (!hasPermission(user, 'forum.post')) throw new Error('You are not allowed to use the forum.')
}

function clean(text, max) {
  const t = String(text ?? '').replace(/\u0000/g, '').trim()
  if (!t) throw new Error('Text is required.')
  if (t.length > max) throw new Error(`Text is too long (max ${max} characters).`)
  return t // rendered as plain text by React, so no HTML is ever interpreted
}

function audit(store, user, action, ref) {
  store.audit.push({ at: Date.now(), by: user.id, action, ref })
}

function author(user, showName) {
  return {
    authorId: user.id,
    staffNo: staffNumberFor(user),
    displayName: getUserProfile(user.id).displayName || user.name,
    showName: Boolean(showName),
    department: user.departmentId ?? null,
  }
}

/** What other staff see. Moderators additionally get the real author. */
export function presentAuthor(item, viewer) {
  const displayName = getUserProfile(item.authorId).displayName || item.displayName
  const label = item.showName ? `${displayName} · ${item.staffNo}` : item.staffNo
  return { label, trueAuthor: canModerate(viewer) ? `${item.displayName} (${item.authorId})` : null }
}

export function getFeed(user) {
  requireUser(user)
  const s = read()
  const mod = canModerate(user)
  return s.posts
    .filter((p) => mod || p.status === 'VISIBLE')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => {
      const reactions = Object.entries(s.reactions).filter(([k]) => k.startsWith(`${p.id}::`))
      return {
        ...p,
        likes: reactions.filter(([, v]) => v === 'LIKE').length,
        dislikes: reactions.filter(([, v]) => v === 'DISLIKE').length,
        myReaction: s.reactions[`${p.id}::${user.id}`] ?? null,
        commentCount: s.comments.filter((c) => c.postId === p.id && (mod || c.status === 'VISIBLE')).length,
        // "For you": my own posts, my department's posts, and threads I replied in.
        involvesMe: p.authorId === user.id
          || Boolean(user.departmentId && p.department === user.departmentId)
          || s.comments.some((c) => c.postId === p.id && c.authorId === user.id),
      }
    })
}

/** Next events (not yet started), soonest first. */
export function upcomingEvents(user, limit = 3) {
  requireUser(user)
  const now = Date.now()
  return read().posts
    .filter((p) => p.type === 'EVENT' && p.status === 'VISIBLE' && p.eventAt >= now)
    .sort((a, b) => a.eventAt - b.eventAt)
    .slice(0, limit)
}

export function getComments(user, postId) {
  requireUser(user)
  const mod = canModerate(user)
  return read().comments.filter((c) => c.postId === postId && (mod || c.status === 'VISIBLE')).sort((a, b) => a.createdAt - b.createdAt)
}

export function validateImage(file) {
  if (!file) return null
  if (!IMAGE_TYPES.includes(file.type)) return 'Only JPEG, PNG, WebP or GIF images are allowed.'
  if (file.size > MAX_IMAGE_BYTES) return `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024)} KB).`
  return null
}

export const POST_TYPES = ['POST', 'ANNOUNCEMENT', 'EVENT']

export function createPost(user, { text, category, showName, image, images, type = 'POST', eventAt, location }) {
  requireUser(user)
  if (!POST_TYPES.includes(type)) throw new Error('Invalid post type.')
  if (type !== 'POST' && !hasPermission(user, 'forum.announce')) throw new Error('Only management can publish announcements and events.')
  let when = null
  if (type === 'EVENT') {
    when = new Date(eventAt).getTime()
    if (!Number.isFinite(when)) throw new Error('Choose the event date and time.')
  }
  const gallery = images === undefined ? [] : images
  if (!Array.isArray(gallery) || gallery.length > 5) throw new Error('Choose up to five images per post.')
  if (gallery.some(src => typeof src !== 'string' || !IMAGE_TYPES.some(type => src.startsWith(`data:${type};base64,`)))) throw new Error('Choose valid JPEG, PNG, WebP or GIF images.')
  if (gallery.reduce((size, src) => size + src.length * 0.75, 0) > 2 * 1024 * 1024) throw new Error('Keep the combined images below 2 MB.')
  const s = read()
  const post = {
    id: `p${s.nextId++}`, type, ...author(user, showName),
    // Posts without a category are treated as "Other".
    category: type === 'POST' ? (category && CATEGORIES.includes(category) ? category : DEFAULT_CATEGORY) : null,
    text: clean(text, MAX_TEXT),
    images: gallery,
    image: image && IMAGE_TYPES.some((t) => image.startsWith(`data:${t};base64,`)) ? image : null,
    eventAt: when, location: type === 'EVENT' ? String(location ?? '').trim().slice(0, 120) : null,
    createdAt: Date.now(), status: 'VISIBLE',
  }
  s.posts.push(post)
  audit(s, user, `${type}_CREATED`, post.id)
  write(s)
  return post
}

export function deletePost(user, postId) {
  requireUser(user)
  const s = read()
  const post = s.posts.find((p) => p.id === postId)
  if (!post) throw new Error('Post not found.')
  if (post.authorId !== user.id && !canModerate(user)) throw new Error('You can only delete your own posts.')
  // Soft delete keeps the audit trail for integrity-related reports.
  post.status = post.authorId === user.id ? 'DELETED_BY_AUTHOR' : 'REMOVED_BY_MODERATOR'
  audit(s, user, 'POST_REMOVED', postId)
  write(s)
}

export function addComment(user, postId, { text, showName }) {
  requireUser(user)
  const s = read()
  if (!s.posts.some((p) => p.id === postId && p.status === 'VISIBLE')) throw new Error('Post not found.')
  s.comments.push({ id: `c${s.nextId++}`, postId, ...author(user, showName), text: clean(text, MAX_COMMENT), createdAt: Date.now(), status: 'VISIBLE' })
  audit(s, user, 'COMMENT_CREATED', postId)
  write(s)
}

export function removeComment(user, commentId) {
  requireUser(user)
  const s = read()
  const c = s.comments.find((x) => x.id === commentId)
  if (!c) throw new Error('Comment not found.')
  if (c.authorId !== user.id && !canModerate(user)) throw new Error('You can only remove your own comments.')
  c.status = c.authorId === user.id ? 'DELETED_BY_AUTHOR' : 'REMOVED_BY_MODERATOR'
  audit(s, user, 'COMMENT_REMOVED', commentId)
  write(s)
}

/** One reaction per user per post; choosing the same one again removes it. */
export function toggleReaction(user, postId, type) {
  requireUser(user)
  if (type !== 'LIKE' && type !== 'DISLIKE') throw new Error('Invalid reaction.')
  const s = read()
  if (!s.posts.some((p) => p.id === postId && p.status === 'VISIBLE')) throw new Error('Post not found.')
  const key = `${postId}::${user.id}`
  if (s.reactions[key] === type) delete s.reactions[key]
  else s.reactions[key] = type
  write(s)
}

export function report(user, { kind, id, reason }) {
  requireUser(user)
  if (!REPORT_REASONS.includes(reason)) throw new Error('Choose a report reason.')
  if (kind !== 'POST' && kind !== 'COMMENT') throw new Error('Invalid report.')
  const s = read()
  if (s.reports.some((r) => r.kind === kind && r.targetId === id && r.reporterId === user.id)) throw new Error('You have already reported this.')
  s.reports.push({ id: `r${s.nextId++}`, kind, targetId: id, reporterId: user.id, reason, status: 'OPEN', moderator: null, createdAt: Date.now() })
  audit(s, user, 'REPORTED', id)
  write(s)
}

export function getModerationQueue(user) {
  if (!canModerate(user)) throw new Error('Moderators only.')
  const s = read()
  return s.reports
    .map((r) => ({ ...r, target: (r.kind === 'POST' ? s.posts : s.comments).find((x) => x.id === r.targetId) }))
    .sort((a, b) => (a.status === 'OPEN' ? -1 : 1) - (b.status === 'OPEN' ? -1 : 1) || b.createdAt - a.createdAt)
}

/** Reports never auto-delete content; a moderator resolves each one. */
export function resolveReport(user, reportId, action) {
  if (!canModerate(user)) throw new Error('Moderators only.')
  const s = read()
  const r = s.reports.find((x) => x.id === reportId)
  if (!r) throw new Error('Report not found.')
  if (action === 'REMOVE') {
    const target = (r.kind === 'POST' ? s.posts : s.comments).find((x) => x.id === r.targetId)
    if (target) target.status = 'REMOVED_BY_MODERATOR'
  }
  r.status = action === 'REMOVE' ? 'ACTIONED' : 'DISMISSED'
  r.moderator = user.id
  audit(s, user, `REPORT_${r.status}`, reportId)
  write(s)
}

export function restorePost(user, postId) {
  if (!canModerate(user)) throw new Error('Moderators only.')
  const s = read()
  const p = s.posts.find((x) => x.id === postId)
  if (p) p.status = 'VISIBLE'
  audit(s, user, 'POST_RESTORED', postId)
  write(s)
}

export function timeAgo(ts) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}
