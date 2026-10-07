// Role-aware recent-activity log.
//
// There is no backend audit service yet, so this cannot show real
// historical activity (previous logins, past admin actions, etc.) — that
// requires a persisted, server-side log. Faking that history would violate
// the brief's "do not invent activity records" requirement.
//
// What this DOES do honestly: record real events as they happen in the
// current browser session (login, page views, and — for admin/data-manager
// roles — KPI/system actions they actually take) and keep them in
// sessionStorage so they survive a refresh within the same session. This is
// the real architecture's client-side half; the missing half is a backend
// audit endpoint this should POST to instead of (or in addition to)
// sessionStorage.

const LOG_KEY = 'vpms-session-activity'
const MAX_ENTRIES = 25

// Which event categories each role is permitted to see, mirroring the
// brief's example split (admins see system/user/data admin events;
// management viewers see their own viewing activity only).
const ROLE_VISIBLE_CATEGORIES = {
  Admin: ['auth', 'navigation', 'kpi-admin', 'system'],
  GM: ['auth', 'navigation', 'kpi-admin'],
  Board: ['auth', 'navigation'],
  'Dept Head': ['auth', 'navigation'],
  Staff: ['auth', 'navigation'],
}

function readLog() {
  try {
    const raw = sessionStorage.getItem(LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLog(entries) {
  try {
    sessionStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // sessionStorage unavailable (private mode, etc.) — activity simply won't persist across refresh
  }
}

export function recordActivity({ category, label }) {
  const entries = readLog()
  entries.push({ category, label, at: new Date().toISOString() })
  writeLog(entries)
}

export function getActivityForUser(user) {
  if (!user?.role) return []
  const visible = ROLE_VISIBLE_CATEGORIES[user.role] || ['navigation']
  return readLog()
    .filter((entry) => visible.includes(entry.category))
    .slice()
    .reverse()
}

export function clearActivityLog() {
  try {
    sessionStorage.removeItem(LOG_KEY)
  } catch {
    // ignore
  }
}
