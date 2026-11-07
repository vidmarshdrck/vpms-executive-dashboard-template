import { operatingDepartments, kpisForDepartment, departmentAverage, deptAccent, ragFor, ragLabel, formatWeight, formatNum, formatPct } from './score.js'
import { ScoreGauge, PageFooter } from './Donut.jsx'

export function Departments({ scorecard, onOpen }) {
  const departments = operatingDepartments(scorecard.departments)
  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <p className="brand-eyebrow">Vidmar Holdings</p>
          <h1>Departments</h1>
          <p className="sub">Select a department to view its Balanced Scorecard heat map.</p>
        </div>
      </div>
      <div className="grid-3">
        {departments.map((department) => {
          const stat = departmentAverage(scorecard.kpis, department.code)
          const rag = stat.pct == null ? 'na' : ragFor(stat.pct)
          return (
            <button key={department.code} type="button" className="card-link" onClick={() => onOpen(department.code)}>
              <section className={`card accent-${deptAccent(department.code)}`}>
                <div className="card-head"><h2>{department.name}</h2></div>
                <div className="card-body">
                  {stat.pct == null ? <p className="stat-desc">No data entered yet.</p> : <><div className="stat-tile"><span className="stat-num" style={{ fontSize: 30 }}>{Math.round(stat.pct)}%</span></div><p className="stat-desc"><span className={`chip ${rag}`}>{ragLabel(rag)}</span> · based on {stat.count} KPI(s) with data</p></>}
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

export function DepartmentHeatMap({ scorecard, code }) {
  const department = scorecard.departments.find((item) => item.code === code)
  if (!department) {
    return <div className="wrap"><div className="card"><div className="card-body"><p className="stat-desc">No department selected. Choose a department from the list.</p></div></div></div>
  }
  const grouped = kpisForDepartment(scorecard.kpis, department.code)
  const stat = departmentAverage(scorecard.kpis, department.code)
  const accent = deptAccent(department.code)
  const rag = stat.pct == null ? 'na' : ragFor(stat.pct)
  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <p className="brand-eyebrow">Vidmar Holdings · {department.name}</p>
          <h1>{department.name} Heat Map</h1>
          <p className="sub">Balanced Scorecard · {department.sheet || department.name}</p>
        </div>
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
                      <th>Milestone / Initiative</th><th>Measure</th><th>Weighting</th><th>Latest period</th><th>Target</th><th>Actual</th><th>Achievement</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kpis.map((kpi) => {
                      const status = ragFor(kpi.latestPct)
                      return (
                        <tr key={kpi.id}>
                          <td>{kpi.milestone && <strong>{kpi.milestone}</strong>}{kpi.milestone && kpi.initiative && <br />}{kpi.initiative && <span className="comment">{kpi.initiative}</span>}</td>
                          <td>{kpi.measure || '—'}</td>
                          <td>{kpi.weighting == null ? '—' : <span className="weighting-tag">{formatWeight(kpi.weighting)}</span>}</td>
                          <td>{kpi.latest ? `${kpi.latest.label} ${kpi.latest.year}` : '—'}</td>
                          <td>{formatNum(kpi.latest?.target)}</td>
                          <td>{formatNum(kpi.latest?.actual)}</td>
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
