import { useSyncExternalStore } from 'react'

const KEY = 'vpms-profile-photos'
const EVENT = 'vpms:profile-photos-changed'
let cachedRaw
let cachedPhotos = {}
function snapshot() {
  let raw
  try { raw = localStorage.getItem(KEY) } catch { raw = null }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try { cachedPhotos = JSON.parse(raw) || {} } catch { cachedPhotos = {} }
  }
  return cachedPhotos
}
function subscribe(callback) {
  const onStorage = (event) => { if (!event.key || event.key === KEY) callback() }
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', onStorage) }
}
export function useProfilePhotos() { return useSyncExternalStore(subscribe, snapshot, snapshot) }
export function saveProfilePhoto(user, dataUrl) {
  if (!user?.id) throw new Error('Sign in before changing your photo.')
  if (!/^data:image\/jpeg;base64,/.test(dataUrl)) throw new Error('Choose a valid profile photo.')
  try { localStorage.setItem(KEY, JSON.stringify({ ...snapshot(), [user.id]: dataUrl })) }
  catch { throw new Error('Your photo could not be saved. Free some browser storage and try again.') }
  window.dispatchEvent(new Event(EVENT))
}
export async function prepareProfilePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const side = Math.min(image.width, image.height)
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, 256, 256)
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch { throw new Error('This photo could not be opened. Try another image.') }
  finally { URL.revokeObjectURL(url) }
}
