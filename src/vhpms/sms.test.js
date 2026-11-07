import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTransaction, mergeLabels, isUnlabelled, labelTransaction, emptyLabels, inboxFromSms, filterTransactions, amountSlices, clearPrivateSms, SMS_LABELS_KEY } from './sms.js'
import { fetchSms, pushSmsLabel, endSmsSession, smsWatchKey } from './smsClient.js'

const row = normalizeTransaction({
  id: 'sms-1', received_at: '2026-11-07T08:00:00Z', sender: 'MTN', transaction_id: 'TX1', amount: 40, direction: 'in', counterparty: 'K. Banda', raw_message: 'You received ZMW 40',
})

test('unlabelled SMS stays in the inbox until both labels are set', () => {
  assert.equal(isUnlabelled(row), true)
  assert.equal(inboxFromSms([row], Date.parse('2026-11-07T09:00:00Z'))[0].source, 'SMSGate')
  let labels = emptyLabels()
  labels = labelTransaction(labels, row.id, 've', 'Fuel')
  const merged = mergeLabels([row], labels)
  assert.equal(isUnlabelled(merged[0]), false)
  assert.equal(inboxFromSms(merged).length, 0)
  const filtered = filterTransactions(merged, { labelStatus: 'labelled', business: 've' })
  assert.equal(filtered.length, 1)
  assert.equal(amountSlices(merged, 'purpose')[0].name, 'Fuel')
  assert.throws(() => labelTransaction(labels, row.id, '', 'Fuel'))
})

test('an unconfigured SMS feed adds nothing to the inbox', async () => {
  const result = await fetchSms({ env: {}, token: '' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.rows, [])
  assert.equal(inboxFromSms(result.rows).length, 0)
})

test('SMS reads do not query Supabase without a session', async () => {
  let queried = false
  const result = await fetchSms({
    env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable' },
    createClient: () => ({
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: () => { queried = true; return { select: () => ({ order: async () => ({ data: [], error: null }) }) } },
    }),
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.rows, [])
  assert.equal(queried, false)

  const denied = await fetchSms({
    env: { VITE_VHPMS_SMS_URL: 'https://sms.example/feed' },
    token: 'session-token',
    fetch: async () => ({ status: 500, json: async () => ({ ok: true }) }),
    createClient: () => { throw new Error('supabase must not be used') },
  })
  assert.equal(denied.ok, false)
  const malformed = await fetchSms({
    env: { VITE_VHPMS_SMS_URL: 'https://sms.example/feed' },
    token: 'session-token',
    fetch: async () => ({ status: 200, json: async () => ({}) }),
  })
  assert.equal(malformed.ok, false)
  assert.deepEqual(malformed.rows, [])
})

const SUPABASE_ENV = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable' }

function labelClient({ session = null, updated, onUpdate } = {}) {
  return () => ({
    auth: { getSession: async () => ({ data: { session } }), signOut: async () => {} },
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      update: (payload) => ({
        eq: () => ({
          select: async () => {
            if (onUpdate) onUpdate(payload)
            return updated
          },
        }),
      }),
    }),
  })
}

test('a signed-in Supabase session loads SMS immediately and a signed-out watch does not', async () => {
  assert.equal(smsWatchKey(null), '')
  assert.equal(smsWatchKey({}), '')
  const before = smsWatchKey({ username: 'shadrickvidmar' })
  const after = smsWatchKey({ username: 'shadrickvidmar', token: 'jwt-1' })
  assert.notEqual(before, '')
  assert.notEqual(before, after)

  let queried = false
  const signedOut = await fetchSms({
    env: SUPABASE_ENV,
    createClient: () => ({
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: () => { queried = true; return { select: () => ({ order: async () => ({ data: [], error: null }) }) } },
    }),
  })
  assert.equal(signedOut.ok, true)
  assert.equal(queried, false)

  const loaded = await fetchSms({
    env: SUPABASE_ENV,
    token: 'jwt-1',
    createClient: () => ({
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: () => ({
        select: () => ({
          order: async () => ({ data: [{ id: 'sms-9', received_at: '2026-11-07T08:00:00Z', sender: 'Airtel', amount: 15, direction: 'out' }], error: null }),
        }),
      }),
    }),
  })
  assert.equal(loaded.ok, true)
  assert.equal(loaded.rows[0].id, 'sms-9')
  assert.equal(loaded.rows[0].sender, 'Airtel')
})

test('Supabase-only labelling fails closed unless the updated row comes back', async () => {
  let wrote = null
  const unconfirmed = await pushSmsLabel({
    env: SUPABASE_ENV,
    token: 'jwt-1',
    id: 'sms-1',
    businessId: 've',
    purpose: 'Fuel',
    createClient: labelClient({ updated: { data: [], error: null }, onUpdate: (payload) => { wrote = payload } }),
  })
  assert.equal(unconfirmed.ok, false)
  assert.deepEqual(wrote, { business_id: 've', purpose: 'Fuel' })

  const rejected = await pushSmsLabel({
    env: SUPABASE_ENV,
    token: 'jwt-1',
    id: 'sms-1',
    businessId: 've',
    purpose: 'Fuel',
    createClient: labelClient({ updated: { data: null, error: { message: 'denied' } } }),
  })
  assert.equal(rejected.ok, false)

  const confirmed = await pushSmsLabel({
    env: SUPABASE_ENV,
    token: 'jwt-1',
    id: 'sms-1',
    businessId: 've',
    purpose: 'Fuel',
    createClient: labelClient({ updated: { data: [{ id: 'sms-1', business_id: 've', purpose: 'Fuel' }], error: null } }),
  })
  assert.equal(confirmed.ok, true)

  const browserOnly = await pushSmsLabel({ env: {}, token: 'jwt-1', id: 'sms-1', businessId: 've', purpose: 'Fuel', createClient: () => { throw new Error('no database') } })
  assert.equal(browserOnly.ok, false)

  const unsigned = await pushSmsLabel({
    env: SUPABASE_ENV,
    id: 'sms-1',
    businessId: 've',
    purpose: 'Fuel',
    createClient: labelClient({ session: null, updated: { data: [{ id: 'sms-1', business_id: 've', purpose: 'Fuel' }], error: null } }),
  })
  assert.equal(unsigned.ok, false)
})

test('logout drops cached SMS labels and the Supabase session', async () => {
  const removed = []
  clearPrivateSms({ removeItem: (key) => removed.push(key) })
  assert.deepEqual(removed, [SMS_LABELS_KEY])
  let signedOut = false
  const ended = await endSmsSession({
    env: SUPABASE_ENV,
    createClient: () => ({ auth: { signOut: async () => { signedOut = true } } }),
  })
  assert.equal(ended.ok, true)
  assert.equal(signedOut, true)
})
