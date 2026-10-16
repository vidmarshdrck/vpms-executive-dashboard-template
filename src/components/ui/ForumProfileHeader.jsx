import { useRef, useState } from 'react'
import { Building2, CalendarDays, LogOut, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { DEPARTMENT_ACCOUNTS } from '../../auth/demoAuth.js'
import { useUserProfiles, saveUserProfile } from '../../lib/userProfiles.js'
import { useProfilePhotos, prepareProfilePhoto, saveProfilePhoto } from '../../lib/profilePhotos.js'

export default function ForumProfileHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const profiles = useUserProfiles(), photos = useProfilePhotos()
  const profile = profiles[user.id] || {}
  const displayName = profile.displayName || user.name
  const [editing, setEditing] = useState(false), [form, setForm] = useState({}), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const department = DEPARTMENT_ACCOUNTS.find(item => item.id === user.departmentId)?.name || user.role
  const field = 'mt-1 block w-full rounded-lg border border-white/50 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
  async function changePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true); setError(''); setMessage('')
    try { saveProfilePhoto(user, await prepareProfilePhoto(file)); setMessage('Profile photo saved.') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false); event.target.value = '' }
  }
  function submit(event) {
    event.preventDefault()
    try { saveUserProfile(user, form); setEditing(false); setError(''); setMessage('Profile saved.') }
    catch (cause) { setError(cause.message) }
  }
  return <div className="px-4 pt-4 sm:px-6 sm:pt-5">
    <div className="flex items-start justify-between gap-3">
      <div className="relative shrink-0">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/20 text-2xl font-semibold sm:h-24 sm:w-24">{photos[user.id] ? <img src={photos[user.id]} alt={`${displayName}'s profile`} className="h-full w-full object-cover" /> : displayName.split(' ').map(part => part[0]).join('').slice(0, 2)}</div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Profile photo file" className="hidden" onChange={changePhoto} />
        <button type="button" disabled={busy} onClick={() => fileRef.current.click()} aria-label="Change profile photo" title="Change profile photo" className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1E4DFF] hover:bg-[#EEF2FF] disabled:opacity-50"><Pencil size={17} /></button>
      </div>
      <div className="flex items-center gap-1">
        {!editing && <button type="button" aria-label="Edit profile" title="Edit profile" onClick={() => { setForm({ displayName, bio: profile.bio || '', joinedOn: profile.joinedOn || '' }); setEditing(true); setMessage(''); setError('') }} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"><Pencil size={18} /></button>}
        <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }) }} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-white/15"><LogOut size={17} />Log out</button>
      </div>
    </div>
    {editing ? <form onSubmit={submit} className="mt-5 space-y-3 pb-3">
      <label className="block text-sm font-medium">Display name<input autoFocus required maxLength={60} value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} className={field} /></label>
      <label className="block text-sm font-medium">Bio<textarea rows={2} maxLength={240} value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} className={field} /></label>
      <label className="block text-sm font-medium">Joined Vidmar<input type="date" max={new Date().toISOString().slice(0, 10)} value={form.joinedOn} onChange={event => setForm({ ...form, joinedOn: event.target.value })} className={field} /></label>
      <p className="text-xs text-white/90">Your display name appears on named posts. Your login username stays @{user.username}.</p>
      <div className="flex gap-2"><button type="submit" className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-[#1E4DFF]">Save profile</button><button type="button" onClick={() => { setEditing(false); setError('') }} className="min-h-11 rounded-full px-4 text-sm hover:bg-white/15">Cancel</button></div>
    </form> : <div className="mt-4 pb-3">
      <h2 className="break-words text-2xl font-semibold text-white">{displayName}</h2>
      <p className="mt-1 break-words text-sm text-white/85">{user.name} <span aria-hidden="true">·</span> @{user.username}</p>
      {profile.bio ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white">{profile.bio}</p> : <p className="mt-3 text-sm text-white/85">Add a bio to introduce yourself to colleagues.</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/90"><span className="inline-flex items-center gap-1.5"><Building2 size={14} />{department}</span><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{profile.joinedOn ? `Joined ${new Date(`${profile.joinedOn}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : 'Joining date not added'}</span></div>
    </div>}
    <p role={error ? 'alert' : 'status'} className="pb-1 text-sm text-white">{error || message}</p>
  </div>
}
