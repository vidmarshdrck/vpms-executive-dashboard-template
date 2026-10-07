import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { operationsChart, purchasing, safety } from '../../data/kpiData.js'
import { useReportingPeriod } from '../../lib/ReportingPeriodContext.jsx'
import { quartersInTimeframe } from '../../lib/reportingPeriod.js'
import { Package, Truck, Wrench, Users } from 'lucide-react'

const volumeFormatter = (v) => `${(v / 1000).toFixed(0)}K m³`
const volumeSplitColors = ['#B42318', '#1F2937']

export default function Operations() {
  // Every quarter-level chart/table on this page follows the same global
  // reporting-period control as every other dashboard (see the header).
  const { timeframe, periodLabel } = useReportingPeriod()
  const selectedQuarters = quartersInTimeframe(timeframe)
  const operationsInPeriod = operationsChart.filter((row) => selectedQuarters.includes(row.quarter))
  const purchasingInPeriod = purchasing.filter((row) => selectedQuarters.includes(row.quarter))

  // Real reported quarters only — the KPI totals above the charts are
  // presented as actuals, so demo/placeholder quarters (isDemo, see
  // kpiData.js) are excluded here even though the charts below show them.
  const reportedQuarters = operationsInPeriod.filter((row) => row.received !== null && row.distributed !== null && !row.isDemo)
  const totalReceived = reportedQuarters.reduce((s, d) => s + d.received, 0)
  const totalDistributed = reportedQuarters.reduce((s, d) => s + d.distributed, 0)
  // All quarters with a volume (real or demo) — used for the charts, which
  // mark demo quarters visually rather than excluding them.
  const quartersWithData = operationsInPeriod.filter((row) => row.received !== null && row.distributed !== null)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Package size={16} className="text-blue-500" />
                <span className="text-xs">Total Received</span>
              </div>
              <div className="text-2xl font-black text-[#1F2937]">
                {(totalReceived / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-400">m³ ({reportedQuarters.map((q) => q.quarter).join('+') || 'no data'})</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Truck size={16} className="text-green-500" />
                <span className="text-xs">Total Distributed</span>
              </div>
              <div className="text-2xl font-black text-[#1F2937]">
                {(totalDistributed / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-400">m³ ({reportedQuarters.map((q) => q.quarter).join('+') || 'no data'})</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Wrench size={16} className="text-yellow-500" />
                <span className="text-xs">Prev. Maintenance</span>
              </div>
              <div className="text-2xl font-black text-[#1F2937]">{safety.preventiveMaintenance}%</div>
              <div className="text-xs text-gray-400">
                vs {safety.prevMaintenancePrev}% last qtr
                <span className="ml-1 text-green-600">▲ {safety.preventiveMaintenance - safety.prevMaintenancePrev}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users size={16} className="text-[#1F2937]" />
                <span className="text-xs">Headcount</span>
              </div>
              <div className="text-2xl font-black text-[#1F2937]">{safety.totalEmployees}</div>
              <div className="text-xs text-gray-400">
                vs {safety.prevEmployees} prev qtr
                <span className="ml-1 text-red-500">▼ {safety.prevEmployees - safety.totalEmployees}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Product Received vs Distributed (m³)</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={operationsInPeriod} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="quarter" />
              <YAxis tickFormatter={volumeFormatter} width={65} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => [v === null ? 'No data' : `${v.toLocaleString()} m³`, name]} />
              <Bar dataKey="received" name="Product Received" fill="#B42318" radius={[4, 4, 0, 0]} />
              <Bar dataKey="distributed" name="Product Distributed" fill="#1F2937" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: volumeSplitColors[0] }} />Received</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: volumeSplitColors[1] }} />Distributed</span>
          </div>
        </CardContent>
      </Card>

      {/* Received/distributed split, one small donut per quarter */}
      <Card>
        <CardHeader>
          <CardTitle>Volume Split by Quarter</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Received vs distributed · {periodLabel}</p>
        </CardHeader>
        <CardContent>
          {quartersWithData.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quartersWithData.map((q) => {
                const split = [{ name: 'Received', value: q.received }, { name: 'Distributed', value: q.distributed }]
                return (
                  <div key={q.quarter}>
                    <p className="text-xs font-semibold text-slate-600 text-center mb-1">{q.quarter}</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={split} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                          {split.map((entry, index) => <Cell key={entry.name} fill={volumeSplitColors[index % volumeSplitColors.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, name) => [`${v.toLocaleString()} m³`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-center text-[11px] text-slate-500 -mt-2 space-y-0.5">
                      <div><span className="font-semibold text-slate-700">{volumeFormatter(q.received)}</span> received</div>
                      <div><span className="font-semibold text-slate-700">{volumeFormatter(q.distributed)}</span> distributed</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No reported quarter available yet.</p>
          )}
          <div className="flex items-center gap-4 mt-2 justify-center text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: volumeSplitColors[0] }} />Received</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: volumeSplitColors[1] }} />Distributed</span>
          </div>
        </CardContent>
      </Card>

      {/* Quarterly Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Volume Detail</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Quarter</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Received (m³)</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Distributed (m³)</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Net</th>
                </tr>
              </thead>
              <tbody>
                {operationsInPeriod.map((row) => {
                  const hasData = row.received !== null && row.distributed !== null
                  const net = hasData ? row.received - row.distributed : null
                  return (
                    <tr key={row.quarter} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3 font-semibold text-[#1F2937]">{row.quarter}</td>
                      <td className="py-3 px-3 text-right text-gray-700">{hasData ? `${row.received.toLocaleString()} m³` : '—'}</td>
                      <td className="py-3 px-3 text-right text-gray-700">{hasData ? `${row.distributed.toLocaleString()} m³` : '—'}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${net === null ? 'text-gray-400' : net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {net === null ? 'No data' : `${net >= 0 ? '+' : ''}${net.toFixed(2)} m³`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Purchasing */}
      <Card>
        <CardHeader>
          <CardTitle>Purchasing Budget (ZMW)</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {purchasingInPeriod.map((p) => (
              <div key={p.quarter} className="rounded-lg p-4 bg-gray-50">
                <div className="text-xs text-gray-500 mb-1">{p.quarter}</div>
                {p.amount !== null ? (
                  <>
                    <div className="text-xl font-black text-[#1F2937]">K{(p.amount / 1000000).toFixed(2)}M</div>
                    <div className="text-xs text-gray-400">ZMW {p.amount.toLocaleString()}</div>
                  </>
                ) : (
                  <div className="text-sm font-semibold text-gray-400">No data yet</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
