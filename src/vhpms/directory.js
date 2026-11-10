export const OWNER_USERNAME = 'shadrickvidmar'

export const ROLE_LABELS = {
  admin: 'Administrator',
  gm: 'General Manager',
  hrd: 'HRD',
  board: 'Board',
  dept_head: 'Department head',
  staff: 'Staff',
}

export const ROLES = Object.keys(ROLE_LABELS)

export const ACCOUNTS = [
  { username: OWNER_USERNAME, name: 'Shadrick Vidmar', roles: ['admin', 'gm', 'hrd'], dept: 'hr' },
  { username: 'nehemiah', name: 'Nehemiah', role: 'gm' },
  { username: 'barnabas', name: 'Barnabas', role: 'dept_head', dept: 'engineering', unit: 'VE' },
  { username: 'joseph', name: 'Joseph', role: 'dept_head', dept: 'ict', unit: 'VAI' },
  { username: 'joshua', name: 'Joshua', role: 'dept_head', dept: 'operations', unit: 'REZ' },
  { username: 'boaz', name: 'Boaz', role: 'staff', dept: 'finance', agent: true },
  { username: 'nathan', name: 'Nathan', role: 'staff', dept: 'hr', agent: true },
  { username: 'daniel', name: 'Daniel', role: 'staff', dept: 'procurement', agent: true },
  { username: 'caleb', name: 'Caleb', role: 'staff', dept: 'safety', agent: true },
]

export function roleLabel(role) {
  return ROLE_LABELS[role] || String(role || '').replaceAll('_', ' ')
}

export function accountRoles(account) {
  return normalizeAccount(account)?.roles || []
}

export function withCurrentRole(account, currentRole) {
  const normalized = normalizeAccount(account)
  if (!normalized) return null
  const active = normalized.roles.includes(currentRole) ? currentRole : null
  return { ...normalized, currentRole: active }
}

export function effectiveRoles(user) {
  const roles = accountRoles(user)
  if (user?.currentRole && roles.includes(user.currentRole)) return [user.currentRole]
  return roles
}

export function hasRole(user, role) {
  return effectiveRoles(user).includes(role)
}

export function emptyDirectory() {
  return { version: 1, extra: [], inactive: [] }
}

export function accountList(directory = emptyDirectory()) {
  return [...ACCOUNTS, ...(directory.extra || [])].map((account) => normalizeAccount(account))
}

export function findAccount(username, directory = emptyDirectory()) {
  const key = String(username || '').trim().toLowerCase()
  return accountList(directory).find((account) => account.username === key) || null
}

export function isActiveAccount(account, directory = emptyDirectory()) {
  if (!account) return false
  if (account.username === OWNER_USERNAME) return true
  return !(directory.inactive || []).includes(account.username)
}

export function canDisable(username) {
  return username !== OWNER_USERNAME
}

export function homeView(user) {
  if (!user) return 'login'
  const roles = effectiveRoles(user)
  if (roles.some((role) => ['admin', 'gm', 'board'].includes(role))) return 'gm'
  if (roles.includes('hrd')) return 'hr'
  if (roles.some((role) => role === 'dept_head' || role === 'staff') && user.dept) return 'department'
  return 'gm'
}

export function managementLinks(user) {
  const roles = effectiveRoles(user)
  const links = []
  if (roles.some((role) => ['gm', 'admin', 'board'].includes(role))) links.push({ id: 'gm', label: 'GM Dashboard', icon: 'dashboard' })
  if (roles.includes('hrd')) links.push({ id: 'hr', label: 'Human Resources', icon: 'users' })
  if (roles.some((role) => role === 'dept_head' || role === 'staff') && user.dept) links.push({ id: 'department', label: 'My Department', icon: 'building' })
  if (roles.some((role) => ['admin', 'gm', 'board'].includes(role))) links.push({ id: 'departments', label: 'Departments', icon: 'building' })
  if (roles.some((role) => ['gm', 'admin'].includes(role))) links.push({ id: 'upload', label: 'Upload Scorecard', icon: 'upload' })
  if (roles.includes('hrd') || (roles.some((role) => role === 'dept_head' || role === 'staff') && user.dept)) {
    links.push({ id: 'kpi-entry', label: 'Enter KPI Data', icon: 'clipboard' })
  }
  return links
}

