import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyState, addRecord, toggleTask, totals, parseState, weekKey } from './model.js'
test('new workspace has no fabricated business records', () => {
  assert.deepEqual(emptyState().tasks, [])
  assert.deepEqual(emptyState().ledger, [])
})
test('task creation trims titles and records business scope', () => {
  const state = addRecord(emptyState(), 'tasks', { title: '  Review release  ', business: 'VAI', owner: 'Nathan', date: '2026-10-15' })
  assert.equal(state.tasks[0].title, 'Review release')
  assert.equal(state.tasks[0].business, 'VAI')
  assert.equal(toggleTask(state, state.tasks[0].id).tasks[0].done, true)
  assert.throws(() => addRecord(state, 'tasks', {title:' '}))
})
test('ledger totals count only manually entered paid receipts in selected scope', () => {
  let s=emptyState()
  for (const record of [{title:'Receipt',amount:12.5,status:'Paid',scope:'Business'}, {title:'Invoice',amount:8,status:'Pending',scope:'Business'}, {title:'Own',amount:9,status:'Paid',scope:'Personal'}]) s=addRecord(s,'ledger',record)
  assert.equal(totals(s.ledger,'Business').paid,12.5)
  assert.equal(totals(s.ledger,'Business').pending,8)
  assert.throws(()=>addRecord(s,'ledger',{title:'Bad',amount:-1}))
})
test('corrupt storage is rejected rather than trusted', () => {
  assert.deepEqual(parseState('garbage'),emptyState())
  assert.deepEqual(parseState('{"version":1,"tasks":"oops"}'),emptyState())
  assert.deepEqual(parseState(JSON.stringify(emptyState())),emptyState())
})
test('weekly notes are grouped by local Monday', () => {
  assert.equal(weekKey(new Date(2026,9,18)), '2026-10-12')
  assert.equal(weekKey(new Date(2026,9,19)), '2026-10-19')
})
