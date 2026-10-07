import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { DataStatus, StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { ScoreGauge, PerspectiveScore, LegendLabel } from '../../components/ui/Scorecard.jsx'
import { scoreStatus, formatScore } from '../../lib/scoreStatus.js'
import { PERSPECTIVES, PERSPECTIVE_BY_KEY, gmScorecard } from '../../data/scorecardData.js'
import { companyInfo } from '../../data/kpiData.js'
import { scoreScorecard, ACHIEVEMENT_CAP } from '../../lib/scorecard.js'
import { Info } from 'lucide-react'

const { scores, overall, contributions, shares } = scoreScorecard(PERSPECTIVES, gmScorecard.kpis)

// Points each KPI adds to the overall score (its capped achievement divided by
// the number of KPIs). They add up to `overall`.
const kpiCount = gmScorecard.kpis.length
const kpiRows = gmScorecard.kpis.map((kpi) => {
  const perspective = PERSPECTIVE_BY_KEY[kpi.perspective]
  const capped = Math.min(kpi.achievement, ACHIEVEMENT_CAP)
  return { ...kpi, perspective, share: 100 / kpiCount, points: capped / kpiCount }
})

const pointsChart = PERSPECTIVES.map((p) => ({
  name: p.name,
  available: shares[p.key],
  earned: contributions[p.key],
}))

// The perspective leaving the most points on the table drives the headline.
const biggestGap = PERSPECTIVES
  .map((p) => ({ ...p, gap: shares[p.key] - contributions[p.key] }))
  .sort((a, b) => b.gap - a.gap)[0]

function PointsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-800 mb-1">{label}</div>
      <div className="text-slate-600 tabular-nums">Earned {row.earned.toFixed(1)} of {row.available.toFixed(0)} pts</div>
      <div className="text-slate-500 tabular-nums">Gap {(row.available - row.earned).toFixed(1)} pts</div>
    </div>
  )
}

export default function BalancedScorecard() {
  const status = scoreStatus(overall)

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="vpms-gradient rounded-xl p-5 sm:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <ScoreGauge value={overall} label="Overall score" showThreshold={false} />
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#B42318] mb-2">Balanced scorecard</p>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 leading-tight text-balance">
              {biggestGap.name} holds {Math.round(shares[biggestGap.key])}% of the KPIs and scores {formatScore(scores[biggestGap.key])}, which holds the overall score at {formatScore(overall)}.
            </h2>
            <p className="text-sm text-slate-500 mt-2 text-pretty">
              The overall score is the plain average of every KPI achievement, each capped at 150%. Weightings are shown for reference only.
              Closing half of the {biggestGap.name.toLowerCase()} gap would add {(biggestGap.gap / 2).toFixed(1)} points.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge label={status.label} tone={status.badgeTone} />
              <DataStatus source={gmScorecard.source} period={gmScorecard.period} isProvisional={companyInfo.dataIsProvisional} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PERSPECTIVES.map((p) => (
          <PerspectiveScore
            key={p.key}
            perspective={p}
            score={scores[p.key]}
            weightShare={shares[p.key]}
            contribution={contributions[p.key]}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Where the {formatScore(overall)} comes from</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Points each perspective could add to the overall score, and the points it earned</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pointsChart} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={34} tickFormatter={(v) => `${v}`} />
              <Tooltip content={<PointsTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
              <Legend iconType="square" formatter={(value) => <LegendLabel value={value} />} />
              <Bar dataKey="available" name="Points available" fill="#64748B" radius={[4, 4, 0, 0]} maxBarSize={44} />
              <Bar dataKey="earned" name="Points earned" fill="#B42318" radius={[4, 4, 0, 0]} maxBarSize={44}>
                <LabelList dataKey="earned" position="top" formatter={(v) => v.toFixed(1)} style={{ fontSize: 11, fill: '#1F2937', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weighted KPI scorecard</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Performance against target, share of the overall score, and points earned</p>
        </CardHeader>
        <CardContent>
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>KPI</th>
                  <th>Perspective</th>
                  <th className="numeric">Weight</th>
                  <th className="numeric">Performance</th>
                  <th className="numeric">Share of score</th>
                  <th className="numeric">Points</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {kpiRows.map((row) => {
                  const kpiStatus = scoreStatus(row.achievement)
                  return (
                    <tr key={row.code}>
                      <td className="font-semibold text-slate-700 whitespace-nowrap">{row.code}</td>
                      <td className="text-slate-800 min-w-[220px]">
                        {row.name}
                        {row.note && <p className="flex gap-1.5 text-[11px] text-slate-500 mt-1"><Info size={12} className="mt-0.5 shrink-0" />{row.note}</p>}
                      </td>
                      <td className="whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: row.perspective.color }} />{row.perspective.name}</span></td>
                      <td className="numeric">{row.weight}</td>
                      <td className="numeric font-semibold text-slate-800">{formatScore(row.achievement)}</td>
                      <td className="numeric">{row.share.toFixed(1)}%</td>
                      <td className="numeric font-semibold text-slate-800">{row.points.toFixed(2)}</td>
                      <td><StatusBadge label={kpiStatus.label} tone={kpiStatus.badgeTone} /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="font-black text-slate-800 border-t border-slate-200 py-3 px-3">Overall score</td>
                  <td className="numeric font-black text-slate-900 border-t border-slate-200 px-3">{overall.toFixed(2)}</td>
                  <td className="border-t border-slate-200" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
