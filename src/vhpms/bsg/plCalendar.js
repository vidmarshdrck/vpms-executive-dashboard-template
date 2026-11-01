// Offline twin of boaz.vhpms_bsg_pl_calendar. R is canonical. Dollars are r × riskUsdPerR.
// Days bucket by exit instant in Africa/Lusaka. VOID_* , open trades, and rows without R are out.
// Closed statuses use the literal prefix CLOSED_ (the draft LIKE treats "_" as one character, which
// still matches CLOSED_TP / CLOSED_SL; the contract keeps those closed trades and drops the rest).

export const CAT_TZ = 'Africa/Lusaka'
export const PL_SOURCE = 'boaz.paper_trades'
export const PL_MODES = ['PAPER', 'DEMO', 'all']
export const MODE_LABEL = { PAPER: 'Paper', DEMO: 'Demo', all: 'All' }
const MICRO = 1000000n

export function parseTradeTimestamp(text) {
  const match = String(text ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*(UTC|CAT)$/i)
  if (!match) return null
  const utc = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] || 0))
  if (!Number.isFinite(utc)) return null
  return match[7].toUpperCase() === 'CAT' ? utc - 2 * 60 * 60 * 1000 : utc
}

export function catDateIso(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAT_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ms)
}

// Test and screenshot harness only. Closed trades that exit on this CAT day drop out of the month.
export function voidExitsOnDay(trades, day) {
  return (Array.isArray(trades) ? trades : []).map((trade) => {
    const exit = parseTradeTimestamp(trade?.exit_ts)
    if (exit != null && catDateIso(exit) === day && String(trade?.status || '').startsWith('CLOSED_')) return { ...trade, status: 'VOID_EXCLUDED' }
    return trade
  })
}

export function catMonth(now = new Date()) {
  const ms = now instanceof Date ? now.getTime() : Number(now)
  return catDateIso(ms).slice(0, 7)
}

export function shiftMonth(month, delta) {
  const [year, mon] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, mon - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

// How far an opening search may walk before the current month. Each step is one existing RPC call.
export const OPENING_LOOKBACK = 12

// No month chosen yet: current CAT month if it has trades, else the latest earlier month within the lookback.
// A month with no trades is not an error. A failed read rejects so the card stays on the empty state.
export async function resolveOpeningMonth({ now = new Date(), mode = 'PAPER', read, lookback = OPENING_LOOKBACK } = {}) {
  if (typeof read !== 'function') throw new Error('calendar_unavailable')
  const current = catMonth(now)
  let currentBody = null
  for (let step = 0; step <= lookback; step++) {
    const month = step === 0 ? current : shiftMonth(current, -step)
    const body = await read(month, mode)
    if (!isPlCalendar(body)) throw new Error('calendar_unavailable')
    if (step === 0) currentBody = body
    if (Number(body.summary?.trades) >= 1) return { month, data: body }
  }
  return { month: current, data: currentBody }
}

export function monthTitle(month) {
  const [year, mon] = month.split('-').map(Number)
  const name = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, mon - 1, 1)))
  return { name, year: String(year) }
}

export function formatDayLabel(iso) {
  if (!iso) return '—'
  const [year, mon, day] = String(iso).slice(0, 10).split('-').map(Number)
  const name = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, mon - 1, day)))
  return `${name} ${day}`.toUpperCase()
}

export function formatPl(value, unit) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return unit === 'r' ? `${sign}${abs}R` : `${sign}$${abs}`
}

