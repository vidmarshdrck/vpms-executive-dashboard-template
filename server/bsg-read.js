// Read-only BSG summary: fixed allowlist inside BSG_DATA_DIR / BSG_KNOWLEDGE_DIR, size cap, 30 s cache. No request input becomes a path.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ApiError } from './task-api.js'
import { normaliseTrades, pendingSignals, account, parseHeaders, cronState, strategyName } from './bsg-normalise.js'
export const SCAN_RE = /^bsg_scan_\d{8}_\d{4}\.json$/
export const SPECIALISTS = [['gabriel_strategy', 'Gabriel · strategy'], ['gideon_bull', 'Gideon · bull case'], ['samson_bear', 'Samson · bear case']]
export function createBsgReader({ dataDir, knowledgeDir, maxBytes = 5 * 1024 * 1024, ttlMs = 30000, now = () => Date.now() }) {
  if (!dataDir || !knowledgeDir || !path.isAbsolute(dataDir) || !path.isAbsolute(knowledgeDir)) throw new ApiError(503, 'bsg_not_configured')
  let cache = null
  async function inside(base, rel) {
    if (rel.split(/[\\/]/).some(p => p === '..' || p === '.worktrees')) throw Error('path_rejected')
    const real = await fs.realpath(path.join(base, rel)), root = await fs.realpath(base)
    if (real !== root && !real.startsWith(root + path.sep)) throw Error('path_rejected')
    return real
  }
  async function read(base, rel, json) {
    const source = { file: rel, ok: false, mtime: null }
    try {
      const real = await inside(base, rel), st = await fs.stat(real)
      if (!st.isFile()) throw Error('not_file')
      if (st.size > maxBytes) { source.error = 'too_large'; return { source, value: null } }
      const text = await fs.readFile(real, 'utf8')
      source.mtime = st.mtime.toISOString(); source.ok = true
      return { source, value: json ? JSON.parse(text) : text }
    } catch (e) { source.error = source.error || (e instanceof SyntaxError ? 'invalid_json' : e.code === 'ENOENT' ? 'missing' : 'unreadable'); source.ok = false; return { source, value: null } }
  }
  async function build() {
    const names = await fs.readdir(dataDir).catch(() => [])
    const latest = names.filter(n => SCAN_RE.test(n)).sort().at(-1)
    const [trades, acct, scan, strat] = await Promise.all([read(dataDir, 'open_paper_trades.json', true), read(dataDir, 'paper_account.json', true),
      latest ? read(dataDir, latest, true) : Promise.resolve({ source: { file: 'bsg_scan_*.json', ok: false, error: 'missing', mtime: null }, value: null }),
      read(knowledgeDir, 'knowledge/owner_trading_strategy.md', false)])
    const specs = await Promise.all(SPECIALISTS.map(async ([dirName, label]) => {
      const goal = await read(knowledgeDir, `specialists/${dirName}.agent/goal.md`, false), cron = await read(knowledgeDir, `specialists/${dirName}.agent/cron_job.md`, false)
      return { label, dirName, goal, cron }
    }))
    const h = parseHeaders(strat.value)
    const strategies = [{ name: strategyName(h.version), version: h.version, status: h.status, file: 'knowledge/owner_trading_strategy.md', mtime: strat.source.mtime, kind: 'strategy',
      roles: 'Boaz verifies · Gideon bull case · Samson bear case · Gabriel strategy (proposed)' },
      ...specs.map(s => ({ name: s.label, version: parseHeaders(s.goal.value).version, status: cronState(s.cron.value) ?? parseHeaders(s.goal.value).status, file: `specialists/${s.dirName}.agent/`, mtime: s.cron.source.mtime ?? s.goal.source.mtime, kind: 'specialist', roles: parseHeaders(s.goal.value).title }))]
    const sources = [trades.source, acct.source, scan.source, strat.source, ...specs.flatMap(s => [s.goal.source, s.cron.source])]
    return { fixture: false, generated_at: new Date(now()).toISOString(), sources, account: account(acct.value), trades: normaliseTrades(trades.value),
      pending: pendingSignals(scan.value), scan: scan.value ? { file: latest, ts: scan.value.ts ?? null, session: scan.value.session ?? null, markets: Array.isArray(scan.value.markets) ? scan.value.markets : [] } : null, strategies }
  }
  return { async summary() { if (cache && now() - cache.at < ttlMs) return cache.value; const value = await build(); cache = { at: now(), value }; return value } }
}
export function createBsgHandler({ authenticate, reader }) {
  return async (req, res) => {
    const send = (s, b) => { res.writeHead(s, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(b)) }
    try {
      const actor = await authenticate(req.headers.authorization)
      if (!actor) throw new ApiError(401, 'unauthorized')
      if (new URL(req.url, 'http://localhost').pathname !== '/api/bsg/summary') throw new ApiError(404, 'not_found')
      if (req.method !== 'GET') throw new ApiError(405, 'method_not_allowed')
      const r = typeof reader === 'function' ? reader() : reader
      const body = await r.summary()
      if (!body.sources.some(s => s.ok)) return send(503, { error: 'bsg_sources_unavailable', sources: body.sources })
      send(200, body)
    } catch (e) { const s = e instanceof ApiError ? e : new ApiError(503, 'bsg_unavailable'); send(s.status, { error: s.code }) }
  }
}
