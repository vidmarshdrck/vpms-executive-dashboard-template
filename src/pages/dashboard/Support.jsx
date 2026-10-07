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
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { classifyKpi, TONE_TO_BADGE_TONE, TONE_LABEL } from '../../lib/kpiThresholds.js'
import { useReportingPeriod } from '../../lib/ReportingPeriodContext.jsx'
import { filterSeriesByTimeframe, describeTimeframe } from '../../lib/reportingPeriod.js'
import {
  summary,
  monthlyTicketVolume,
  ticketsByPriority,
  ticketsByCategory,
  ticketsByDepartment,
  slaCompliance,
} from '../../data/supportData.js'
import { Ticket, Inbox, CheckCircle2, Timer, ShieldAlert } from 'lucide-react'

// Index 3 (Low priority) was #94A3B8, too pale against a white background —
// darkened to a legible slate.
const PALETTE = ['#B42318', '#1F2937', '#B45309', '#475569', '#15803D', '#0EA5E9', '#7C3AED', '#DB2777', '#65A30D']

const slaComplianceTone = classifyKpi(slaCompliance.percent)

const slaSplit = [
  { name: 'Within SLA', value: slaCompliance.withinSla },
  { name: 'Breached', value: slaCompliance.breached },
]
const slaSplitColors = ['#15803D', '#B91C1C']

export default function Support() {
  // The helpdesk trend reuses the same shared timeframe selection (Last
  // quarter / Current quarter / Custom) as the rest of the dashboard, but
  // applies it to ticket volume instead of revenue — filtering is done
  // locally rather than through the revenue-specific context value.
  const { timeframe } = useReportingPeriod()
  const filteredTicketVolume = filterSeriesByTimeframe(monthlyTicketVolume, timeframe)
  const periodLabel = describeTimeframe(monthlyTicketVolume, timeframe)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Ticket size={18} className="text-slate-500" />
              <div><div className="text-2xl font-black tabular-nums text-slate-900">{summary.totalTickets}</div><div className="text-xs text-slate-500">Total tickets</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Inbox size={18} className="text-[#B45309]" />
              <div><div className="text-2xl font-black tabular-nums text-slate-900">{summary.open}</div><div className="text-xs text-slate-500">Open</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-[#15803D]" />
              <div><div className="text-2xl font-black tabular-nums text-slate-900">{summary.closed}</div><div className="text-xs text-slate-500">Closed</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Timer size={18} className="text-slate-500" />
              <div><div className="text-2xl font-black tabular-nums text-slate-900">{summary.avgResolutionHours}h</div><div className="text-xs text-slate-500">Avg. resolution</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <ShieldAlert size={18} className="text-slate-500" />
              <div>
                <div className="flex items-center gap-2"><span className="text-2xl font-black tabular-nums text-slate-900">{slaCompliance.percent}%</span><StatusBadge label={TONE_LABEL[slaComplianceTone]} tone={TONE_TO_BADGE_TONE[slaComplianceTone]} /></div>
                <div className="text-xs text-slate-500">SLA compliance</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket volume trend */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket volume trend</CardTitle><p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={filteredTicketVolume} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} width={35} allowDecimals={false} />
              <Tooltip formatter={(v) => [v === null ? 'No data' : v, 'Tickets']} />
              <Line type="monotone" dataKey="tickets" name="Tickets logged" stroke="#B42318" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Priority distribution */}
        <Card>
          <CardHeader><CardTitle>Tickets by priority</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={ticketsByPriority} dataKey="count" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {ticketsByPriority.map((entry, index) => <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v, _n, p) => [`${v} tickets (SLA ${p.payload.slaHours}h)`, p.payload.name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* SLA compliance */}
        <Card>
          <CardHeader><CardTitle>SLA compliance</CardTitle><p className="text-xs text-slate-500 mt-1">Resolved within vs. outside the priority&apos;s SLA window</p></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={slaSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {slaSplit.map((entry, index) => <Cell key={entry.name} fill={slaSplitColors[index % slaSplitColors.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} tickets`, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card>
        <CardHeader><CardTitle>Tickets by category</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ticketsByCategory} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Tickets" fill="#B42318" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Department breakdown */}
      <Card>
        <CardHeader><CardTitle>Tickets by department</CardTitle><p className="text-xs text-slate-500 mt-1">Most tickets at the top, fewest at the bottom</p></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ticketsByDepartment} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Bar dataKey="count" name="Tickets" fill="#1F2937" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Same department breakdown, as a share of total tickets */}
      <Card>
        <CardHeader><CardTitle>Tickets by department — share of total</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ticketsByDepartment} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {ticketsByDepartment.map((entry, index) => <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v} tickets`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {ticketsByDepartment.map((entry, index) => {
                const total = ticketsByDepartment.reduce((sum, row) => sum + row.count, 0)
                const share = total ? (entry.count / total) * 100 : 0
                return (
                  <li key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[index % PALETTE.length] }} />
                    <span className="text-slate-600 flex-1">{entry.name}</span>
                    <span className="text-slate-400">{share.toFixed(0)}%</span>
                    <span className="font-semibold tabular-nums text-slate-900 w-8 text-right">{entry.count}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Priority / SLA detail table */}
      <Card>
        <CardHeader><CardTitle>Priority &amp; SLA detail</CardTitle></CardHeader>
        <CardContent>
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                  <th className="numeric py-2 px-3 text-xs font-semibold text-gray-500 uppercase">SLA window</th>
                  <th className="numeric py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Tickets</th>
                  <th className="numeric py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Within SLA</th>
                  <th className="numeric py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {ticketsByPriority.map((row) => {
                  const compliance = Number(((row.withinSla / row.count) * 100).toFixed(1))
                  const tone = classifyKpi(compliance)
                  return (
                    <tr key={row.name} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3 font-semibold text-[#1F2937]">{row.name}</td>
                      <td className="numeric py-3 px-3 text-gray-600">{row.slaHours}h</td>
                      <td className="numeric py-3 px-3 text-gray-700">{row.count}</td>
                      <td className="numeric py-3 px-3 text-gray-700">{row.withinSla} / {row.count}</td>
                      <td className="numeric py-3 px-3"><StatusBadge label={`${compliance}% · ${TONE_LABEL[tone]}`} tone={TONE_TO_BADGE_TONE[tone]} /></td>
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
