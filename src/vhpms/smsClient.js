import { createClient } from '@supabase/supabase-js'
import { normalizeTransaction } from './sms.js'

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
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
    const client = factory(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    const sessionResult = await client.auth.getSession()
    const access = sessionResult?.data?.session?.access_token
    if (typeof access !== 'string' || access === '') return { ok: true, rows: [] }
    const query = await client.from('vhpms_sms_transactions').select('*').order('received_at', { ascending: false })
    if (query?.error || !Array.isArray(query?.data)) return { ok: false, rows: [] }
    return { ok: true, rows: query.data.map(normalizeTransaction).filter(Boolean) }
  } catch {
    return { ok: false, rows: [] }
  }
}

export async function pushSmsLabel({ env = {}, token = '', id, businessId, purpose }) {
  const endpoint = String(env.VITE_VHPMS_SMS_URL || '').trim()
  if (!endpoint) return { ok: true }
  if (!token) return { ok: false }
  let response
  try {
    response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id, business_id: businessId, purpose }),
    })
  } catch {
    return { ok: false }
  }
  if (response?.status !== 200) return { ok: false }
  const body = await readJson(response)
  return { ok: body?.ok === true }
}
