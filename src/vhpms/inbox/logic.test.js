import test from 'node:test'
import assert from 'node:assert/strict'
import { unreadCount, filterItems, decisionError, applyDecision, linkFor, agentsOf, groupItems, counts, relativeTime, shortcutFor, step } from './logic.js'
import { inboxFixture } from './fixture.js'
test('unread counts pending unread only', () => assert.equal(unreadCount(inboxFixture), 5))
test('filters by type, agent and status; pending first; decided bucket', () => {
  assert.ok(filterItems(inboxFixture, { kind: 'approval' }).every(i => i.kind === 'approval'))
  assert.ok(filterItems(inboxFixture, { agent: 'boaz', status: 'pending' }).every(i => i.requested_by_agent === 'boaz' && i.status === 'pending'))
  assert.equal(filterItems(inboxFixture, { status: 'decided' }).length, 2)
  const all = filterItems(inboxFixture); assert.equal(all[0].status, 'pending'); assert.notEqual(all.at(-1).status, 'pending')
  assert.deepEqual(agentsOf(inboxFixture), ['bagheera', 'bags', 'boaz'])
})
test('groups in fixed order and counts', () => {
  assert.deepEqual(groupItems(filterItems(inboxFixture, { status: 'pending' })).map(g => g.label), ['Needs approval', 'Decisions', 'Assigned to you'])
  assert.deepEqual(counts(inboxFixture), { approval: 4, decision: 2, task: 1, decided: 2 })
})
test('reject needs a comment; decided items locked', () => {
  const p = inboxFixture[0]
  assert.match(decisionError(p, 'reject', ' '), /comment/)
  assert.equal(decisionError(p, 'approve', ''), null)
  assert.equal(decisionError(inboxFixture.find(i => i.status === 'rejected'), 'approve'), 'Already decided')
  const r = applyDecision(p, 'reject', ' no ', 'T'); assert.equal(r.status, 'rejected'); assert.equal(r.decision_note, 'no'); assert.equal(r.revision, 2)
})
test('links never allow non-https urls', () => {
  assert.equal(linkFor({ link_type: 'url', link_ref: 'javascript:alert(1)' }), null)
  assert.equal(linkFor({ link_type: 'project', link_ref: 'bsg' }).to, '/bsg')
})
test('relative time', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')
  assert.equal(relativeTime('2026-10-16T11:59:30Z', now), 'now')
  assert.equal(relativeTime('2026-10-16T11:15:00Z', now), '45m')
  assert.equal(relativeTime('2026-10-16T07:00:00Z', now), '5h')
  assert.equal(relativeTime('2026-10-14T12:00:00Z', now), '2d')
})
test('keyboard shortcuts ignore typing and walk the list', () => {
  assert.equal(shortcutFor({ key: 'j', target: { tagName: 'DIV' } }), 'next')
  assert.equal(shortcutFor({ key: 'a', target: { tagName: 'TEXTAREA' } }), null)
  assert.equal(shortcutFor({ key: 'r', metaKey: true, target: {} }), null)
  assert.equal(step(['a', 'b', 'c'], 'b', 'next'), 'c'); assert.equal(step(['a', 'b', 'c'], 'c', 'next'), 'c')
  assert.equal(step(['a', 'b'], 'a', 'prev'), 'a'); assert.equal(step(['a', 'b'], null, 'next'), 'a'); assert.equal(step([], 'x', 'next'), null)
})
