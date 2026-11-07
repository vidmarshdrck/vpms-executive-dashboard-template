import { createClient } from '@supabase/supabase-js'
import { findAccount, isActiveAccount } from './directory.js'

const SESSION_KEY = 'vhpms-session'

export function emailFor(username, env = {}) {
  const key = String(username || '').trim().toLowerCase()
  if (key === 'shadrickvidmar') {
    const email = String(env.VITE_VHPMS_ADMIN_EMAIL || '').trim()
    return email || null
  }
  const map = String(env.VITE_VHPMS_USER_EMAILS || '')
  for (const part of map.split(',')) {
    const [name, email] = part.split(':').map((item) => String(item || '').trim())
    if (name.toLowerCase() === key && email.includes('@')) return email
  }
  return null
}

export function readSession(directory) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const account = findAccount(parsed?.username, directory)
    if (!isActiveAccount(account, directory)) return null
    return parsed.token ? { ...account, token: parsed.token } : account
  } catch {
    return null
  }
}

export function saveSession(user, token) {
  const payload = { username: user.username }
  if (typeof token === 'string' && token) payload.token = token
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* private mode */ }
}

export async function signIn(username, password, options = {}) {
  const env = options.env || import.meta.env
  const fetchImpl = options.fetch || fetch
  const name = String(username || '').trim()
  const pass = String(password ?? '')
  if (!name || !pass) return { ok: false, error: 'Enter both username and password.' }
  const directory = options.directory
  const account = findAccount(name, directory)
  if (!account || !isActiveAccount(account, directory)) return { ok: false, error: 'Incorrect username or password.' }

  const authUrl = String(env.VITE_VHPMS_AUTH_URL || '').trim()
  if (authUrl) {
    let response
    try {
      response = await fetchImpl(authUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: account.username, password: pass }),
      })
    } catch {
      return { ok: false, error: 'Sign-in service is unreachable.' }
    }
    if (response?.status !== 200) return { ok: false, error: 'Incorrect username or password.' }
    let body
    try {
      body = await response.json()
    } catch {
      return { ok: false, error: 'Incorrect username or password.' }
    }
    if (!body || body.ok !== true) return { ok: false, error: 'Incorrect username or password.' }
    const token = typeof body.token === 'string' && body.token ? body.token : null
    return { ok: true, user: account, token }
  }

  const email = emailFor(account.username, env)
  const url = String(env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  if (url && key && email) {
    try {
      const factory = options.createClient || createClient
      const client = factory(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
      const result = await client.auth.signInWithPassword({ email, password: pass })
      const session = result?.data?.session
      const signedIn = result?.data?.user
      if (result?.error || typeof session?.access_token !== 'string' || session.access_token === '' || typeof signedIn?.id !== 'string' || signedIn.id === '') {
        return { ok: false, error: 'Incorrect username or password.' }
      }
      return { ok: true, user: account }
    } catch {
      return { ok: false, error: 'Sign-in service is unreachable.' }
    }
  }

  return { ok: false, error: 'Sign-in is not configured for this account.' }
}
