// Unauthenticated reachability probe for the VHPMS task API. No token is sent.
// 401/403/200 = the API answered (connected). 503 = reachable but not configured.
// Network failure, non-JSON (e.g. an SPA/404 page) or other status = disconnected.
export const taskApiBase = (env = {}) => (env.VITE_VHPMS_TASK_API_URL || '/api/tasks').replace(/\/$/, '')
export function classifyProbe(status, contentType = '') {
  if (!status) return 'Backend disconnected'
  if (!String(contentType).includes('application/json')) return 'Backend disconnected'
  if ([200, 401, 403].includes(status)) return 'Backend connected'
  if (status === 503) return 'Backend not ready'
  return 'Backend disconnected'
}
export async function probeTaskApi(base, fetchImpl = globalThis.fetch, timeoutMs = 5000) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetchImpl(`${base}?business=BSG`, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: ctrl?.signal })
    return classifyProbe(res.status, res.headers?.get?.('content-type') || '')
  } catch { return 'Backend disconnected' } finally { if (timer) clearTimeout(timer) }
}
