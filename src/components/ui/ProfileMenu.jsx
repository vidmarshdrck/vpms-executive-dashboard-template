import { useMemo } from 'react'
import { X, User, Mail, Shield, Clock, LogOut } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { hasPermission } from '../../auth/permissions.js'
import { getActivityForUser } from '../../lib/activityLog.js'

function initials(name = '') {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function ProfileMenu({ open, onClose }) {
  const { user, logout } = useAuth()
  const canEdit = hasPermission(user, 'profile.edit')
  // Re-read on every render while open, so newly recorded activity (e.g. a
  // navigation that happened just before opening this panel) shows up.
  const activity = useMemo(() => (open ? getActivityForUser(user) : []), [open, user])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:w-96 sm:mr-6 sm:mb-6 bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Profile</h3>
          <button aria-label="Close profile" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#FDECEC] text-[#B42318] flex items-center justify-center text-sm font-bold">{initials(user?.name)}</div>
            <div>
              <div className="text-sm font-bold text-slate-900">{user?.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1"><Shield size={12} />{user?.role}</div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><User size={12} />Name</span>
              <input defaultValue={user?.name} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400" />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><Mail size={12} />Email</span>
              <input defaultValue={user?.email} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400" />
            </label>
            <p className="text-[11px] text-slate-400">
              {canEdit
                ? "Changes here don't save yet. There's no user-management API behind this form yet."
                : "Your role doesn't allow editing profile details."}
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5"><Clock size={12} />Recent activity</div>
            {activity.length === 0 ? (
              <p className="text-xs text-slate-400">No activity recorded yet this session.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((entry, index) => (
                  <li key={index} className="text-xs text-slate-600 flex items-start justify-between gap-2 border-b border-slate-50 pb-2 last:border-0">
                    <span>{entry.label}</span>
                    <span className="text-slate-400 whitespace-nowrap">{formatWhen(entry.at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Shows activity from this browser session only. A persisted audit log requires a backend
              activity service, which is not yet implemented.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#B42318] hover:bg-[#FDECEC] transition-colors"
          >
            <LogOut size={15} />Log out
          </button>
        </div>
      </div>
    </div>
  )
}
