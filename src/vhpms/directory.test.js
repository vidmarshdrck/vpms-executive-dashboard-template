import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  OWNER_USERNAME,
  findAccount,
  homeView,
  managementLinks,
  adminLinks,
  grantedSections,
  roleLine,
  roleLabel,
  addAccount,
  emptyDirectory,
  setAccountActive,
  isActiveAccount,
  canSee,
  entryDepartment,
  isViewOnly,
} from './directory.js'

test('shadrickvidmar is the owner with Administrator, General Manager, and HRD', () => {
  const owner = findAccount('shadrickvidmar')
  assert.equal(owner.username, OWNER_USERNAME)
  assert.equal(owner.name, 'Shadrick Vidmar')
  assert.deepEqual(owner.roles, ['admin', 'gm', 'hrd'])
  assert.deepEqual(owner.roles.map(roleLabel), ['Administrator', 'General Manager', 'HRD'])
  assert.equal(roleLine(owner), 'Administrator, General Manager, HRD')
  assert.equal(homeView(owner), 'gm')
  assert.equal(owner.dept, 'hr')
  assert.equal(roleLine(findAccount('boaz')), 'Staff · AI agent')
  assert.equal(roleLine(findAccount('barnabas')), 'Department head · VE')
  assert.equal(homeView(findAccount('joseph')), 'department')
  assert.ok(managementLinks(owner).some((link) => link.id === 'gm'))
  assert.equal(managementLinks(findAccount('caleb')).some((link) => link.id === 'gm'), false)
  assert.ok(adminLinks(owner).some((link) => link.id === 'admin-users'))
  assert.equal(canSee(owner, 'inbox'), true)
  assert.equal(canSee(owner, 'sms'), true)
  assert.equal(canSee(null, 'sms'), false)
  assert.equal(adminLinks(findAccount('nehemiah')).length, 0)
})

test('merged roles show every section each role grants, and the switcher narrows them', () => {
  const owner = findAccount('shadrickvidmar')
  const merged = new Set(grantedSections(owner))
  for (const role of owner.roles) {
    for (const id of grantedSections({ ...owner, currentRole: role })) {
      assert.equal(merged.has(id), true, `${role} grants ${id}`)
    }
  }
  assert.ok(merged.has('gm'))
  assert.ok(merged.has('upload'))
  assert.ok(merged.has('hr'))
  assert.ok(merged.has('kpi-entry'))
  assert.ok(merged.has('admin-users'))
  assert.ok(merged.has('admin-businesses'))

  const asAdmin = grantedSections({ ...owner, currentRole: 'admin' })
  assert.ok(asAdmin.includes('gm'))
  assert.ok(asAdmin.includes('admin-businesses'))
  assert.equal(asAdmin.includes('hr'), false)
  assert.equal(asAdmin.includes('kpi-entry'), false)

  const asGm = grantedSections({ ...owner, currentRole: 'gm' })
  assert.ok(asGm.includes('gm'))
  assert.ok(asGm.includes('upload'))
  assert.equal(asGm.includes('admin-users'), false)
  assert.equal(asGm.includes('hr'), false)

  const asHrd = grantedSections({ ...owner, currentRole: 'hrd' })
  assert.deepEqual(asHrd, ['hr', 'kpi-entry', 'admin-users'])
  assert.equal(canSee({ ...owner, currentRole: 'hrd' }, 'hr'), true)
  assert.equal(canSee({ ...owner, currentRole: 'hrd' }, 'gm'), false)
  assert.equal(canSee({ ...owner, currentRole: 'hrd' }, 'admin-businesses'), false)
  assert.equal(homeView({ ...owner, currentRole: 'hrd' }), 'hr')
  assert.equal(entryDepartment({ ...owner, currentRole: 'hrd' }), 'hr')
  assert.equal(roleLine({ ...owner, currentRole: 'hrd' }), 'HRD')

  const unknownRole = grantedSections({ ...owner, currentRole: 'staff' })
  assert.ok(unknownRole.includes('gm'))
  assert.ok(unknownRole.includes('hr'))
})

test('HRD alone opens Human Resources and the user directory', () => {
  const hrd = { username: 'hr.director', name: 'Human Resources Director', roles: ['hrd'] }
  assert.deepEqual(grantedSections(hrd), ['hr', 'kpi-entry', 'admin-users'])
  assert.equal(homeView(hrd), 'hr')
  assert.equal(entryDepartment(hrd), 'hr')
  assert.equal(canSee(hrd, 'admin-kpis'), false)
  assert.equal(canSee(hrd, 'upload'), false)
  assert.equal(canSee(hrd, 'departments'), false)
  assert.equal(isViewOnly(hrd), false)
  assert.equal(isViewOnly({ username: 'board', roles: ['board'], currentRole: 'board' }), true)
  assert.equal(isViewOnly(findAccount('shadrickvidmar')), false)
})

test('directory edits do not deactivate the owner and accept several roles', () => {
  let directory = emptyDirectory()
  directory = addAccount(directory, { username: 'board', name: 'Board of Directors', role: 'board' })
  assert.deepEqual(findAccount('board', directory).roles, ['board'])
  directory = addAccount(directory, { username: 'amara', name: 'Amara', roles: ['gm', 'hrd'] })
  assert.deepEqual(findAccount('amara', directory).roles, ['gm', 'hrd'])
  assert.equal(findAccount('amara', directory).dept, 'hr')
  directory = setAccountActive(directory, 'shadrickvidmar', false)
  assert.equal(isActiveAccount(findAccount('shadrickvidmar', directory), directory), true)
  directory = setAccountActive(directory, 'board', false)
  assert.equal(isActiveAccount(findAccount('board', directory), directory), false)
  assert.throws(() => addAccount(directory, { username: 'board', name: 'Again', role: 'board' }))
  assert.throws(() => addAccount(directory, { username: 'no-role', name: 'No Role', roles: [] }))
  assert.throws(() => addAccount(directory, { username: 'bad-role', name: 'Bad Role', roles: ['hrd', 'owner'] }))
})

test('footer credits VIDMΛR in Vidmar blue and does not say Vidmar Holdings', () => {
  const shell = readFileSync(new URL('./Shell.jsx', import.meta.url), 'utf8')
  const donut = readFileSync(new URL('./Donut.jsx', import.meta.url), 'utf8')
  const theme = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
  assert.match(theme, /--brand:\s*#1454c0/)
  assert.match(theme, /\.vidmar-word/)
  assert.match(donut, /Powered by/)
  assert.match(donut, /VIDM\\u039BR/)
  assert.match(shell, /VidmarCredit/)
  const loginFoot = shell.slice(shell.indexOf('login-foot'), shell.indexOf('login-foot') + 80)
  const pageFoot = donut.slice(donut.indexOf('<footer'), donut.indexOf('</footer>') + 9)
  assert.equal(loginFoot.includes('Vidmar Holdings'), false)
  assert.equal(pageFoot.includes('Vidmar Holdings'), false)
  for (const source of [shell, donut]) {
    assert.equal(/\b(draft|demo|sample|placeholder|proposed)\b/i.test(source), false)
  }
})
