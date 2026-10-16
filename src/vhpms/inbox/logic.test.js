import test from 'node:test'
import assert from 'node:assert/strict'
import { unreadCount, filterItems, decisionError, applyDecision, linkFor, agentsOf } from './logic.js'
import { inboxFixture } from './fixture.js'
test('unread counts pending unread only', () => assert.equal(unreadCount(inboxFixture), 5))
test('filters by type, agent and status; pending first', () => {
  assert.ok(filterItems(inboxFixture, { kind: 'approval' }).every(i => i.kind === 'approval'))
  assert.ok(filterItems(inboxFixture, { agent: 'boaz', status: 'pending' }).every(i => i.requested_by_agent === 'boaz' && i.status === 'pending'))
  const all = filterItems(inboxFixture); assert.equal(all.at(-1).status === 'pending', false); assert.equal(all[0].status, 'pending')
  assert.deepEqual(agentsOf(inboxFixture), ['bagheera', 'bags', 'boaz'])
})
test('reject needs a comment; decided items locked', () => {
  const p = inboxFixture[0]
  assert.match(decisionError(p, 'reject', ' '), /required/)
  assert.equal(decisionError(p, 'approve', ''), null)
  assert.equal(decisionError(inboxFixture[6], 'approve'), 'Already decided')
  const r = applyDecision(p, 'reject', ' no ', 'T'); assert.equal(r.status, 'rejected'); assert.equal(r.decision_note, 'no'); assert.equal(r.revision, 2)
})
test('links never allow non-https urls', () => {
  assert.equal(linkFor({ link_type: 'url', link_ref: 'javascript:alert(1)' })?.href, undefined)
  assert.deepEqual(linkFor({ link_type: 'project', link_ref: 'bsg' }), { to: '/bsg' })
})
