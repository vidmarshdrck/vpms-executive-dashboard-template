import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Mail, Shield, Clock, LogOut, Pencil } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { hasPermission } from '../../auth/permissions.js'
import { useProfilePhotos, prepareProfilePhoto, saveProfilePhoto } from '../../lib/profilePhotos.js'
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
  const photos = useProfilePhotos()
  const fileRef = useRef(null)
  const dialogRef = useRef(null)
  const [photoMessage, setPhotoMessage] = useState('')
  const [savingPhoto, setSavingPhoto] = useState(false)
  const canEdit = hasPermission(user, 'profile.edit')
  // Re-read on every render while open, so newly recorded activity (e.g. a
  // navigation that happened just before opening this panel) shows up.
  const activity = useMemo(() => (open ? getActivityForUser(user) : []), [open, user])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    dialogRef.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type="file"]), [tabindex="0"]')]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); previous?.focus() }
  }, [open, onClose])

  async function uploadPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setSavingPhoto(true)
    try { saveProfilePhoto(user, await prepareProfilePhoto(file)); setPhotoMessage('Profile photo updated.') }
    catch (error) { setPhotoMessage(error.message) }
    finally { setSavingPhoto(false); event.target.value = '' }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-title" tabIndex={-1} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[85dvh] overflow-y-auto focus:outline-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 id="profile-title" className="text-sm font-bold text-slate-900">Profile</h3>
          <button aria-label="Close profile" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-16 h-16 overflow-hidden rounded-full bg-[#EEF2FF] text-[#1E4DFF] flex items-center justify-center text-base font-bold">
                {photos[user.id] ? <img src={photos[user.id]} alt={`${user.name}'s profile`} className="h-full w-full object-cover" /> : initials(user?.name)}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Profile photo file" className="hidden" onChange={uploadPhoto} />
              <button type="button" aria-label="Upload profile photo" title="Change profile photo" disabled={savingPhoto} onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#1E4DFF] text-white shadow-md hover:bg-[#1638CC] disabled:opacity-50"><Pencil size={15} /></button>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{user?.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1"><Shield size={12} />{user?.role}</div>
            </div>
          </div>

          {photoMessage && <p role="status" className="text-sm text-slate-700">{photoMessage}</p>}

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
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#1E4DFF] hover:bg-[#EEF2FF] transition-colors"
          >
            <LogOut size={15} />Log out
          </button>
        </div>
      </div>
    </div>, document.body
  )
}
