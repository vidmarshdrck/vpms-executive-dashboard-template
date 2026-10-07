import { useMemo, useState } from 'react'
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, LabelList } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { DataStatus, StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { PerspectiveScore, Sparkline, LegendLabel } from '../../components/ui/Scorecard.jsx'
import { scoreStatus, formatScore } from '../../lib/scoreStatus.js'
import { PERSPECTIVES, MONTHS, REPORTED_MONTHS, departments, departmentSource } from '../../data/scorecardData.js'
import { scoreScorecard, periodAchievement, periodActual, kpiAchievement } from '../../lib/scorecard.js'
import { DEFAULT_KPI_THRESHOLDS } from '../../lib/kpiThresholds.js'
import { getHeatClass } from '../../data/kpiData.js'
import { useReportingPeriod } from '../../lib/ReportingPeriodContext.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { hasPermission } from '../../auth/permissions.js'

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

const green = DEFAULT_KPI_THRESHOLDS.greenAt

function scoreDepartment(department, months) {
  const kpis = department.kpis.map((kpi) => ({ ...kpi, achievement: periodAchievement(kpi, months) }))
  return { ...department, kpis, ...scoreScorecard(PERSPECTIVES, kpis) }
}

function formatValue(value, unit) {
  if (value === null || value === undefined) return '—'
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'LTIFR') return value.toFixed(2)
  return `${value.toFixed(1)} ${unit}`
}

function ChartTooltip({ active, payload, label, suffix = '%' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-800 mb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-slate-600 tabular-nums">
          <span className="w-2 h-2 rounded-sm" style={{ background: entry.color }} />
          {entry.name}: <span className="font-semibold text-slate-800">{entry.value === null ? '—' : `${entry.value.toFixed(1)}${suffix}`}</span>
        </div>
      ))}
    </div>
  )
}

// Value sits inside the bar end so it never collides with the target line.
function RankLabel({ x, y, width, height, value, index, rows, selectedId }) {
  const isSelected = rows[index]?.id === selectedId
  return (
    <text x={x + width - 8} y={y + height / 2} dy={4} textAnchor="end" fontSize={11} fontWeight={650} fill={isSelected ? '#FFFFFF' : '#1F2937'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value.toFixed(1)}%
    </text>
  )
}

