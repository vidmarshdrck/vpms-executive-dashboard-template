import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const mem = new Map()
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} }
globalThis.Event = class { constructor(t) { this.type = t } }

const store = await import('./forumStore.js')
const { authenticateDemoUser } = await import('../auth/demoAuth.js')
const staff = authenticateDemoUser('finance_staff', 'ChangeMe123!')
const other = authenticateDemoUser('ict_head', 'ChangeMe123!')
const admin = authenticateDemoUser('admin', 'ChangeMe123!')
const gm = authenticateDemoUser('gm', 'ChangeMe123!')

beforeEach(() => mem.clear())

test('every role can use the forum, moderation is admin only', () => {
  for (const u of [staff, other, admin, gm]) assert.ok(store.getFeed(u).length > 0)
  assert.equal(store.canModerate(staff), false)
  assert.equal(store.canModerate(gm), false)
  assert.equal(store.canModerate(admin), true)
  assert.throws(() => store.getModerationQueue(staff))
})

test('showName OFF hides the name from colleagues but keeps the real author for moderators', () => {
  const post = store.createPost(staff, { text: 'hello', showName: false })
  assert.match(post.staffNo, /^EMP-\d{4}$/)
  assert.equal(post.authorId, staff.id)
  const seenByOther = store.presentAuthor(post, other)
  assert.equal(seenByOther.label, post.staffNo)
  assert.equal(seenByOther.trueAuthor, null)
  assert.match(store.presentAuthor(post, admin).trueAuthor, new RegExp(staff.id))
})

test('showName ON shows name and staff number', () => {
  const post = store.createPost(staff, { text: 'hello', showName: true })
  assert.equal(store.presentAuthor(post, other).label, `${staff.name} · ${post.staffNo}`)
})

test('client cannot spoof staff number or status', () => {
  const post = store.createPost(staff, { text: 'x', staffNo: 'EMP-0001', status: 'PINNED', authorId: 'someone' })
  assert.equal(post.staffNo, store.staffNumberFor(staff))
  assert.equal(post.status, 'VISIBLE')
  assert.equal(post.authorId, staff.id)
})

test('one reaction per user, toggling removes it, switching replaces it', () => {
  const p = store.createPost(staff, { text: 'x' })
  const get = () => store.getFeed(other).find((x) => x.id === p.id)
  store.toggleReaction(other, p.id, 'LIKE')
  assert.deepEqual([get().likes, get().dislikes], [1, 0])
  store.toggleReaction(other, p.id, 'DISLIKE')
  assert.deepEqual([get().likes, get().dislikes], [0, 1])
  store.toggleReaction(other, p.id, 'DISLIKE')
  assert.deepEqual([get().likes, get().dislikes], [0, 0])
})

test('only the author or a moderator can delete a post; deletion is soft', () => {
  const p = store.createPost(staff, { text: 'x' })
  assert.throws(() => store.deletePost(other, p.id))
  store.deletePost(admin, p.id)
  assert.ok(!store.getFeed(other).some((x) => x.id === p.id))
  assert.ok(store.getFeed(admin).some((x) => x.id === p.id && x.status === 'REMOVED_BY_MODERATOR'))
})

test('reports do not delete content; a moderator resolves them', () => {
  const p = store.createPost(staff, { text: 'x' })
  store.report(other, { kind: 'POST', id: p.id, reason: 'Spam' })
  assert.throws(() => store.report(other, { kind: 'POST', id: p.id, reason: 'Spam' }))
  assert.ok(store.getFeed(other).some((x) => x.id === p.id))
  const [r] = store.getModerationQueue(admin)
  assert.throws(() => store.resolveReport(other, r.id, 'REMOVE'))
  store.resolveReport(admin, r.id, 'REMOVE')
  assert.ok(!store.getFeed(other).some((x) => x.id === p.id))
})

test('validates text, images and report reasons', () => {
  assert.throws(() => store.createPost(staff, { text: '   ' }))
  assert.throws(() => store.createPost(staff, { text: 'a'.repeat(store.MAX_TEXT + 1) }))
  assert.equal(store.validateImage({ type: 'application/x-msdownload', size: 10 }) !== null, true)
  assert.equal(store.validateImage({ type: 'image/png', size: store.MAX_IMAGE_BYTES + 1 }) !== null, true)
  assert.equal(store.validateImage({ type: 'image/png', size: 100 }), null)
  const p = store.createPost(staff, { text: 'x', image: 'data:text/html;base64,AAAA' })
  assert.equal(p.image, null)
  assert.throws(() => store.report(other, { kind: 'POST', id: p.id, reason: 'nonsense' }))
})

test('multi-image posts retain order and reject invalid or oversized galleries', () => {
  const images = ['data:image/png;base64,AAAA', 'data:image/jpeg;base64,BBBB']
  const post = store.createPost(staff, { text: 'Photo update', images, showName: true })
  assert.deepEqual(store.getFeed(other).find(item => item.id === post.id).images, images)
  assert.throws(() => store.createPost(staff, { text: 'Too many', images: Array(6).fill(images[0]) }), /five/)
  assert.throws(() => store.createPost(staff, { text: 'Bad image', images: ['data:text/html;base64,AAAA'] }), /valid/)
  assert.throws(() => store.createPost(staff, { text: 'Too large', images: ['data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)] }), /2 MB/)
  const legacy = store.createPost(staff, { text: 'Legacy image', image: images[0] })
  assert.equal(store.getFeed(other).find(item => item.id === legacy.id).image, images[0])
})

test('display names update old posts without exposing names on anonymous posts', async () => {
  const { saveUserProfile, getUserProfile } = await import('./userProfiles.js')
  const named = store.createPost(staff, { text: 'Named post', showName: true })
  const anonymous = store.createPost(staff, { text: 'Anonymous post', showName: false })
  saveUserProfile(staff, { displayName: 'ChatGPT', bio: 'Working together.', joinedOn: '2020-02-29' })
  assert.equal(getUserProfile(staff.id).displayName, 'ChatGPT')
  assert.equal(getUserProfile(other.id).displayName, undefined)
  assert.match(store.presentAuthor(named, other).label, /^ChatGPT/)
  assert.equal(store.presentAuthor(anonymous, other).label, anonymous.staffNo)
  assert.equal(staff.username, 'finance_staff')
  assert.throws(() => saveUserProfile(staff, { displayName: '', bio: '' }), /display name/)
  assert.throws(() => saveUserProfile(staff, { displayName: 'Valid', joinedOn: '2025-02-30' }), /valid joining date/)
  assert.throws(() => saveUserProfile(staff, { displayName: 'Valid', joinedOn: '2099-01-01' }), /valid joining date/)
})

test('storage failure is reported instead of claiming the post was saved', () => {
  const setItem = localStorage.setItem
  localStorage.setItem = () => { throw new Error('Quota exceeded') }
  try { assert.throws(() => store.createPost(staff, { text: 'Keep this draft' }), /could not be saved/) }
  finally { localStorage.setItem = setItem }
})
