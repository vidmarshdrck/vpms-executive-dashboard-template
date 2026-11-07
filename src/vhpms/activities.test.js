import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyActivities, addActivity, addInitiative, initiativeProgress, addForceItem, setActivityStatus } from './activities.js'

test('the activities board starts empty and progress follows linked work', () => {
  let state = emptyActivities()
  assert.deepEqual(state.tasks, [])
  state = addInitiative(state, { title: 'Depot lighting' })
  const initiative = state.initiatives[0]
  assert.equal(initiativeProgress(state, initiative.id).pct, null)
  state = addActivity(state, { title: 'Survey fittings', initiativeId: initiative.id, status: 'Done' })
  state = addActivity(state, { title: 'Order fittings', initiativeId: initiative.id, status: 'To do' })
  assert.deepEqual(initiativeProgress(state, initiative.id), { done: 1, total: 2, pct: 50 })
  state = setActivityStatus(state, state.tasks[0].id, 'Done')
  assert.equal(initiativeProgress(state, initiative.id).pct, 100)
  state = addForceItem(state, { title: 'Night shift cover', members: 'Boaz, Caleb' })
  assert.equal(state.force[0].members, 'Boaz, Caleb')
  assert.throws(() => addForceItem(state, { title: 'Unstaffed', members: ' ' }))
})
