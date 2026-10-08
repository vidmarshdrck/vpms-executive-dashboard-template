// Role/permission architecture for the VPMS dashboard.
//
// Five roles (PMS guide, "Who's who"):
//   Admin      - everything, administers the system, does not enter scores
//   GM         - executive dashboard + every department, can load a scorecard
//   Board      - same view as the GM, strictly read-only
//   Dept Head  - own department only, enters its numbers
//   Staff      - own department only, enters its numbers
//
// Routes are guarded by `hasPermission` (App.jsx `RequirePermission`), not
// just hidden nav buttons. It runs client-side against the session user from
// demoAuth.js — there is no backend yet to issue a signed role claim, so this
// must be re-implemented against server-issued roles before it is treated as
// a security boundary.

export const ROLES = {
  ADMIN: 'Admin',
  GM: 'GM',
  BOARD: 'Board',
  DEPT_HEAD: 'Dept Head',
  STAFF: 'Staff',
}

const ORG_WIDE = [ROLES.ADMIN, ROLES.GM, ROLES.BOARD]
const DEPARTMENT_ONLY = [ROLES.DEPT_HEAD, ROLES.STAFF]

// Permission -> roles allowed to hold it.
const PERMISSION_ROLES = {
  'users.manage': [ROLES.ADMIN],
  'roles.manage': [ROLES.ADMIN],
  'system.configure': [ROLES.ADMIN],
  'integrations.configure': [ROLES.ADMIN],
  'audit.view': [ROLES.ADMIN],
  'kpi.administer': [ROLES.ADMIN],
  'kpi.import': [ROLES.ADMIN, ROLES.GM],
  'kpi.enter': DEPARTMENT_ONLY,
  'kpi.submit': DEPARTMENT_ONLY,
  'kpi.approve': [ROLES.GM],
  'dashboard.org': ORG_WIDE,
  'dashboard.department': DEPARTMENT_ONLY,
  'dashboard.view': [...ORG_WIDE, ...DEPARTMENT_ONLY],
  'profile.edit': [...ORG_WIDE, ...DEPARTMENT_ONLY],
}

// An unknown `permission` string fails closed.
export function hasPermission(user, permission) {
  if (!user?.role) return false
  const allowed = PERMISSION_ROLES[permission]
  if (!allowed) return false
  return allowed.includes(user.role)
}

export function isAdministrator(user) {
  return user?.role === ROLES.ADMIN
}

// Where a signed-in user lands.
export function homePath(user) {
  return hasPermission(user, 'dashboard.department') ? '/my-department' : '/executive'
}
