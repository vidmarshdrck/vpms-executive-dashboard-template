import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Legend } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { TargetProgress } from '../../components/ui/KPIComparison.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import {
  projects, companyInfo, issues, quarterlyRevenue, formatKwacha, formatFigure,
  operationsChart, purchasing, safety,
  financialKPIs, customerKPIs, internalKPIs, learningKPIs,
} from '../../data/kpiData.js'
import { getKpiPerformance } from '../../lib/dashboardMetrics.js'
import { scoreScorecard } from '../../lib/scorecard.js'
import { scoreStatus } from '../../lib/scoreStatus.js'
import { PERSPECTIVES, gmScorecard } from '../../data/scorecardData.js'
import { PerspectiveScore } from '../../components/ui/Scorecard.jsx'
import { TONE_LABEL, classifyKpi } from '../../lib/kpiThresholds.js'
import { useReportingPeriod } from '../../lib/ReportingPeriodContext.jsx'
import { quartersInTimeframe } from '../../lib/reportingPeriod.js'
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Clock, Minus,
  ShieldCheck, TrendingUp, Users, Wrench,
} from 'lucide-react'

// Scores are derived live from the KPI data by the same engine as the
// Balanced scorecard page, so the donut below always adds up to the overall.
const { scores: perspectiveScores, overall: overallScore, contributions, shares } = scoreScorecard(PERSPECTIVES, gmScorecard.kpis)
const overallLabel = Math.round(overallScore * 10) / 10
const contributionSlices = [
  ...PERSPECTIVES.map((p) => ({ name: p.name, value: contributions[p.key], color: p.color })),
  { name: 'Gap to 100%', value: Math.max(0, 100 - overallScore), color: '#E2E8F0' },
]

// Overview scorecard table (GM brief format): perspective, current score,
// trend, and a comment. Trend and comment are both derived from the same
// data as the rest of the dashboard — no figures are invented for this
// table specifically.
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
function quarterAverage(kpis, quarter) {
  const values = kpis.map((k) => k.quarters?.[quarter]).filter((v) => v !== null && v !== undefined)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}
// Direction between the two most recently reported quarters for a
// perspective (not necessarily Q1 vs Q2 — whichever two quarters have data).
function perspectiveTrend(kpis) {
  const reported = QUARTERS.map((q) => quarterAverage(kpis, q)).filter((v) => v !== null)
  if (reported.length < 2) return null
  const delta = reported[reported.length - 1] - reported[reported.length - 2]
  if (Math.abs(delta) < 0.5) return 'flat'
  return delta > 0 ? 'up' : 'down'
}
const overviewRows = [
  { key: 'financial', label: 'Financial', kpis: financialKPIs },
  { key: 'customer', label: 'Customer', kpis: customerKPIs },
  { key: 'internal', label: 'Internal Processes', kpis: internalKPIs },
  { key: 'learning', label: 'Learning & Growth', kpis: learningKPIs },
].map((row) => ({
  ...row,
  color: PERSPECTIVES.find((p) => p.key === row.key)?.color,
  score: perspectiveScores[row.key],
  tone: classifyKpi(perspectiveScores[row.key]),
  trend: perspectiveTrend(row.kpis),
}))

// Projects donut: each project's share of total reported completion across
// all projects — computed from the same `completion` figures used by the
// per-project progress bars, not a separate budget/weight dataset.
const totalProjectCompletion = projects.reduce((sum, p) => sum + p.completion, 0)
const PROJECT_DONUT_COLORS = ['#C3DE9C', '#84B25A', '#2F6F45', '#D8A72E']
const projectShareSlices = projects.map((p, i) => ({
  name: p.name,
  value: totalProjectCompletion ? (p.completion / totalProjectCompletion) * 100 : 0,
  color: PROJECT_DONUT_COLORS[i % PROJECT_DONUT_COLORS.length],
}))
const allProjectsBehind = projects.every((p) => p.completion < p.target)

// Demo entry for the internal Performance Management System build itself —
// not part of the reported project portfolio (so it's kept out of
// `projects`/the donut above), shown here so Priority follow-through has
// something in the remaining space rather than sitting blank.
const pmsDemoProject = {
  name: 'Performance Management System (internal build)',
  completion: 92,
  target: 100,
  status: 'Final testing & UAT',
}