export function formatSyncedAgo(stamp, now = Date.now()) {
  const t = typeof stamp === 'number' ? stamp : Date.parse(stamp)
  if (!Number.isFinite(t)) return null
  const seconds = Math.max(0, Math.floor((now - t) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Grey "Synced …" after a read. Amber "Not synced" when the read failed. Never a green live mark.
export function syncStatus({ phase, asOf, syncedAt, now = Date.now() } = {}) {
  if (phase === 'unavailable' || phase === 'signin') return { tone: 'stale', label: 'Not synced' }
  const ago = formatSyncedAgo(asOf || syncedAt, now)
  return { tone: 'ok', label: ago ? `Synced ${ago}` : 'Synced' }
}

// Best day is a winning day. A null best_day, a losing month, or a non-finite figure is no tile value.
export function bestDayFigure(data, unit) {
  const best = data?.summary?.best_day
  const pl = Number(best?.pl_r)
  if (!best || best.day == null || !Number.isFinite(pl) || pl <= 0) return null
  const key = String(best.day).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const row = Array.isArray(data.days) ? data.days.find((day) => String(day?.day).slice(0, 10) === key) : null
  let value = unit === 'r' ? pl : Number(row?.pl_usd)
  if (unit !== 'r' && !Number.isFinite(value) && Number.isFinite(Number(data?.risk_usd_per_r))) value = Number((pl * Number(data.risk_usd_per_r)).toFixed(2))
  if (!Number.isFinite(value)) return null
  return { day: key, value }
}

export function plSign(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return 'zero'
  return n > 0 ? 'pos' : 'neg'
}

export function isPlCalendar(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body)
    && typeof body.month === 'string'
    && body.summary && typeof body.summary === 'object' && !Array.isArray(body.summary)
    && Array.isArray(body.days) && Array.isArray(body.weeks)
}

export function parsePaperTradesCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const source = String(text).replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows.filter((cols) => cols.some((col) => col.length))
  if (!header) return []
  return body.map((cols) => Object.fromEntries(header.map((key, index) => [key, cols[index] ?? ''])))
}

function parseDecimal(value) {
  const match = String(value ?? '').trim().match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const sign = match[1] === '-' ? -1n : 1n
  const frac = (match[3] || '').slice(0, 6).padEnd(6, '0')
  return sign * (BigInt(match[2]) * MICRO + BigInt(frac))
}

function roundMicro(micro, places) {
  const neg = micro < 0n
  const abs = neg ? -micro : micro
  const quantum = 10n ** BigInt(6 - places)
  const base = abs / quantum
  const rem = abs % quantum
  const rounded = rem * 2n >= quantum ? base + 1n : base
  const digits = neg ? -rounded : rounded
  return Number((Number(digits) / 10 ** places).toFixed(places))
}

function divRound(num, den, places) {
  if (den === 0n) return null
  const neg = (num < 0n) !== (den < 0n)
  const absNum = num < 0n ? -num : num
  const absDen = den < 0n ? -den : den
  const scaled = absNum * (10n ** BigInt(places))
  const base = scaled / absDen
  const rem = scaled % absDen
  const rounded = rem * 2n >= absDen ? base + 1n : base
  const digits = neg ? -rounded : rounded
  return Number((Number(digits) / 10 ** places).toFixed(places))
}

function money(sumMicro, riskMicro) {
  const neg = (sumMicro < 0n) !== (riskMicro < 0n)
  const absNum = (sumMicro < 0n ? -sumMicro : sumMicro) * (riskMicro < 0n ? -riskMicro : riskMicro)
  const den = 10n ** 10n
  const base = absNum / den
  const rem = absNum % den
  const cents = rem * 2n >= den ? base + 1n : base
  const signed = neg ? -cents : cents
  return Number((Number(signed) / 100).toFixed(2))
}

export function mondayOf(iso) {
  const [year, mon, day] = String(iso).slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, mon - 1, day))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

function monthBounds(month) {
  const [year, mon] = month.split('-').map(Number)
  const start = Date.UTC(year, mon - 1, 1) - 2 * 60 * 60 * 1000
  const end = Date.UTC(year, mon, 1) - 2 * 60 * 60 * 1000
  return [start, end]
}

function keptTrades(trades, mode, start, end) {
  const out = []
  for (const trade of trades || []) {
    const status = String(trade?.status || '')
    if (!status.startsWith('CLOSED_')) continue
    if (mode !== 'all' && trade.mode !== mode) continue
    const r = parseDecimal(trade.r_multiple)
    if (r == null) continue
    const exit = parseTradeTimestamp(trade.exit_ts)
    const open = parseTradeTimestamp(trade.open_ts)
    if (exit == null || open == null || exit < start || exit >= end) continue
    out.push({ r, exit, open })
  }
  return out
}

