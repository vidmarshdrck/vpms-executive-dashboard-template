export const ACCOUNTS = [
  { username: 'shadrickvidmar', name: 'Shadrick Vidmar', role: 'admin' },
  { username: 'nehemiah', name: 'Nehemiah', role: 'gm' },
  { username: 'barnabas', name: 'Barnabas', role: 'dept_head', dept: 'engineering', unit: 'VE' },
  { username: 'joseph', name: 'Joseph', role: 'dept_head', dept: 'ict', unit: 'VAI' },
  { username: 'joshua', name: 'Joshua', role: 'dept_head', dept: 'operations', unit: 'REZ' },
  { username: 'boaz', name: 'Boaz', role: 'staff', dept: 'finance', agent: true },
  { username: 'nathan', name: 'Nathan', role: 'staff', dept: 'hr', agent: true },
  { username: 'daniel', name: 'Daniel', role: 'staff', dept: 'procurement', agent: true },
  { username: 'caleb', name: 'Caleb', role: 'staff', dept: 'safety', agent: true },
]

export const ROLES = ['admin', 'gm', 'board', 'dept_head', 'staff']

export function emptyDirectory() {
  return { version: 1, extra: [], inactive: [] }
}

export function accountList(directory = emptyDirectory()) {
  return [...ACCOUNTS, ...(directory.extra || [])]
}

export function findAccount(username, directory = emptyDirectory()) {
  const key = String(username || '').trim().toLowerCase()
  return accountList(directory).find((account) => account.username === key) || null
}

export function isActiveAccount(account, directory = emptyDirectory()) {
  if (!account) return false
  if (account.username === 'shadrickvidmar') return true
  return !(directory.inactive || []).includes(account.username)
}

export function homeView(user) {
  if (!user) return 'login'
  if ((user.role === 'dept_head' || user.role === 'staff') && user.dept) return 'department'
  return 'gm'
}

export function managementLinks(user) {
  const role = user?.role
  const links = []
  if (['gm', 'admin', 'board'].includes(role)) links.push({ id: 'gm', label: 'GM Dashboard', icon: 'dashboard' })
  if (['dept_head', 'staff'].includes(role) && user.dept) links.push({ id: 'department', label: 'My Department', icon: 'building' })
  if (['admin', 'gm', 'board'].includes(role)) links.push({ id: 'departments', label: 'Departments', icon: 'building' })
  if (['gm', 'admin'].includes(role)) links.push({ id: 'upload', label: 'Upload Scorecard', icon: 'upload' })
  if (['dept_head', 'staff'].includes(role) && user.dept) links.push({ id: 'kpi-entry', label: 'Enter KPI Data', icon: 'clipboard' })
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
  if (user?.role !== 'admin') return []
  return [
    { id: 'admin-departments', label: 'Departments', icon: 'shield' },
    { id: 'admin-kpis', label: 'KPIs', icon: 'target' },
    { id: 'admin-users', label: 'Users', icon: 'users' },
    { id: 'admin-businesses', label: 'Businesses', icon: 'building' },
  ]
}

export function roleLine(user) {
  const role = String(user?.role || '').replaceAll('_', ' ')
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
  if (!username || !name || !ROLES.includes(account.role)) throw new Error('Username, full name and a valid role are required.')
  if (findAccount(username, directory)) throw new Error('That username is already taken.')
  const next = { username, name, role: account.role, dept: account.dept || null, unit: account.unit || null, agent: Boolean(account.agent) }
  return { ...directory, extra: [...directory.extra, next] }
}

export function setAccountActive(directory, username, active) {
  if (username === 'shadrickvidmar') return directory
  const inactive = directory.inactive.filter((item) => item !== username)
  if (!active) inactive.push(username)
  return { ...directory, inactive }
}
