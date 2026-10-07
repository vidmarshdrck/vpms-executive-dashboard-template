// Demo accounts for the VPMS PMS (see "Who's who" and "The 9 departments" in
// the PMS plain-English guide). Every seeded account shares the default
// password below and should change it on first login.
//
// Client-side only — there is no backend yet, so these credentials ship in
// the bundle. Re-implement against a real identity provider before this is
// treated as a security boundary.

export const DEFAULT_PASSWORD = 'ChangeMe123!'

// Code is the department's short code from the guide; `id` matches the
// department ids in src/data/scorecardData.js.
export const DEPARTMENT_ACCOUNTS = [
  { id: 'productMonitoring', code: 'pm', name: 'Product Monitoring' },
  { id: 'security', code: 'security', name: 'Security' },
  { id: 'safety', code: 'safety', name: 'Safety' },
  { id: 'hr', code: 'hr', name: 'Human Resource' },
  { id: 'procurement', code: 'procurement', name: 'Procurement' },
  { id: 'ict', code: 'ict', name: 'ICT' },
  { id: 'operations', code: 'operations', name: 'Operations' },
  { id: 'finance', code: 'finance', name: 'Finance' },
  { id: 'engineering', code: 'engineering', name: 'Engineering' },
]

const ORG_USERS = [
  { id: 'admin', username: 'admin', name: 'ICT / System owner', email: 'admin@vpms.demo', role: 'Admin' },
  { id: 'gm', username: 'gm', name: 'General Manager', email: 'gm@vpms.demo', role: 'GM' },
  { id: 'board', username: 'board', name: 'Board of Directors', email: 'board@vpms.demo', role: 'Board' },
]

const DEPARTMENT_USERS = DEPARTMENT_ACCOUNTS.flatMap((dept) => [
  { id: `${dept.code}_head`, username: `${dept.code}_head`, name: `${dept.name} · Head`, email: `${dept.code}_head@vpms.demo`, role: 'Dept Head', departmentId: dept.id },
  { id: `${dept.code}_staff`, username: `${dept.code}_staff`, name: `${dept.name} · Staff`, email: `${dept.code}_staff@vpms.demo`, role: 'Staff', departmentId: dept.id },
])

export const DEMO_USERS = [...ORG_USERS, ...DEPARTMENT_USERS].map((user) => ({ password: DEFAULT_PASSWORD, ...user }))

function toSafeUser({ id, username, name, email, role, departmentId }) {
  return departmentId ? { id, username, name, email, role, departmentId } : { id, username, name, email, role }
}

// `login` may be a username (e.g. "ict_head") or an email address.
export function authenticateDemoUser(login, password) {
  const key = login.trim().toLowerCase()
  const user = DEMO_USERS.find((candidate) => (candidate.username === key || candidate.email === key) && candidate.password === password)
  return user ? toSafeUser(user) : null
}

export function getDemoUserById(id) {
  const user = DEMO_USERS.find((candidate) => candidate.id === id)
  return user ? toSafeUser(user) : null
}
