// Executive summary export: builds one data model from the same sources the
// dashboards use (GM scorecard + departments with GM-approved KPI values),
// then renders it as CSV (opens in Excel) or printable HTML (save as PDF).
// No dependencies, so it works in the IIS build without extra packages.

import { PERSPECTIVES, gmScorecard } from '../data/scorecardData.js'
import { periodAchievement, periodActual, periodTarget, scoreScorecard } from './scorecard.js'
import { scoreStatus, formatScore } from './scoreStatus.js'
import { filterSeriesByTimeframe } from './reportingPeriod.js'
import { departmentsWithPublishedKpis, activatedKpiScore } from './departmentsWithPublishedKpis.js'

function fmt(value, unit) {
  if (value === null || value === undefined) return '—'
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'LTIFR') return value.toFixed(2)
  return `${value.toFixed(1)} ${unit}`
}

export function monthsForTimeframe(timeframe) {
  return filterSeriesByTimeframe(Array.from({ length: 12 }, (_, index) => ({ index })), timeframe).map(item => item.index)
}

export function buildExecutiveSummary({ periodLabel, months, generatedBy, year = new Date().getFullYear(), now = new Date() }) {
  const gm = activatedKpiScore(year, months) || scoreScorecard(PERSPECTIVES, gmScorecard.kpis)
  const departments = departmentsWithPublishedKpis(year, months).map((dept) => {
    const kpis = dept.kpis.map((kpi) => ({ ...kpi, achievement: periodAchievement(kpi, months) }))
    return { id: dept.id, name: dept.name, kpis, ...scoreScorecard(PERSPECTIVES, kpis) }
  }).sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))

  return {
    title: 'VPMS Executive Summary',
    periodLabel,
    generatedAt: now.toLocaleString(),
    generatedBy,
    headline: {
      overall: formatScore(gm.overall),
      status: scoreStatus(gm.overall).label,
      perspectives: PERSPECTIVES.map((p) => ({ name: p.name, score: formatScore(gm.scores[p.key]), status: scoreStatus(gm.scores[p.key]).label })),
    },
    departmentRows: departments.map((d) => ({
      name: d.name,
      scores: PERSPECTIVES.map((p) => formatScore(d.scores[p.key])),
      overall: formatScore(d.overall),
      status: scoreStatus(d.overall).label,
    })),
    kpiRows: departments.flatMap((d) => d.kpis.map((k) => ({
      department: d.name,
      perspective: PERSPECTIVES.find((p) => p.key === k.perspective)?.name ?? k.perspective,
      measure: k.name,
      weight: String(k.weight),
      target: fmt(periodTarget(k, months), k.unit),
      actual: fmt(periodActual(k, months), k.unit),
      achievement: formatScore(k.achievement),
      status: scoreStatus(k.achievement).label,
    }))),
    perspectiveNames: PERSPECTIVES.map((p) => p.name),
  }
}

const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
const csvRow = (cells) => cells.map(csvCell).join(',')

export function summaryToCsv(m) {
  const lines = [
    csvRow([m.title]), csvRow(['Period', m.periodLabel]), csvRow(['Generated', m.generatedAt, m.generatedBy]), '',
    csvRow(['Company scorecard']), csvRow(['Overall', m.headline.overall, m.headline.status]),
    ...m.headline.perspectives.map((p) => csvRow([p.name, p.score, p.status])), '',
    csvRow(['Departments']), csvRow(['Department', ...m.perspectiveNames, 'Overall', 'Status']),
    ...m.departmentRows.map((d) => csvRow([d.name, ...d.scores, d.overall, d.status])), '',
    csvRow(['KPI detail']), csvRow(['Department', 'Perspective', 'Measure', 'Weight', 'Target', 'Actual', 'Achievement', 'Status']),
    ...m.kpiRows.map((k) => csvRow([k.department, k.perspective, k.measure, k.weight, k.target, k.actual, k.achievement, k.status])),
  ]
  return `﻿${lines.join('\r\n')}`
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`

export function summaryToHtml(m) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.title)} · ${esc(m.periodLabel)}</title>
<style>
@page { size: A4 landscape; margin: 14mm; }
body { font: 12px/1.4 system-ui, sans-serif; color: #111827; }
h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 18px 0 6px; color: #1E4DFF; }
.meta { color: #6b7280; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f9fafb; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
tr { page-break-inside: avoid; }
</style></head><body>
<h1>${esc(m.title)}</h1>
<div class="meta">${esc(m.periodLabel)} · Generated ${esc(m.generatedAt)} by ${esc(m.generatedBy)}</div>
<h2>Company scorecard · overall ${esc(m.headline.overall)} (${esc(m.headline.status)})</h2>
${table(['Perspective', 'Score', 'Status'], m.headline.perspectives.map((p) => [p.name, p.score, p.status]))}
<h2>Departments</h2>
${table(['Department', ...m.perspectiveNames, 'Overall', 'Status'], m.departmentRows.map((d) => [d.name, ...d.scores, d.overall, d.status]))}
<h2>KPI detail</h2>
${table(['Department', 'Perspective', 'Measure', 'Weight', 'Target', 'Actual', 'Achievement', 'Status'], m.kpiRows.map((k) => [k.department, k.perspective, k.measure, k.weight, k.target, k.actual, k.achievement, k.status]))}
</body></html>`
}
