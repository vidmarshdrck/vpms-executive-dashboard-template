import test from 'node:test'
import assert from 'node:assert/strict'
import { SIDEBAR_KEY, readSidebarRetracted, writeSidebarRetracted } from './sidebar.js'

test('sidebar retraction persists across reads', () => {
  const saved = new Map()
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
  assert.equal(readSidebarRetracted(storage), false)
  writeSidebarRetracted(storage, true)
  assert.equal(saved.get(SIDEBAR_KEY), 'retracted')
  assert.equal(readSidebarRetracted(storage), true)
  writeSidebarRetracted(storage, false)
  assert.equal(readSidebarRetracted(storage), false)
  assert.equal(readSidebarRetracted({ getItem() { throw new Error('blocked') } }), false)
  writeSidebarRetracted({ setItem() { throw new Error('blocked') } }, true)
})
