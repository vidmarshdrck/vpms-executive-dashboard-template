// GET /api/bsg/pl-calendar — owner JWT in, boaz.vhpms_bsg_pl_calendar out.
// The RPC is not applied. A missing client or any RPC failure is 503. No trade file is read here.
import { ApiError } from './task-api.js'
import { catMonth, isPlCalendar } from '../src/vhpms/bsg/plCalendar.js'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const MODES = new Set(['PAPER', 'DEMO', 'all'])

export function readPlQuery(url, now = new Date()) {
  const month = url.searchParams.get('month') || catMonth(now)
  if (!MONTH.test(month)) throw new ApiError(400, 'invalid_month')
  const mode = url.searchParams.get('mode') || 'PAPER'
  if (!MODES.has(mode)) throw new ApiError(400, 'invalid_mode')
  return { month, mode }
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

export function createBsgPlRpc({ url, publishableKey, riskUsdPerR, fetchImpl = globalThis.fetch } = {}) {
  if (!Number.isFinite(Number(riskUsdPerR))) throw new Error('risk_usd_required')
  return {
    async calendar(token, { month, mode }) {
      if (!url || !publishableKey || !token) return { ok: false, status: 0 }
      let response
      try {
        response = await fetchImpl(`${String(url).replace(/\/$/, '')}/rest/v1/rpc/vhpms_bsg_pl_calendar`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            apikey: publishableKey,
            authorization: `Bearer ${token}`,
            'content-profile': 'boaz',
            'accept-profile': 'boaz',
          },
          body: JSON.stringify({
            p_month: `${month}-01`,
            p_mode: mode,
            p_risk_usd: riskUsdPerR,
          }),
          signal: AbortSignal.timeout(10000),
        })
      } catch {
        return { ok: false, status: 0 }
      }
      if (!response.ok) {
        await response.text().catch(() => {})
        return { ok: false, status: response.status }
      }
      return { ok: true, body: await readJson(response) }
    },
  }
}

export function createBsgPlHandler({ authenticate, rpc = null } = {}) {
  return async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
      res.end(JSON.stringify(body))
    }
    try {
      const actor = await authenticate(req.headers.authorization)
      if (!actor?.token) throw new ApiError(401, 'unauthorized')
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname.replace(/\/+$/, '') !== '/api/bsg/pl-calendar') throw new ApiError(404, 'not_found')
      if (req.method !== 'GET') throw new ApiError(405, 'method_not_allowed')
      if (!rpc) throw new ApiError(503, 'bsg_pl_unavailable')
      const query = readPlQuery(url)
      const result = await rpc.calendar(actor.token, query)
      if (!result?.ok || !isPlCalendar(result.body)) throw new ApiError(503, 'bsg_pl_unavailable')
      send(200, result.body)
    } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError(503, 'bsg_pl_unavailable')
      send(safe.status, { error: safe.code })
    }
  }
}
