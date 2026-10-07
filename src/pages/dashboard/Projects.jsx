import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { TargetProgress } from '../../components/ui/KPIComparison.jsx'
import { projects, issues } from '../../data/kpiData.js'
import { getPriorityFromDeadline } from '../../lib/dashboardMetrics.js'
import { AlertTriangle, CheckCircle2, Clock, RotateCcw } from 'lucide-react'

const actionRows = [
  ['Unresolved issues', issues.unresolved, 'High', 'negative', AlertTriangle],
  ['Revisions required', issues.revisions, 'Medium', 'warning', RotateCcw],
  ['Pending actions', issues.pendingActions, 'Normal', 'neutral', Clock],
]

const statusColors = ['#B42318', '#1F2937', '#B45309', '#94A3B8', '#15803D']

export default function Projects() {
  const totalIssues = issues.unresolved + issues.revisions + issues.pendingActions
  const statusCounts = projects.reduce((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1
    return acc
  }, {})
  const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
  // Only departments that actually own a project — a department with zero
  // projects (or one only tracked by spend, not delivery) has nothing to
  // plot here.
  const departmentCounts = projects.reduce((acc, project) => {
    acc[project.department] = (acc[project.department] || 0) + 1
    return acc
  }, {})
  const projectsByDepartment = Object.entries(departmentCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return <div className="space-y-6 animate-fade-in">
    <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#B42318]">Delivery control</p><h2 className="text-xl font-bold text-slate-900 mt-1">Projects & actions</h2><p className="text-sm text-slate-500 mt-1">Where each project stands, and what needs attention next.</p></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[[AlertTriangle, issues.unresolved, 'Unresolved issues', 'negative'], [RotateCcw, issues.revisions, 'Revisions required', 'warning'], [Clock, issues.pendingActions, 'Pending actions', 'neutral'], [CheckCircle2, totalIssues, 'Open items', 'neutral']].map(([Icon, value, label, tone]) => <Card key={label}><CardContent className="pt-5"><Icon size={18} className={tone === 'negative' ? 'text-[#B91C1C]' : tone === 'warning' ? 'text-[#B45309]' : 'text-slate-500'} /><div className="text-2xl font-black tabular-nums text-slate-900 mt-2">{value}</div><div className="text-xs text-slate-500">{label}</div></CardContent></Card>)}</div>
    <div className="grid grid-cols-1 xl:grid-cols-[.75fr_1.25fr] gap-6">
      <Card>
        <CardHeader><CardTitle>Projects by lifecycle status</CardTitle><p className="text-xs text-slate-500 mt-1">Distribution of the current project register</p></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {statusDistribution.map((entry, index) => <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />)}
              </Pie>
              <Tooltip formatter={(v, _n, item) => [`${v} project${v === 1 ? '' : 's'}`, item.payload.name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600 mb-2">Projects by department</p>
            <ResponsiveContainer width="100%" height={Math.max(120, projectsByDepartment.length * 36)}>
              <BarChart data={projectsByDepartment} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v) => [`${v} project${v === 1 ? '' : 's'}`, 'Projects']} />
                <Bar dataKey="count" name="Projects" fill="#B42318" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Project delivery register</CardTitle><p className="text-xs text-slate-500 mt-1">Sorted by priority — the closer the deadline, the higher the priority.</p></CardHeader><CardContent><div className="space-y-5">{[...projects].sort((a, b) => getPriorityFromDeadline(a.deadline).daysUntil - getPriorityFromDeadline(b.deadline).daysUntil).map((project) => { const priority = getPriorityFromDeadline(project.deadline); const dueDate = new Date(project.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); return <div key={project.name} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><div className="text-sm font-semibold text-slate-800">{project.name}</div><div className="text-xs text-slate-500 mt-1">Lifecycle: <span className="font-semibold text-slate-700">{project.status}</span> · Due {dueDate}</div></div><div className="flex items-center gap-2"><StatusBadge label={`${priority.label} priority`} tone={priority.tone} /><span className="text-lg font-black tabular-nums text-slate-900">{project.completion}%</span></div></div><TargetProgress actual={project.completion} target={project.target} format={(value) => `${value}%`} /></div> })}</div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Action queue</CardTitle><p className="text-xs text-slate-500 mt-1">Open items from the latest management report.</p></CardHeader><CardContent><div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Category</th><th className="numeric">Count</th><th className="numeric">Priority</th></tr></thead><tbody>{actionRows.map(([label, count, priority, tone, Icon]) => <tr key={label}><td><span className="inline-flex items-center gap-2"><Icon size={14} />{label}</span></td><td className="numeric font-bold text-slate-900">{count}</td><td className="numeric"><StatusBadge label={priority} tone={tone} /></td></tr>)}</tbody><tfoot><tr><td className="font-black text-slate-800">Total open items</td><td className="numeric font-black text-slate-900">{totalIssues}</td><td /></tr></tfoot></table></div></CardContent></Card>
  </div>
}