export default function Executive() {
  const { filteredMonthlyRevenue, periodLabel, timeframe } = useReportingPeriod()
  const priorityProjects = projects.filter((project) => getKpiPerformance(project.completion, project.target).tone !== 'green')

  // Every quarter-level chart/table on this page follows the same global
  // reporting-period control as every other dashboard (see the header).
  const selectedQuarters = quartersInTimeframe(timeframe)
  const operationsInPeriod = operationsChart.filter((row) => selectedQuarters.includes(row.quarter))
  const operationsQ1Q2 = operationsInPeriod.filter((r) => r.quarter === 'Q1' || r.quarter === 'Q2')
  const operationsQ3Q4 = operationsInPeriod.filter((r) => r.quarter === 'Q3' || r.quarter === 'Q4')
  // Purchasing — filtered to the selected quarters; within those, Q3/Q4 bars
  // simply don't render while `amount` is still null, and start appearing
  // the moment Finance reports them, with no chart changes needed.
  const purchasingInPeriod = purchasing.filter((row) => selectedQuarters.includes(row.quarter))

  // Quarterly revenue as paired Target/Actual horizontal bars, matching the
  // brief format, filtered to the selected quarters (Q3/Q4 within that
  // selection render blank until reported — same "ready but honest" pattern
  // as Purchasing above). Labelled "Revenue" (not "Profit") because that is
  // what quarterlyRevenue actually contains — there is no separate profit
  // figure in the source data yet.
  const revenueBars = quarterlyRevenue
    .filter((r) => selectedQuarters.includes(r.quarter))
    .flatMap((r) => [
      { label: `Target ${r.quarter}`, value: r.target, kind: 'target' },
      { label: `Actual ${r.quarter}`, value: r.actual, kind: 'actual' },
    ])

  // Actual/Target on the management brief are the real reported revenue
  // figures (ZMW, 2dp) — not the aggregate KPI percentage — summed across
  // whichever selected quarters have actually been reported. Demo/placeholder
  // quarters (isDemo, see kpiData.js) are deliberately excluded here even
  // though the charts below show them — this header figure is presented as
  // a real management total and must never be inflated by illustrative data.
  const reportedRevenue = quarterlyRevenue.filter((row) => selectedQuarters.includes(row.quarter) && row.actual !== null && row.target !== null && !row.isDemo)
  const totalActualRevenue = reportedRevenue.reduce((sum, row) => sum + row.actual, 0)
  const totalTargetRevenue = reportedRevenue.reduce((sum, row) => sum + row.target, 0)

  return <div className="space-y-6 animate-fade-in">
    <section className="vpms-gradient rounded-xl p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#B42318] mb-2">Management brief · {companyInfo.shortName}</p><h2 className="text-xl font-bold text-slate-900 mb-2">Energy security through reliable service delivery</h2><p className="text-sm leading-6 text-slate-600">{companyInfo.vision}</p></div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="hero-stat-label">Revenue actual</div><div className="hero-stat-value">{formatKwacha(totalActualRevenue, true)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Revenue target</div><div className="hero-stat-value is-muted">{formatKwacha(totalTargetRevenue, true)}</div></div>
          <div className="hero-score">
            <div className="hero-stat-label whitespace-nowrap">Overall score</div>
            <div className="hero-score-value" style={{ color: scoreStatus(overallScore).color }}>{overallLabel}<span>%</span></div>
          </div>
        </div>
      </div>
    </section>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {PERSPECTIVES.map((p) => (
        <Link key={p.key} to="/scorecard" className="perspective-link block rounded-[10px]" aria-label={`${p.name} on the Balanced scorecard`}>
          <PerspectiveScore perspective={p} score={perspectiveScores[p.key]} weightShare={shares[p.key]} contribution={contributions[p.key]} />
        </Link>
      ))}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_.75fr] gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp size={16} className="text-[#B42318]" />Revenue trend · ZMW</CardTitle>
            <p className="text-xs text-slate-500 mt-1">{periodLabel} · sample figures from the workbook template, pending Finance</p>
          </CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={250}><LineChart data={filteredMonthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}><CartesianGrid vertical={false} stroke="#F1F5F9" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} /><YAxis tickFormatter={(v) => formatKwacha(v, true)} tick={{ fontSize: 10, fill: '#64748B' }} width={55} /><Tooltip formatter={(v) => [formatKwacha(v, true), 'Actual']} /><Line type="monotone" dataKey="revenue" name="Actual" stroke="#B42318" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>How the overall score is built</CardTitle><p className="text-xs text-slate-500 mt-1">Points each perspective adds to the {overallLabel}% overall score, </p></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-center">
              <div className="relative h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={contributionSlices} dataKey="value" nameKey="name" innerRadius={66} outerRadius={96} paddingAngle={1.5} startAngle={90} endAngle={-270} stroke="#FFFFFF" strokeWidth={2}>
                      {contributionSlices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v.toFixed(1)} pts`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{overallLabel}%</span>
                  <span className="text-[11px] text-slate-500">overall</span>
                </div>
              </div>
              <ul className="space-y-2.5">
                {contributionSlices.map((slice) => (
                  <li key={slice.name} className="flex items-center gap-2.5 text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: slice.color, outline: slice.color === '#E2E8F0' ? '1px solid #CBD5E1' : 'none' }} />
                    <span className="text-slate-600 flex-1">{slice.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{slice.value.toFixed(1)} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="flex flex-col">
        <CardHeader><CardTitle>Priority follow-through</CardTitle><p className="text-xs text-slate-500 mt-1">Items requiring management attention</p></CardHeader>
        <CardContent className="flex-1 flex flex-col"><div className="space-y-4 flex-1">{[...priorityProjects, pmsDemoProject].map((project) => { const perf = getKpiPerformance(project.completion, project.target); return <div key={project.name} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-800">{project.name}</div><div className="text-xs text-slate-500 mt-1">{project.status} · {project.completion}% complete</div></div><StatusBadge label={TONE_LABEL[perf.tone]} tone={perf.badgeTone} /></div><TargetProgress actual={project.completion} target={project.target} format={(value) => `${value}%`} showStatus={false} /></div> })}</div><a href="/projects" className="inline-flex items-center gap-2 text-xs font-bold text-[#B42318] hover:underline mt-4">Open projects & actions <ArrowRight size={14} /></a></CardContent>
      </Card>
    </div>
    {/* GM brief format: Overview scorecard, Operations, Projects, Purchasing,
        Quarterly revenue, and the Safety/HR/Engineering narrative lines the
        GM asked to see on the Executive overview. */}
    <Card>
      <CardHeader><CardTitle>Overview</CardTitle><p className="text-xs text-slate-500 mt-1">Current score, trend since the prior reported quarter, and status per perspective</p></CardHeader>
      <CardContent>
        <div className="table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Perspective</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Performance</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Trend</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Comment</th>
              </tr>
            </thead>
            <tbody>
              {overviewRows.map((row) => {
                const TrendIcon = row.trend === 'up' ? ArrowUpRight : row.trend === 'down' ? ArrowDownRight : Minus
                return (
                  <tr key={row.key} className="border-b border-gray-50">
                    <td className="py-2.5 px-3 text-sm font-medium text-gray-800"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: row.color }} />{row.label}</td>
                    <td className={`py-2.5 px-3 text-center text-xs font-bold rounded heat-${row.tone}`}>{row.score}%</td>
                    <td className="py-2.5 px-3 text-center">
                      {row.trend ? <TrendIcon size={14} className={`inline ${row.trend === 'up' ? 'text-green-600' : row.trend === 'down' ? 'text-red-600' : 'text-gray-400'}`} /> : <span className="text-gray-300">–</span>}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{TONE_LABEL[row.tone]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <Card>
        <CardHeader><CardTitle>Operations · Product received vs distributed (m³)</CardTitle><p className="text-xs text-slate-500 mt-1">{periodLabel}</p></CardHeader>
        <CardContent>
          {operationsQ1Q2.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={operationsQ1Q2} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748B' }} width={45} />
                <Tooltip formatter={(v, name) => [`${v.toLocaleString()} m³`, name]} />
                <Bar dataKey="received" name="Received" fill="#B42318" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="received" position="top" formatter={formatFigure} style={{ fontSize: 10, fill: '#475569' }} />
                </Bar>
                <Bar dataKey="distributed" name="Distributed" fill="#1F2937" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="distributed" position="top" formatter={formatFigure} style={{ fontSize: 10, fill: '#475569' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-500">No Q1/Q2 data in the selected period.</p>
          )}
          {operationsQ3Q4.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={operationsQ3Q4} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748B' }} width={45} />
                  <Tooltip formatter={(v, name) => [v === null ? 'No data yet' : `${v.toLocaleString()} m³`, name]} />
                  <Bar dataKey="received" name="Received" fill="#B42318" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="received" position="top" formatter={(v) => (v === null || v === undefined ? '' : formatFigure(v))} style={{ fontSize: 10, fill: '#475569' }} />
                  </Bar>
                  <Bar dataKey="distributed" name="Distributed" fill="#1F2937" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="distributed" position="top" formatter={(v) => (v === null || v === undefined ? '' : formatFigure(v))} style={{ fontSize: 10, fill: '#475569' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <Link to="/operations" className="inline-flex items-center gap-2 text-xs font-bold text-[#B42318] hover:underline mt-3">Open Operations detail <ArrowRight size={14} /></Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Projects</CardTitle><p className="text-xs text-slate-500 mt-1">{allProjectsBehind ? 'All projects are behind schedule' : 'Project delivery status'}</p></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-center mb-5">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={projectShareSlices} dataKey="value" nameKey="name" innerRadius={40} outerRadius={72} paddingAngle={1.5}>
                    {projectShareSlices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v.toFixed(0)}%`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {projectShareSlices.map((slice) => (
                <li key={slice.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: slice.color }} />
                  <span className="text-slate-600 flex-1">{slice.name}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{slice.value.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.name}>
                <div className="text-xs font-semibold text-slate-700 mb-1">{project.name}</div>
                <TargetProgress actual={project.completion} target={project.target} format={(v) => `${v}%`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Purchasing, then Quarterly revenue stacked below it — both full width. */}
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Purchasing: Budget vs Spent (ZMW)</CardTitle><p className="text-xs text-slate-500 mt-1">{periodLabel}{purchasingInPeriod.every((row) => row.budget === null) ? ' · Budget not yet supplied by Procurement' : ''}</p></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={purchasingInPeriod} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tickFormatter={(v) => formatKwacha(v, true)} tick={{ fontSize: 10, fill: '#64748B' }} width={55} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => [v === null || v === undefined ? 'Not supplied yet' : formatKwacha(v), name]} />
              <Bar dataKey="budget" name="Budget" fill="#1F2937" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="budget" position="top" formatter={(v) => (v === null || v === undefined ? '' : formatKwacha(v, true))} style={{ fontSize: 10, fill: '#475569' }} />
              </Bar>
              <Bar dataKey="amount" name="Spent" fill="#2563B0" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="amount" position="top" formatter={(v) => (v === null || v === undefined ? '' : formatKwacha(v, true))} style={{ fontSize: 10, fill: '#475569' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Quarterly Revenue: Target vs Actual</CardTitle><p className="text-xs text-slate-500 mt-1">ZMW · {periodLabel}</p></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueBars} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid horizontal={false} stroke="#F1F5F9" />
              <XAxis type="number" tickFormatter={(v) => formatKwacha(v, true)} tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip formatter={(v) => [v === null ? 'No data yet' : formatKwacha(v), 'Revenue']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {revenueBars.map((bar) => <Cell key={bar.label} fill={bar.kind === 'target' ? '#1F2937' : '#2563B0'} />)}
                <LabelList dataKey="value" position="right" formatter={(v) => (v === null || v === undefined ? '' : formatKwacha(v, true))} style={{ fontSize: 10, fill: '#475569' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    {/* Bottom of page: narrative remarks and the issue/employee tiles together. */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#15803D]" /><CardTitle>Safety</CardTitle></div></CardHeader>
        <CardContent><p className="text-sm leading-6 text-slate-700">{safety.narrative}</p></CardContent>
      </Card>
      <Card>
        <CardHeader><div className="flex items-center gap-2"><Users size={16} className="text-slate-500" /><CardTitle>Human Resource</CardTitle></div></CardHeader>
        <CardContent><p className="text-sm leading-6 text-slate-700">The total number of employees at the end of the quarter was {companyInfo.employees}, compared to {companyInfo.employeesPrev} in the previous quarter.</p></CardContent>
      </Card>
      <Card>
        <CardHeader><div className="flex items-center gap-2"><Wrench size={16} className="text-[#B45309]" /><CardTitle>Engineering</CardTitle></div></CardHeader>
        <CardContent><p className="text-sm leading-6 text-slate-700">Preventive maintenance achieved a level of {safety.preventiveMaintenance}%, compared to {safety.prevMaintenancePrev}% in the last quarter.</p></CardContent>
      </Card>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[[AlertTriangle, issues.unresolved, 'Unresolved issues', 'negative'], [Clock, issues.revisions, 'Revisions required', 'warning'], [CheckCircle2, issues.pendingActions, 'Pending actions', 'neutral'], [Users, companyInfo.employees, 'Employees', 'positive']].map(([Icon, value, label, tone]) => <Card key={label}><CardContent className="pt-5"><div className="flex items-center gap-3"><Icon size={18} className={tone === 'negative' ? 'text-[#B91C1C]' : tone === 'warning' ? 'text-[#B45309]' : tone === 'positive' ? 'text-[#15803D]' : 'text-slate-500'} /><div><div className="text-2xl font-black tabular-nums text-slate-900">{value}</div><div className="text-xs text-slate-500">{label}</div></div></div></CardContent></Card>)}</div>
  </div>
}
