import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyProbe, probeTaskApi, taskApiBase } from './backendStatus.js'
const res = (status, ct = 'application/json') => ({ status, headers: { get: () => ct } })
test('classifies task API probe responses', () => {
  assert.equal(classifyProbe(401, 'application/json; charset=utf-8'), 'Backend connected')
  assert.equal(classifyProbe(200, 'application/json'), 'Backend connected')
  assert.equal(classifyProbe(503, 'application/json'), 'Backend not ready')
  assert.equal(classifyProbe(200, 'text/html'), 'Backend disconnected')
  assert.equal(classifyProbe(502, 'application/json'), 'Backend disconnected')
  assert.equal(classifyProbe(0), 'Backend disconnected')
})
test('probe sends no credentials and fails closed on network error', async () => {
  let seen
  assert.equal(await probeTaskApi('/api/tasks', async (u, o) => { seen = [u, o]; return res(401) }), 'Backend connected')
  assert.equal(seen[0], '/api/tasks?business=BSG'); assert.equal(seen[1].credentials, 'omit'); assert.equal(seen[1].headers, undefined)
  assert.equal(await probeTaskApi('/api/tasks', async () => { throw new Error('offline') }), 'Backend disconnected')
  assert.equal(taskApiBase({ VITE_VHPMS_TASK_API_URL: 'https://x.test/api/tasks/' }), 'https://x.test/api/tasks')
  assert.equal(taskApiBase({}), '/api/tasks')
})
