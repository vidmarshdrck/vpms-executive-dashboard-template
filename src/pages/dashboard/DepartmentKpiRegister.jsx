import { useState } from 'react'
import { departments } from '../../data/scorecardData.js'
import { QUARTERS, quarterOfDate } from '../../lib/reportingPeriod.js'
import { useKpiSetup } from '../../lib/useKpiSetup.js'
import { useKpiSubmissionsVersion } from '../../lib/useKpiSubmissionsVersion.js'
import { kpiPeriod, KPI_SOURCES } from '../../lib/kpiSetup.js'
import { getPublishedKpiValue } from '../../lib/kpiSubmissions.js'
import { kpiAchievement } from '../../lib/scorecard.js'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
const field = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900'
const number = value => value === null || value === undefined ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
export default function DepartmentKpiRegister() {
  const store = useKpiSetup()
  useKpiSubmissionsVersion()
  const [departmentId, setDepartmentId] = useState('finance'), [year, setYear] = useState(new Date().getFullYear()), [quarter, setQuarter] = useState(quarterOfDate())
  const validYear = Number.isInteger(Number(year)) && Number(year) >= 2000 && Number(year) <= 2100
  const period = validYear ? kpiPeriod(year, quarter) : null
  const activation = period && store.activations[`${departmentId}::${period}`]
  return <Card><CardHeader><CardTitle>Department KPI register</CardTitle><p className="mt-1 text-sm text-slate-600">Activated targets and approved actuals for each reporting quarter. The GM manages definitions and activation in KPI setup.</p></CardHeader><CardContent className="space-y-4">
    <InlineMessage tone="negative">{store.error}</InlineMessage>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700">Department<select aria-label="Register department" value={departmentId} onChange={event => setDepartmentId(event.target.value)} className={field}>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Year<input aria-label="Register year" type="number" min={2000} max={2100} value={year} onChange={event => setYear(event.target.value)} className={field} /></label><label className="text-sm font-medium text-slate-700">Quarter<select aria-label="Register quarter" value={quarter} onChange={event => setQuarter(event.target.value)} className={field}>{QUARTERS.map(item => <option key={item}>{item}</option>)}</select></label></div>
    {activation ? <><p className="text-sm text-green-900">{period} · Active · {activation.kpis.length} KPIs</p><div className="table-wrap"><table className="dashboard-table"><thead><tr><th>KPI</th><th>Target</th><th>Approved actual</th><th>Achievement</th><th>Data source</th></tr></thead><tbody>{activation.kpis.map(kpi => {
      const actual = getPublishedKpiValue(departmentId, kpi.code, period)?.value ?? null
      const achievement = kpiAchievement(actual, kpi.target, kpi.direction)
      return <tr key={kpi.code}><td className="min-w-48 font-medium">{kpi.name}</td><td className="whitespace-nowrap">{number(kpi.target)} {kpi.unit}</td><td className="whitespace-nowrap">{actual === null ? 'Awaiting approval' : `${number(actual)} ${kpi.unit}`}</td><td>{achievement === null ? '—' : `${number(achievement)}%`}</td><td className="min-w-40">{KPI_SOURCES.find(source => source.id === kpi.source)?.label || 'Department enters actual'}</td></tr>
    })}</tbody></table></div></> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{validYear ? 'No KPIs activated for this department and quarter.' : 'Choose a year from 2000 to 2100.'}</p>}
  </CardContent></Card>
}