export default function DepartmentScorecards() {
  const [selectedId, setSelectedId] = useState(null)
  // Department Heads and Staff are locked to their own department: no ranking,
  // no other departments' heat map (PMS guide, "Who's who").
  const { user } = useAuth()
  const lockedId = hasPermission(user, 'dashboard.department') ? user.departmentId : null
  // Reads the same global reporting-period control as every other
  // dashboard (see the header) — this page no longer has its own picker.
  // Department data only has REPORTED_MONTHS of real months, so the
  // selection is clamped to what's actually reported rather than showing
  // months that don't exist yet as zero.
  const { timeframe, periodLabel } = useReportingPeriod()
  const lastMonth = REPORTED_MONTHS - 1
  const months = useMemo(() => {
    const from = Math.min(timeframe.customFrom, lastMonth)
    const to = Math.min(Math.max(timeframe.customFrom, timeframe.customTo), lastMonth)
    return range(Math.min(from, to), Math.max(from, to))
  }, [timeframe, lastMonth])

  const scored = useMemo(() => departments.map((d) => scoreDepartment(d, months)), [months])
  const ranked = useMemo(() => [...scored].sort((a, b) => b.overall - a.overall), [scored])
  const selected = scored.find((d) => d.id === (lockedId ?? selectedId)) ?? ranked[0]
  const companyAverage = scored.reduce((sum, d) => sum + d.overall, 0) / scored.length
  const onTarget = scored.filter((d) => d.overall >= green).length

  // Month-by-month score for the selected department against the average of all departments.
  const trend = MONTHS.slice(0, REPORTED_MONTHS).map((month, i) => {
    const monthScores = departments.map((d) => scoreDepartment(d, [i]).overall)
    return {
      month,
      department: scoreDepartment(departments.find((d) => d.id === selected.id), [i]).overall,
      average: monthScores.reduce((a, b) => a + b, 0) / monthScores.length,
    }
  })

  const selectedStatus = scoreStatus(selected.overall)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{lockedId ? `My department · ${selected.name}` : 'Department scorecards'}</h2>
        <p className="text-sm text-slate-500">
          {lockedId
            ? `${user.role} · ${periodLabel}`
            : `${scored.length} departments · ${onTarget} on target · average ${formatScore(companyAverage)} · ${periodLabel}`}
        </p>
      </div>

      {!lockedId && <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Department ranking</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Overall score (average of KPI achievements). Select a bar to open that department.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={410}>
              <BarChart data={ranked} layout="vertical" margin={{ top: 14, right: 16, left: 4, bottom: 4 }} barCategoryGap={9}>
                <CartesianGrid horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={124} tick={{ fontSize: 11.5, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
                <ReferenceLine x={green} stroke="#15803D" strokeDasharray="4 4" label={{ value: 'On target', position: 'top', fontSize: 10, fill: '#15803D' }} />
                <Bar dataKey="overall" name="Overall score" radius={[0, 4, 4, 0]} maxBarSize={22} onClick={(entry) => setSelectedId(entry?.payload?.id ?? entry?.id)} className="cursor-pointer">
                  {ranked.map((d) => <Cell key={d.id} fill={d.id === selected.id ? '#B42318' : '#CBD5E1'} />)}
                  <LabelList dataKey="overall" content={(props) => <RankLabel {...props} selectedId={selected.id} rows={ranked} />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Heat map by perspective</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Colour shows status against target. Select a row to open that department.</p>
          </CardHeader>
          <CardContent>
            <div className="table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    {PERSPECTIVES.map((p) => <th key={p.key} className="text-center">{p.name}</th>)}
                    <th className="text-center">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((d) => (
                    <tr key={d.id} className={d.id === selected.id ? 'row-selected' : ''}>
                      <td className="font-medium text-slate-800 whitespace-nowrap py-1.5">{d.name}</td>
                      {[...PERSPECTIVES.map((p) => d.scores[p.key]), d.overall].map((value, i) => (
                        <td key={i} className="py-1 px-1">
                          <button type="button" onClick={() => setSelectedId(d.id)} className={`heat-button ${getHeatClass(value)}`} aria-label={`${d.name}: ${formatScore(value)}`}>
                            {formatScore(value, 0)}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>}

      <section className="space-y-4" aria-labelledby="department-detail">
        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${lockedId ? '' : 'border-t border-slate-200 pt-6'}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 id="department-detail" className="text-lg font-semibold text-slate-900">{selected.name}</h2>
            <span className="text-2xl font-bold tabular-nums text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{formatScore(selected.overall)}</span>
            <StatusBadge label={selectedStatus.label} tone={selectedStatus.badgeTone} />
          </div>
          <DataStatus source={departmentSource} period={periodLabel} isProvisional />
        </div>

        {/* RAG legend — same three bands and wording everywhere a status
            appears in this app, so a Dept Head reading only their own
            department sees the identical rule the GM and Board use. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--positive)' }} />On target (≥100%)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--warning)' }} />Near target (90–99%)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--negative)' }} />Off target (&lt;90%)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-300" />No data yet</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PERSPECTIVES.map((p) => (
            <PerspectiveScore key={p.key} perspective={p} score={selected.scores[p.key]} weightShare={selected.shares[p.key]} contribution={selected.contributions[p.key]} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Monthly score · {selected.name} against the company average</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="plainline" formatter={(value) => <LegendLabel value={value} />} />
                <ReferenceLine y={green} stroke="#15803D" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="average" name="All departments" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="department" name={selected.name} stroke="#B42318" strokeWidth={2} dot={{ r: 3, fill: '#B42318', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Grouped by perspective — one section per perspective, in the same
            layout as the department's own KPI tracking sheet, rather than one
            flat table with a Perspective column to scan for. */}
        {PERSPECTIVES.filter((p) => selected.kpis.some((k) => k.perspective === p.key)).map((perspective) => (
          <Card key={perspective.key}>
            <CardHeader>
              <CardTitle><span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ background: perspective.color }} />{perspective.name}</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Measure</th>
                      <th className="numeric">Weight</th>
                      <th className="numeric">Target</th>
                      <th className="numeric">Actual</th>
                      <th className="numeric">Achievement</th>
                      <th>Trend</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.kpis.filter((k) => k.perspective === perspective.key).map((kpi) => {
                      const kpiStatus = scoreStatus(kpi.achievement)
                      const monthly = kpi.actuals.slice(0, REPORTED_MONTHS).map((v) => kpiAchievement(v, kpi.target, kpi.direction))
                      return (
                        <tr key={kpi.code}>
                          <td className="text-slate-800 min-w-[220px]">
                            {kpi.name}
                            {kpi.direction === 'lower' && <span className="ml-1.5 text-[10.5px] text-slate-500 whitespace-nowrap">↓ lower is better</span>}
                          </td>
                          <td className="numeric">{kpi.weight}</td>
                          <td className="numeric">{formatValue(kpi.target, kpi.unit)}</td>
                          <td className="numeric font-semibold text-slate-800">{formatValue(periodActual(kpi, months), kpi.unit)}</td>
                          <td className="numeric font-semibold text-slate-800">{formatScore(kpi.achievement)}</td>
                          <td><Sparkline values={monthly} color={kpiStatus.color} /></td>
                          <td><StatusBadge label={kpiStatus.label} tone={kpiStatus.badgeTone} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
