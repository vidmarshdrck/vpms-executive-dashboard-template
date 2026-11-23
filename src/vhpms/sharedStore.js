import { createVeClient } from './veData.js'
import { emptyOwnerScorecards, parseOwnerScorecards } from './ownerScorecards.js'
import { freshScorecard, loadScorecard } from './score.js'

export const SCORE_KEY = 'vhpms-scorecard-v1'
export const OWNER_SCORECARDS_KEY = 'vhpms-owner-scorecards-v1'

const KPI_TABLE = 'vhpms_kpis'
const PERIOD_TABLE = 'vhpms_kpi_periods'
const SCORECARD_TABLE = 'vhpms_owner_scorecards'

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return atob(padded + pad)
}

export function userIdFromAccessToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length < 2) return ''
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]))
    return typeof payload.sub === 'string' && /^[0-9a-f-]{36}$/i.test(payload.sub) ? payload.sub : ''
  } catch {
    return ''
  }
}

function readLocal(storage, key) {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeLocal(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function openClient(env, token, createClient) {
  const userId = userIdFromAccessToken(token)
  if (!userId) return null
  try {
    const client = createVeClient(env, token, createClient)
    return client ? { client, userId } : null
  } catch {
    return null
  }
}

async function query(client, table, action) {
  try {
    const result = await action(client.from(table))
    if (result?.error) return { ok: false, rows: [] }
    return { ok: true, rows: result?.data || [] }
  } catch {
    return { ok: false, rows: [] }
  }
}

function cardFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    metrics: row.metrics,
  }
}

export async function loadOwnerScorecards({ env, token, storage, createClient } = {}) {
  const local = parseOwnerScorecards(readLocal(storage, OWNER_SCORECARDS_KEY))
  const opened = openClient(env, token, createClient)
  if (!opened) return local
  const remote = await query(opened.client, SCORECARD_TABLE, (table) => table.select('id,name,subject_type,subject_id,business_id,metrics'))
  if (!remote.ok) return local
  const cards = remote.rows.map(cardFromRow)
  const parsed = parseOwnerScorecards(JSON.stringify({ version: 1, cards }))
  if (!parsed.cards.length && local.cards.length) {
    const pushed = await saveOwnerScorecards({ env, token, storage, createClient, state: local })
    return pushed.state
  }
  writeLocal(storage, OWNER_SCORECARDS_KEY, parsed.cards.length ? parsed : emptyOwnerScorecards())
  return parsed.cards.length ? parsed : emptyOwnerScorecards()
}

export async function saveOwnerScorecards({ env, token, storage, createClient, state } = {}) {
  const next = state?.version === 1 && Array.isArray(state.cards) ? state : emptyOwnerScorecards()
  writeLocal(storage, OWNER_SCORECARDS_KEY, next)
  const opened = openClient(env, token, createClient)
  if (!opened) return { state: next, remote: false }
  const rows = next.cards.map((card) => ({
    id: card.id,
    owner_id: opened.userId,
    name: card.name,
    subject_type: card.subjectType,
    subject_id: card.subjectId,
    business_id: card.subjectType === 'business' ? card.subjectId : null,
    metrics: card.metrics,
  }))
  if (!rows.length) return { state: next, remote: true }
  const saved = await query(opened.client, SCORECARD_TABLE, (table) => table.upsert(rows, { onConflict: 'id' }))
  return { state: next, remote: saved.ok }
}

function mergePeriods(base, kpiRows, periodRows) {
  const catalogueById = new Map((kpiRows || []).map((row) => [row.id, row.catalogue_id]))
  const periods = new Map()
  for (const period of periodRows || []) {
    const catalogueId = catalogueById.get(period.kpi_id)
    if (!catalogueId) continue
    const list = periods.get(catalogueId) || []
    list.push({
      label: String(period.label || '').toUpperCase(),
      year: Number(period.year),
      target: period.target == null ? null : Number(period.target),
      actual: period.actual == null ? null : Number(period.actual),
    })
    periods.set(catalogueId, list)
  }
  if (!periods.size) return base
  return {
    ...base,
    kpis: base.kpis.map((kpi) => (periods.has(kpi.id) ? { ...kpi, periods: periods.get(kpi.id) } : kpi)),
  }
}

function hasPeriods(scorecard) {
  return (scorecard?.kpis || []).some((kpi) => (kpi.periods || []).length > 0)
}

export async function loadKpiScorecard({ env, token, storage, createClient } = {}) {
  const local = loadScorecard(readLocal(storage, SCORE_KEY))
  const opened = openClient(env, token, createClient)
  if (!opened) return local
  const kpis = await query(opened.client, KPI_TABLE, (table) => table.select('id,catalogue_id,business_code,measure,perspective,unit,frequency,direction,active'))
  if (!kpis.ok) return local
  const periods = await query(opened.client, PERIOD_TABLE, (table) => table.select('id,kpi_id,label,year,target,actual'))
  if (!periods.ok) return local
  const merged = mergePeriods(freshScorecard(), kpis.rows, periods.rows)
  if (!hasPeriods(merged) && hasPeriods(local)) {
    const pushed = await saveKpiScorecard({ env, token, storage, createClient, scorecard: local })
    return pushed.scorecard
  }
  writeLocal(storage, SCORE_KEY, merged)
  return merged
}

export async function saveKpiScorecard({ env, token, storage, createClient, scorecard } = {}) {
  const next = scorecard?.catalogue === freshScorecard().catalogue ? scorecard : loadScorecard(JSON.stringify(scorecard || null))
  writeLocal(storage, SCORE_KEY, next)
  const opened = openClient(env, token, createClient)
  if (!opened) return { scorecard: next, remote: false }
  const kpiRows = next.kpis.map((kpi) => ({
    owner_id: opened.userId,
    catalogue_id: kpi.id,
    business_code: kpi.businessCode || null,
    measure: kpi.measure,
    perspective: kpi.perspective,
    unit: kpi.unit || null,
    frequency: kpi.frequency || null,
    direction: kpi.direction || 'HIGHER_BETTER',
    active: kpi.active !== false,
  }))
  const savedKpis = await query(opened.client, KPI_TABLE, (table) => table.upsert(kpiRows, { onConflict: 'owner_id,catalogue_id' }).select('id,catalogue_id'))
  if (!savedKpis.ok || !savedKpis.rows.length) return { scorecard: next, remote: false }
  const idByCatalogue = new Map(savedKpis.rows.map((row) => [row.catalogue_id, row.id]))
  const periodRows = next.kpis.flatMap((kpi) => {
    const kpiId = idByCatalogue.get(kpi.id)
    if (!kpiId) return []
    return (kpi.periods || []).map((period) => ({
      kpi_id: kpiId,
      label: period.label,
      year: Number(period.year),
      target: period.target,
      actual: period.actual,
    }))
  })
  if (!periodRows.length) return { scorecard: next, remote: true }
  const savedPeriods = await query(opened.client, PERIOD_TABLE, (table) => table.upsert(periodRows, { onConflict: 'kpi_id,label,year' }))
  return { scorecard: next, remote: savedPeriods.ok }
}
