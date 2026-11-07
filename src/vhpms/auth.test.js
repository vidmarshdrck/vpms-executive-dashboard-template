import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { signIn, emailFor, accountForSignIn, readSession, saveSession, clearSession } from './auth.js'

test('sign-in checks a remote service and never ships a password', async () => {
  const source = readFileSync(new URL('./auth.js', import.meta.url), 'utf8')
  assert.equal(source.includes('ChangeMe123'), false)
  assert.equal(source.includes('body.ok !== true'), true)
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source), false)
  assert.equal(emailFor('shadrickvidmar', { VITE_VHPMS_ADMIN_EMAIL: 'owner@vidmar.tech' }), 'owner@vidmar.tech')
  assert.equal(emailFor('shadrickvidmar', {}), null)
  assert.equal(emailFor('nehemiah', { VITE_VHPMS_USER_EMAILS: 'nehemiah:nehemiah@vidmar.tech' }), 'nehemiah@vidmar.tech')

  let called = false
  const missing = await signIn('shadrickvidmar', '', { env: {}, fetch: () => { called = true } })
  assert.equal(missing.ok, false)
  assert.equal(missing.error, 'Enter both username and password.')
  assert.equal(called, false)

  const unconfigured = await signIn('shadrickvidmar', 'not-stored', { env: {} })
  assert.equal(unconfigured.ok, false)
  assert.equal(unconfigured.error, 'Sign-in is not configured for this account.')

  const denied = await signIn('shadrickvidmar', 'not-stored', {
    env: { VITE_VHPMS_AUTH_URL: 'http://auth.local/session' },
    fetch: async () => ({ status: 401, json: async () => ({ ok: false }) }),
  })
  assert.equal(denied.ok, false)
  assert.equal(denied.error, 'Incorrect username or password.')

  let body
  const allowed = await signIn(' ShadrickVidmar ', 'not-stored', {
    env: { VITE_VHPMS_AUTH_URL: 'http://auth.local/session' },
    fetch: async (_url, init) => { body = JSON.parse(init.body); return { status: 200, json: async () => ({ ok: true }) } },
  })
  assert.equal(allowed.ok, true)
  assert.equal(allowed.user.role, 'admin')
  assert.deepEqual(allowed.user.roles, ['admin', 'gm', 'hrd'])
  assert.equal(body.username, 'shadrickvidmar')
  assert.equal(body.password, 'not-stored')
})

test('auth URL accepts only HTTP 200 with boolean ok true', async () => {
  const env = { VITE_VHPMS_AUTH_URL: 'http://auth.local/session' }
  async function attempt(response) {
    const fetch = typeof response === 'function' ? response : async () => response
    return signIn('shadrickvidmar', 'not-stored', { env, fetch })
  }
  const empty = await attempt({ status: 200, json: async () => ({}) })
  const invalid = await attempt({ status: 200, json: async () => { throw new SyntaxError('invalid json') } })
  const stringOk = await attempt({ status: 200, json: async () => ({ ok: 'true' }) })
  const serverError = await attempt({ status: 500, json: async () => ({ ok: true }) })
  const offline = await attempt(async () => { throw new Error('network down') })
  for (const result of [empty, invalid, stringOk, serverError, offline]) {
    assert.equal(result.ok, false)
    assert.equal(result.user, undefined)
  }
  assert.equal(offline.error, 'Sign-in service is unreachable.')
  const accepted = await attempt({ status: 200, json: async () => ({ ok: true }) })
  assert.equal(accepted.ok, true)
  assert.equal(accepted.user.username, 'shadrickvidmar')
})

test('supabase sign-in fails closed unless a session and user come back', async () => {
  const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable', VITE_VHPMS_ADMIN_EMAIL: 'owner@vidmar.tech' }
  function client(result) {
    return () => ({ auth: { signInWithPassword: async () => result } })
  }
  const missingSession = await signIn('shadrickvidmar', 'not-stored', { env, createClient: client({ data: {}, error: null }) })
  const emptySession = await signIn('shadrickvidmar', 'not-stored', { env, createClient: client({ data: { session: {}, user: {} }, error: null }) })
  const rejected = await signIn('shadrickvidmar', 'not-stored', { env, createClient: client({ error: { message: 'invalid' }, data: { session: { access_token: 'token' }, user: { id: '1' } } }) })
  const offline = await signIn('shadrickvidmar', 'not-stored', { env, createClient: () => ({ auth: { signInWithPassword: async () => { throw new Error('network down') } } }) })
  for (const result of [missingSession, emptySession, rejected, offline]) {
    assert.equal(result.ok, false)
    assert.equal(result.user, undefined)
  }
  assert.equal(offline.error, 'Sign-in service is unreachable.')
  const seen = {}
  const accepted = await signIn('shadrickvidmar', 'not-stored', {
    env,
    createClient: () => ({ auth: { signInWithPassword: async ({ email }) => { seen.email = email; return { data: { session: { access_token: 'token' }, user: { id: '1' } }, error: null } } } }),
  })
  assert.equal(accepted.ok, true)
  assert.equal(accepted.user.username, 'shadrickvidmar')
  assert.deepEqual(accepted.user.roles, ['admin', 'gm', 'hrd'])
  assert.equal(accepted.token, 'token')
  assert.equal(seen.email, 'owner@vidmar.tech')

  const byEmail = await signIn(' Owner@vidmar.tech ', 'not-stored', {
    env,
    createClient: client({ data: { session: { access_token: 'token' }, user: { id: '1' } }, error: null }),
  })
  assert.equal(byEmail.ok, true)
  assert.equal(byEmail.user.username, 'shadrickvidmar')
  assert.equal(accountForSignIn('owner@vidmar.tech', undefined, env).username, 'shadrickvidmar')
})

test('owner session keeps the access token and the selected role', () => {
  const memory = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  }
  const owner = accountForSignIn('shadrickvidmar')
  saveSession({ ...owner, currentRole: 'hrd' }, 'supabase-access')
  const restored = readSession()
  assert.equal(restored.username, 'shadrickvidmar')
  assert.equal(restored.currentRole, 'hrd')
  assert.equal(restored.token, 'supabase-access')
  assert.deepEqual(restored.roles, ['admin', 'gm', 'hrd'])
  clearSession()
  assert.equal(readSession(), null)
})
