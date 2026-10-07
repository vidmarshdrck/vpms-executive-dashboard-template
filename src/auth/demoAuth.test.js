import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_USERS, DEFAULT_PASSWORD, authenticateDemoUser, getDemoUserById } from './demoAuth.js'
import { hasPermission, homePath } from './permissions.js'

test('seeds the five roles: admin, gm, board, and a head and staff account per department', () => {
  const roles = DEMO_USERS.map((user) => user.role)
  for (const role of ['Admin', 'GM', 'Board']) assert.ok(roles.includes(role))
  assert.equal(roles.filter((r) => r === 'Dept Head').length, 9)
  assert.equal(roles.filter((r) => r === 'Staff').length, 9)
})

test('uses the usernames from the PMS guide', () => {
  for (const username of ['pm_head', 'pm_staff', 'security_head', 'safety_staff', 'hr_head', 'procurement_staff', 'ict_head', 'operations_staff', 'finance_head', 'engineering_staff']) {
    assert.ok(authenticateDemoUser(username, DEFAULT_PASSWORD), username)
  }
})

test('authenticates without exposing the password, by username or email', () => {
  const user = authenticateDemoUser('ICT_Head', DEFAULT_PASSWORD)
  assert.equal(user.role, 'Dept Head')
  assert.equal(user.departmentId, 'ict')
  assert.equal(user.password, undefined)
  assert.ok(authenticateDemoUser('gm@vpms.demo', DEFAULT_PASSWORD))
})

test('rejects invalid credentials', () => {
  assert.equal(authenticateDemoUser('ict_head', 'wrong'), null)
  assert.equal(authenticateDemoUser('nobody', DEFAULT_PASSWORD), null)
})

test('restores a safe user by id', () => {
  assert.deepEqual(getDemoUserById('gm'), { id: 'gm', username: 'gm', name: 'General Manager', email: 'gm@vpms.demo', role: 'GM' })
})

test('permissions follow the guide', () => {
  const as = (username) => authenticateDemoUser(username, DEFAULT_PASSWORD)
  assert.ok(hasPermission(as('admin'), 'system.configure'))
  assert.ok(!hasPermission(as('gm'), 'system.configure'))
  assert.ok(hasPermission(as('gm'), 'kpi.import'))
  assert.ok(!hasPermission(as('board'), 'kpi.import'))
  assert.ok(!hasPermission(as('board'), 'kpi.enter'))
  assert.ok(!hasPermission(as('admin'), 'kpi.enter'))
  assert.ok(hasPermission(as('ict_staff'), 'kpi.enter'))
  assert.ok(!hasPermission(as('ict_staff'), 'dashboard.org'))
  assert.equal(homePath(as('ict_head')), '/my-department')
  assert.equal(homePath(as('board')), '/executive')
})
