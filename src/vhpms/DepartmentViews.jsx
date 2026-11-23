import { operatingDepartments, kpisForDepartment, departmentAverage, deptAccent, ragFor, ragLabel, formatWeight, formatTarget, formatActual, formatPct, publicDepartmentName, presentScorecard } from './score.js'
import { ScoreGauge, PageFooter } from './Donut.jsx'
import { useReportingPeriod } from './TimeframePopover.jsx'
import { veKpiFigures } from './kpiLive.js'

export function Departments({ scorecard, workspace, onOpen }) {
  const period = useReportingPeriod()
  const presented = presentScorecard(scorecard, veKpiFigures(workspace, period))
  const departments = operatingDepartments(presented.departments)
  return (
    <div className="wrap">
      <div className="grid-3">
        {departments.map((department) => {
          const stat = departmentAverage(presented.kpis, department.code)
          const hasTarget = presented.kpis.some((kpi) => kpi.dept === department.code && (kpi.periods || []).some((period) => period.target != null))
          const rag = stat.pct == null ? 'na' : ragFor(stat.pct)
          return (
            <button key={department.code} type="button" className="card-link" onClick={() => onOpen(department.code)}>
              <section className={`card accent-${deptAccent(department.code)}`}>
                <div className="card-head"><h2>{publicDepartmentName(department)}</h2></div>
                <div className="card-body">
                  {stat.pct == null ? <p className="stat-desc">{hasTarget ? 'No actual yet' : 'No target set'}</p> : <><div className="stat-tile"><span className="stat-num" style={{ fontSize: 30 }}>{Math.round(stat.pct)}%</span></div><p className="stat-desc"><span className={`chip ${rag}`}>{ragLabel(rag)}</span> · based on {stat.count} KPI(s) with data</p></>}
                </div>
              </section>
            </button>
          )
        })}
      </div>
      <PageFooter />
    </div>
  )
}

export function DepartmentHeatMap({ scorecard, workspace, code }) {
  const period = useReportingPeriod()
  const presented = presentScorecard(scorecard, veKpiFigures(workspace, period))
  const department = presented.departments.find((item) => item.code === code)
  if (!department) {
    return <div className="wrap"><div className="card"><div className="card-body"><p className="stat-desc">No KPIs for this department.</p></div></div><PageFooter /></div>
  }
  const grouped = kpisForDepartment(presented.kpis, department.code)
  const stat = departmentAverage(presented.kpis, department.code)
  const accent = deptAccent(department.code)
  const rag = stat.pct == null ? 'na' : ragFor(stat.pct)
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="legend" aria-label="Performance status legend">
          <span><i className="dot" style={{ background: 'var(--rag-green)' }} />On target (≥100%)</span>
          <span><i className="dot" style={{ background: 'var(--rag-amber)' }} />Near target (90–99%)</span>
          <span><i className="dot" style={{ background: 'var(--rag-red)' }} />Off target (&lt;90%)</span>
          <span><i className="dot" style={{ background: 'var(--rag-na)' }} />No data yet</span>
        </div>
      </div>
      {stat.pct != null && (
        <section className={`card accent-${accent}`} style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ width: 220, maxWidth: '100%' }}><ScoreGauge pct={stat.pct} caption="Department performance" /></div>
            <div>
              <span className={`chip ${rag}`}>{ragLabel(rag)}</span>
              <p className="stat-desc" style={{ marginTop: 6 }}>Average of the latest reported achievement % across {stat.count} KPI(s) with data entered.</p>
            </div>
          </div>
        </section>
      )}
      {!grouped.length && <div className="card"><div className="card-body"><p className="stat-desc">No KPIs are defined yet for this department. An administrator can add them under Admin · KPIs.</p></div></div>}
      {grouped.map((group) => (
        <div key={group.perspective}>
          <h2 className="section-title">{group.perspective}</h2>
          <section className={`card accent-${accent}`}>
            <div className="card-body pad-0">
              <div className="tbl-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Measure</th><th>Unit</th><th>Weighting</th><th>Latest period</th><th>Target</th><th>Actual</th><th>Achievement</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kpis.map((kpi) => {
                      const status = ragFor(kpi.latestPct)
                      return (
                        <tr key={kpi.id}>
                          <td>{kpi.measure || '—'}</td>
                          <td>{kpi.unit || '—'}</td>
                          <td>{kpi.weighting == null ? '—' : <span className="weighting-tag">{formatWeight(kpi.weighting)}</span>}</td>
                          <td>{kpi.latest?.label ? `${kpi.latest.label} ${kpi.latest.year}` : (kpi.latest ? 'This period' : '—')}</td>
                          <td>{formatTarget(kpi.latest?.target, kpi.unit)}</td>
                          <td>{formatActual(kpi.latest?.actual, kpi.unit)}</td>
                          <td>{formatPct(kpi.latestPct)}</td>
                          <td><span className={`chip ${status}`}>{ragLabel(status)}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      ))}
      <PageFooter>Latest period is the most recent period with an actual value recorded.</PageFooter>
    </div>
  )
}