export function aggregatePlCalendar(trades, { month, mode = 'PAPER', riskUsdPerR } = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('invalid_month')
  if (!PL_MODES.includes(mode)) throw new Error('invalid_mode')
  const riskMicro = parseDecimal(riskUsdPerR)
  if (riskMicro == null) throw new Error('risk_usd_required')
  const [start, end] = monthBounds(month)
  const rows = keptTrades(trades, mode, start, end)
  const byDay = new Map()
  let total = 0n
  let positive = 0n
  let negative = 0n
  let wins = 0
  let holdMs = 0n
  for (const row of rows) {
    const day = catDateIso(row.exit)
    const group = byDay.get(day) || { r: 0n, n: 0, w: 0, l: 0 }
    group.r += row.r
    group.n += 1
    if (row.r > 0n) { group.w += 1; positive += row.r; wins += 1 }
    else if (row.r < 0n) { group.l += 1; negative += row.r }
    byDay.set(day, group)
    total += row.r
    holdMs += BigInt(row.exit - row.open)
  }
  const days = [...byDay.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([day, group]) => ({
    day,
    pl_r: roundMicro(group.r, 2),
    pl_usd: money(group.r, riskMicro),
    trades: group.n,
    wins: group.w,
    losses: group.l,
  }))
  const byWeek = new Map()
  for (const [day, group] of byDay) {
    const week = mondayOf(day)
    const bucket = byWeek.get(week) || { r: 0n, n: 0 }
    bucket.r += group.r
    bucket.n += group.n
    byWeek.set(week, bucket)
  }
  const weeks = [...byWeek.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([week_start, bucket]) => ({
    week_start,
    pl_r: roundMicro(bucket.r, 2),
    pl_usd: money(bucket.r, riskMicro),
    trades: bucket.n,
  }))
  const ranked = [...byDay.entries()].sort((a, b) => (a[1].r === b[1].r ? (a[0] < b[0] ? -1 : 1) : (a[1].r > b[1].r ? -1 : 1)))
  const best = ranked[0]
  const worst = ranked.length ? [...ranked].sort((a, b) => (a[1].r === b[1].r ? (a[0] < b[0] ? -1 : 1) : (a[1].r < b[1].r ? -1 : 1)))[0] : null
  const count = rows.length
  return {
    source: PL_SOURCE,
    mode,
    timezone: CAT_TZ,
    month,
    risk_usd_per_r: Number(riskUsdPerR),
    summary: {
      pl_r: roundMicro(total, 2),
      pl_usd: money(total, riskMicro),
      trades: count,
      win_rate: count ? divRound(100n * BigInt(wins), BigInt(count), 1) : null,
      avg_hold_minutes: count ? divRound(holdMs, BigInt(count) * 60000n, 0) : null,
      profit_factor: negative < 0n ? divRound(positive, -negative, 2) : null,
      best_day: best ? { day: best[0], pl_r: roundMicro(best[1].r, 2) } : null,
      worst_day: worst ? { day: worst[0], pl_r: roundMicro(worst[1].r, 2) } : null,
    },
    days,
    weeks,
  }
}

export function buildMonthGrid(month, days = [], weeks = []) {
  const dayMap = new Map(days.map((day) => [String(day.day).slice(0, 10), day]))
  const weekMap = new Map(weeks.map((week) => [String(week.week_start).slice(0, 10), week]))
  const [year, mon] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7
  const rows = Math.ceil((lead + last) / 7)
  const winByWeek = new Map()
  const lossByWeek = new Map()
  for (const day of days) {
    const key = mondayOf(day.day)
    if (Number(day.pl_r) > 0) winByWeek.set(key, (winByWeek.get(key) || 0) + 1)
    else if (Number(day.pl_r) < 0) lossByWeek.set(key, (lossByWeek.get(key) || 0) + 1)
  }
  return Array.from({ length: rows }, (_, row) => {
    const weekStart = new Date(Date.UTC(year, mon - 1, 1 - lead + row * 7)).toISOString().slice(0, 10)
    const cells = Array.from({ length: 5 }, (__, col) => {
      const dayNum = 1 - lead + row * 7 + col
      if (dayNum < 1 || dayNum > last) return null
      const date = new Date(Date.UTC(year, mon - 1, dayNum)).toISOString().slice(0, 10)
      const hit = dayMap.get(date)
      return {
        date,
        dayNum,
        pl_r: hit ? hit.pl_r : null,
        pl_usd: hit ? hit.pl_usd : null,
        trades: hit ? hit.trades : 0,
        wins: hit ? hit.wins : 0,
        losses: hit ? hit.losses : 0,
      }
    })
    const week = weekMap.get(weekStart) || null
    return {
      weekStart,
      cells,
      pl_r: week ? week.pl_r : 0,
      pl_usd: week ? week.pl_usd : 0,
      trades: week ? week.trades : 0,
      winDays: winByWeek.get(weekStart) || 0,
      lossDays: lossByWeek.get(weekStart) || 0,
    }
  })
}
