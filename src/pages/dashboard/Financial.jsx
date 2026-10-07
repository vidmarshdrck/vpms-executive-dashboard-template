import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { monthlyRevenue, quarterlyRevenue, financialKPIs, formatKwacha } from '../../data/kpiData.js'
import { useReportingPeriod } from '../../lib/ReportingPeriodContext.jsx'
import { quartersInTimeframe } from '../../lib/reportingPeriod.js'
import { TrendingUp, DollarSign, Target } from 'lucide-react'

// Nulls (not-yet-reported quarters) are preserved rather than coerced to 0 —
// a `0` bar would visually claim "zero performance" for a quarter that
// simply has no data yet.
const finKPIChart = financialKPIs.map((k) => ({
  name: k.name.length > 25 ? k.name.substring(0, 25) + '…' : k.name,
  Q1: k.quarters.Q1 ?? null,
  Q2: k.quarters.Q2 ?? null,
  Q3: k.quarters.Q3 ?? null,
  Q4: k.quarters.Q4 ?? null,
  Target: k.target,
}))

// One distinct, legible colour per quarter, shared by every per-quarter
// chart on this page (KPI performance bars and the revenue split pie) so a
// given quarter is always the same colour wherever it appears here — the
// old palettes assigned colour by array position instead of quarter
// identity, so e.g. Q1 and Q3 both rendered red on the KPI chart while the
// pie used four different colours for the same quarters.
const QUARTER_COLOR = { Q1: '#B42318', Q2: '#2563B0', Q3: '#15803D', Q4: '#B7791F' }

export default function Financial() {
  const { filteredMonthlyRevenue, periodLabel, timeframe } = useReportingPeriod()
  const totalRevenue = monthlyRevenue.reduce((s, d) => s + d.revenue, 0)
  const q2Actual = quarterlyRevenue[1].actual
  const q2Target = quarterlyRevenue[1].target
  const q2Achievement = ((q2Actual / q2Target) * 100).toFixed(1)
  // Every quarter-level chart/table on this page follows the global
  // timeframe control in the header — the same source of truth every other
  // dashboard reads, so nothing here can disagree with what the header shows.
  const selectedQuarters = quartersInTimeframe(timeframe)
  const quarterlyRevenueInPeriod = quarterlyRevenue.filter((row) => selectedQuarters.includes(row.quarter))
  const reportedQuarters = quarterlyRevenueInPeriod.filter((row) => row.actual !== null && row.target !== null)
  const revenueSplit = reportedQuarters.map((row) => ({ name: row.quarter, value: row.actual }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Annual Revenue (YTD)</div>
                <div className="text-xl font-black text-[#1F2937]">{formatKwacha(totalRevenue, true)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Q2 Actual Revenue</div>
                <div className="text-xl font-black text-green-600">{formatKwacha(q2Actual, true)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Target size={20} className="text-yellow-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Q2 Target Achievement</div>
                <div className="text-xl font-black text-yellow-600">{q2Achievement}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><CardTitle>Monthly Revenue Trend (ZMW)</CardTitle><p className="text-xs text-slate-500 mt-1">{periodLabel}</p></div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredMonthlyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatKwacha(v, true)} width={60} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, name) => [formatKwacha(v, true), name]} />
              <Legend />
              <Line
                type="monotone"
                dataKey="estimated"
                name="Estimated"
                stroke="#94A3B8"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Actual"
                stroke="#B42318"
                strokeWidth={2.5}
                dot={{ fill: '#B42318', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quarterly Actual vs Target */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Revenue: Actual vs Target</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={quarterlyRevenueInPeriod} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tickFormatter={(v) => formatKwacha(v, true)} width={65} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip formatter={(v) => [formatKwacha(v, true)]} />
              <Legend />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
              <Bar dataKey="target" name="Target" fill="#1F2937" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#2563B0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Financial KPI Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Financial KPI Performance by Quarter</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={finKPIChart} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-10} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}%`]} />
              <Legend />
              <ReferenceLine y={100} stroke="#15803D" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 11, fill: '#15803D' }} />
              <Bar dataKey="Q1" name="Q1" fill={QUARTER_COLOR.Q1} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Q2" name="Q2" fill={QUARTER_COLOR.Q2} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Q3" name="Q3" fill={QUARTER_COLOR.Q3} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Q4" name="Q4" fill={QUARTER_COLOR.Q4} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Split by Quarter */}
      <Card>
        <CardHeader>
          <CardTitle>Actual Revenue Split by Quarter</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          {revenueSplit.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={revenueSplit} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {revenueSplit.map((entry) => <Cell key={entry.name} fill={QUARTER_COLOR[entry.name]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [formatKwacha(v, true), 'Actual revenue']} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2.5">
                {revenueSplit.map((entry) => {
                  const totalActual = revenueSplit.reduce((sum, row) => sum + row.value, 0)
                  const share = totalActual ? (entry.value / totalActual) * 100 : 0
                  return (
                    <li key={entry.name} className="flex items-center gap-2.5 text-[13px]">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: QUARTER_COLOR[entry.name] }} />
                      <span className="text-slate-600">{entry.name}: {share.toFixed(0)}% of revenue collected</span>
                      <span className="font-semibold tabular-nums text-slate-900">({formatKwacha(entry.value, true)})</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No approved quarterly revenue reported yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Revenue Detail</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Quarter</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Target</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Actual</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Achievement</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyRevenueInPeriod.map((row) => {
                  const hasData = row.target !== null && row.actual !== null
                  const achNum = hasData && row.target > 0 ? (row.actual / row.target) * 100 : null
                  const ach = !hasData ? 'No data' : row.target <= 0 ? 'N/A' : `${achNum.toFixed(1)}%`
                  return (
                    <tr key={row.quarter} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3 font-semibold text-[#1F2937]">{row.quarter}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{hasData ? formatKwacha(row.target, true) : '—'}</td>
                      <td className="py-3 px-3 text-right font-semibold text-[#1F2937]">{hasData ? formatKwacha(row.actual, true) : '—'}</td>
                      <td className={`py-3 px-3 text-right font-bold ${achNum === null ? 'text-gray-400' : achNum >= 97 ? 'text-green-600' : achNum >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {ach}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
