import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { signIn, emailFor } from './auth.js'

test('sign-in checks a remote service and never ships a password', async () => {
  const source = readFileSync(new URL('./auth.js', import.meta.url), 'utf8')
  assert.equal(source.includes('ChangeMe123'), false)
  assert.equal(emailFor('administrator', { VITE_VHPMS_ADMIN_EMAIL: 'owner@vidmar.tech' }), 'owner@vidmar.tech')
  assert.equal(emailFor('nehemiah', { VITE_VHPMS_USER_EMAILS: 'nehemiah:nehemiah@vidmar.tech' }), 'nehemiah@vidmar.tech')

  let called = false
  const missing = await signIn('administrator', '', { env: {}, fetch: () => { called = true } })
  assert.equal(missing.ok, false)
  assert.equal(missing.error, 'Enter both username and password.')
  assert.equal(called, false)

  const unconfigured = await signIn('administrator', 'not-stored', { env: {} })
  assert.equal(unconfigured.ok, false)
  assert.equal(unconfigured.error, 'Sign-in is not configured for this account.')

  const denied = await signIn('administrator', 'not-stored', {
    env: { VITE_VHPMS_AUTH_URL: 'http://auth.local/session' },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
  })
  assert.equal(denied.error, 'Incorrect username or password.')

  let body
  const allowed = await signIn(' Administrator ', 'not-stored', {
    env: { VITE_VHPMS_AUTH_URL: 'http://auth.local/session' },
    fetch: async (_url, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ ok: true }) } },
  })
  assert.equal(allowed.ok, true)
  assert.equal(allowed.user.role, 'admin')
  assert.equal(body.username, 'administrator')
  assert.equal(body.password, 'not-stored')
})
