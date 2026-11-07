import test from 'node:test'
import assert from 'node:assert/strict'
import { findAccount, homeView, managementLinks, adminLinks, roleLine, addAccount, emptyDirectory, setAccountActive, isActiveAccount } from './directory.js'

test('administrator is the owner admin and staff carry the AI agent tag', () => {
  const admin = findAccount('administrator')
  assert.equal(admin.role, 'admin')
  assert.equal(admin.name, 'Shadrick Vidmar')
  assert.equal(homeView(admin), 'gm')
  assert.equal(roleLine(findAccount('boaz')), 'staff · AI agent')
  assert.equal(roleLine(findAccount('barnabas')), 'dept head · VE')
  assert.equal(homeView(findAccount('joseph')), 'department')
  assert.ok(managementLinks(admin).some((link) => link.id === 'gm'))
  assert.equal(managementLinks(findAccount('caleb')).some((link) => link.id === 'gm'), false)
  assert.ok(adminLinks(admin).some((link) => link.id === 'admin-users'))
  assert.equal(adminLinks(findAccount('nehemiah')).length, 0)
})

test('directory edits do not deactivate the administrator', () => {
  let directory = emptyDirectory()
  directory = addAccount(directory, { username: 'board', name: 'Board of Directors', role: 'board' })
  assert.equal(findAccount('board', directory).role, 'board')
  directory = setAccountActive(directory, 'administrator', false)
  assert.equal(isActiveAccount(findAccount('administrator', directory), directory), true)
  directory = setAccountActive(directory, 'board', false)
  assert.equal(isActiveAccount(findAccount('board', directory), directory), false)
  assert.throws(() => addAccount(directory, { username: 'board', name: 'Again', role: 'board' }))
})
