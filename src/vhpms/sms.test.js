import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTransaction, mergeLabels, isUnlabelled, labelTransaction, emptyLabels, inboxFromSms, filterTransactions, amountSlices } from './sms.js'
import { fetchSms } from './smsClient.js'

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
