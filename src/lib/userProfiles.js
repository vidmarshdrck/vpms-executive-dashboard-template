import { useSyncExternalStore } from 'react'
const KEY = 'vpms-user-profiles'
const EVENT = 'vpms:user-profiles-changed'
let cachedRaw, cachedProfiles = {}
function snapshot() {
  let raw
  try { raw = localStorage.getItem(KEY) } catch { raw = null }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try { const parsed = JSON.parse(raw); cachedProfiles = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {} } catch { cachedProfiles = {} }
  }
  return cachedProfiles
}
function subscribe(callback) {
  const onStorage = event => { if (!event.key || event.key === KEY) callback() }
  window.addEventListener(EVENT, callback); window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', onStorage) }
}
export function useUserProfiles() { return useSyncExternalStore(subscribe, snapshot, snapshot) }
export function getUserProfile(id) { return snapshot()[id] || {} }
export function saveUserProfile(user, values) {
  if (!user?.id) throw new Error('Sign in before editing your profile.')
  const displayName = String(values.displayName ?? '').trim()
  const bio = String(values.bio ?? '').trim()
  const joinedOn = String(values.joinedOn ?? '')
  if (!displayName || displayName.length > 60) throw new Error('Enter a display name of 1–60 characters.')
  if (bio.length > 240) throw new Error('Keep your bio within 240 characters.')
  if (joinedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn) || !Number.isFinite(Date.parse(joinedOn)) || new Date(joinedOn).toISOString().slice(0, 10) !== joinedOn || joinedOn > new Date().toISOString().slice(0, 10))) throw new Error('Choose a valid joining date that is not in the future.')
  const profile = { displayName, bio, joinedOn }
  try { localStorage.setItem(KEY, JSON.stringify({ ...snapshot(), [user.id]: profile })) }
  catch { throw new Error('Your profile could not be saved. Free some browser storage and try again.') }
  window.dispatchEvent(new Event(EVENT))
  return profile
}