export const WORKSPACE_LINKS = [
  { id: 'operations', label: 'Operations', icon: 'activity' },
  { id: 'tasks', label: 'Tasks', icon: 'clipboard' },
  { id: 'projects', label: 'Projects', icon: 'target' },
  { id: 'priorities', label: 'Weekly priorities', icon: 'clipboard' },
  { id: 'calendar', label: 'Calendar', icon: 'dashboard' },
  { id: 'receipts', label: 'Receipts', icon: 'building' },
  { id: 'sources', label: 'Source records', icon: 'shield' },
]

export function adminLinks(user) {
  const roles = effectiveRoles(user)
  if (roles.includes('admin')) {
    return [
      { id: 'admin-departments', label: 'Departments', icon: 'shield' },
      { id: 'admin-kpis', label: 'KPIs', icon: 'target' },
      { id: 'admin-users', label: 'Users', icon: 'users' },
      { id: 'admin-businesses', label: 'Businesses', icon: 'building' },
    ]
  }
  if (roles.includes('hrd')) return [{ id: 'admin-users', label: 'Users', icon: 'users' }]
  return []
}

export function grantedSections(user) {
  return [...managementLinks(user), ...adminLinks(user)].map((link) => link.id)
}

export function canSee(user, view) {
  if (!user || view === 'login') return false
  if (view === 'business' || view === 'business-list' || view === 'activities' || view === 'inbox' || view === 'sms' || view === 'profile') return true
  if (view === 'department') return managementLinks(user).some((link) => link.id === 'department' || link.id === 'departments' || link.id === 'hr')
  return [...managementLinks(user), ...adminLinks(user), ...WORKSPACE_LINKS].some((link) => link.id === view)
}

export function scopedDepartment(user) {
  const roles = effectiveRoles(user)
  if (roles.some((role) => ['admin', 'gm', 'board'].includes(role))) return null
  if (roles.includes('hrd')) return 'hr'
  if ((roles.includes('dept_head') || roles.includes('staff')) && user?.dept) return user.dept
  return null
}

export function entryDepartment(user) {
  return scopedDepartment(user) || (effectiveRoles(user).includes('hrd') ? 'hr' : user?.dept || null)
}

export function isViewOnly(user) {
  const roles = effectiveRoles(user)
  return roles.length > 0 && roles.every((role) => role === 'board')
}

export function roleLine(user) {
  const role = effectiveRoles(user).map(roleLabel).join(', ')
  const extra = [user?.unit, user?.agent ? 'AI agent' : null].filter(Boolean)
  return extra.length ? `${role} · ${extra.join(' · ')}` : role
}

export function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
}

export function parseDirectory(raw) {
  try {
    const directory = JSON.parse(raw)
    if (directory?.version !== 1 || !Array.isArray(directory.extra) || !Array.isArray(directory.inactive)) return emptyDirectory()
    return directory
  } catch {
    return emptyDirectory()
  }
}

export function addAccount(directory, account) {
  const username = String(account.username || '').trim().toLowerCase()
  const name = String(account.name || '').trim()
  const roles = collectRoles(account.roles || account.role)
  if (!username || !name || !roles.length) throw new Error('Username, full name and a valid role are required.')
  if (findAccount(username, directory)) throw new Error('That username is already taken.')
  const requestedDept = account.dept || null
  const dept = requestedDept || (roles.includes('hrd') ? 'hr' : null)
  const next = { username, name, roles, role: roles[0], dept, unit: account.unit || null, agent: Boolean(account.agent) }
  return { ...directory, extra: [...directory.extra, next] }
}

export function setAccountActive(directory, username, active) {
  if (username === OWNER_USERNAME) return directory
  const inactive = directory.inactive.filter((item) => item !== username)
  if (!active) inactive.push(username)
  return { ...directory, inactive }
}

function collectRoles(input) {
  const list = (Array.isArray(input) ? input : [input]).map((item) => String(item || '').trim()).filter(Boolean)
  if (!list.length || list.some((role) => !ROLES.includes(role))) return []
  return [...new Set(list)]
}

function normalizeAccount(account) {
  if (!account) return null
  const source = Array.isArray(account.roles) && account.roles.length ? account.roles : [account.role]
  const roles = []
  for (const item of source) {
    const role = String(item || '').trim()
    if (ROLES.includes(role) && !roles.includes(role)) roles.push(role)
  }
  return { ...account, roles, role: roles[0] || null }
}
