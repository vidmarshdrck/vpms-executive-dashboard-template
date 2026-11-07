import { createClient } from '@supabase/supabase-js'
import { normalizeTransaction } from './sms.js'

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function smsWatchKey(user) {
  if (!user?.username) return ''
  return `${user.username}:${typeof user.token === 'string' ? user.token : ''}`
}

function supabaseOptions(token) {
  const options = { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
  if (typeof token === 'string' && token) options.global = { headers: { Authorization: `Bearer ${token}` } }
  return options
}

async function sessionAccess(client, token) {
  if (typeof token === 'string' && token) return token
  const sessionResult = await client.auth.getSession()
  const access = sessionResult?.data?.session?.access_token
  return typeof access === 'string' && access ? access : ''
}

export async function fetchSms({ env = {}, token = '', createClient: factory = createClient, fetch: fetchImpl = fetch } = {}) {
  const endpoint = String(env.VITE_VHPMS_SMS_URL || '').trim()
  if (endpoint) {
    if (!token) return { ok: true, rows: [] }
    let response
    try {
      response = await fetchImpl(endpoint, { headers: { Authorization: `Bearer ${token}` } })
    } catch {
      return { ok: false, rows: [] }
    }
    if (response?.status !== 200) return { ok: false, rows: [] }
    const body = await readJson(response)
    const list = Array.isArray(body?.transactions) ? body.transactions : null
    if (!list) return { ok: false, rows: [] }
    return { ok: true, rows: list.map(normalizeTransaction).filter(Boolean) }
  }

  const url = String(env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  if (!url || !key) return { ok: true, rows: [] }
  try {
    const client = factory(url, key, supabaseOptions(token))
    const access = await sessionAccess(client, token)
    if (!access) return { ok: true, rows: [] }
    const query = await client.from('vhpms_sms_transactions').select('*').order('received_at', { ascending: false })
    if (query?.error || !Array.isArray(query?.data)) return { ok: false, rows: [] }
    return { ok: true, rows: query.data.map(normalizeTransaction).filter(Boolean) }
  } catch {
    return { ok: false, rows: [] }
  }
}

export async function pushSmsLabel({ env = {}, token = '', id, businessId, purpose, createClient: factory = createClient, fetch: fetchImpl = fetch } = {}) {
  const business = String(businessId || '').trim()
  const why = String(purpose || '').trim()
  if (!id || !business || !why) return { ok: false }
  const endpoint = String(env.VITE_VHPMS_SMS_URL || '').trim()
  if (endpoint) {
    if (!token) return { ok: false }
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id, business_id: business, purpose: why }),
      })
    } catch {
      return { ok: false }
    }
    if (response?.status !== 200) return { ok: false }
    const body = await readJson(response)
    return { ok: body?.ok === true }
  }

  const url = String(env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  if (!url || !key) return { ok: false }
  try {
    const client = factory(url, key, supabaseOptions(token))
    const access = await sessionAccess(client, token)
    if (!access) return { ok: false }
    const updated = await client.from('vhpms_sms_transactions').update({ business_id: business, purpose: why }).eq('id', id).select('id,business_id,purpose')
    const row = Array.isArray(updated?.data) ? updated.data.find((item) => item?.id === id) : null
    if (updated?.error || !row || row.business_id !== business || row.purpose !== why) return { ok: false }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function endSmsSession({ env = {}, createClient: factory = createClient } = {}) {
  const url = String(env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  if (!url || !key) return { ok: true }
  try {
    const client = factory(url, key, supabaseOptions())
    await client.auth.signOut()
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
