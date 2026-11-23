import { useState } from 'react'
import { kpisForDepartment, deptAccent, formatTarget, formatActual, formatPct, publicDepartmentName, operatingDepartments, presentScorecard, seesEveryKpi, kpiDepartment } from './score.js'
import { PageFooter } from './Donut.jsx'
import { useReportingPeriod } from './TimeframePopover.jsx'
import { veKpiFigures } from './kpiLive.js'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function KpiEntry({ scorecard, user, workspace, viewOnly, onSave }) {
  const period = useReportingPeriod()
  const presented = presentScorecard(scorecard, veKpiFigures(workspace, period))
  const groups = operatingDepartments(presented.departments)
  const all = seesEveryKpi(user)
  const fixed = kpiDepartment(user, presented.departments)
  const [business, setBusiness] = useState(all ? (groups[0]?.code || '') : fixed)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [kpiId, setKpiId] = useState('')
  const department = presented.departments.find((item) => item.code === (all ? business : fixed))
  if (!department) {
    return <div className="wrap"><div className="card"><div className="card-body"><p className="stat-desc">Your account is not linked to a business, so there is nothing to enter here. Ask an administrator to assign one.</p></div></div><PageFooter /></div>
  }
  const kpis = kpisForDepartment(presented.kpis, department.code).flatMap((group) => group.kpis.map((kpi) => ({ ...kpi, perspective: group.perspective })))
  const selectedId = kpis.some((kpi) => kpi.id === kpiId) ? kpiId : (kpis[0]?.id || '')
  const selected = kpis.find((kpi) => kpi.id === selectedId)
  function submit(event) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    const kpi = kpis.find((item) => item.id === fields.kpi_id)
    if (!kpi) { setError('Select a valid KPI.'); setMessage(''); return }
    if (!MONTHS.includes(fields.period_label)) { setError('Select a valid period.'); setMessage(''); return }
    const stored = (kpi.periods || []).find((item) => item.label === fields.period_label && Number(item.year) === Number(fields.period_year))
    const actual = kpi.liveActual != null ? (stored?.actual ?? null) : fields.actual_value
    onSave(kpi.id, { label: fields.period_label, year: Number(fields.period_year), target: fields.target_value, actual })
    setError('')
    setMessage('Saved.')
  }
  return (
    <div className="wrap">
      <p className="sub">{all ? 'Enter a target for any business. An existing entry for the same month is overwritten.' : `${publicDepartmentName(department)}. Add or update a target and actual for one period. An existing entry for the same period is overwritten.`}</p>
      {message && <div className="form-msg success">{message}</div>}
      {error && <div className="form-msg error">{error}</div>}
      {!viewOnly && (
        <section className={`card accent-${deptAccent(department.code)}`} style={{ maxWidth: 720 }}>
          <div className="card-head"><h2>Target and actual</h2></div>
          <div className="card-body">
            {kpis.length ? (
              <form onSubmit={submit}>
                {all && (
                  <div className="field">
                    <label htmlFor="business_id">Business</label>
                    <select id="business_id" value={business} onChange={(event) => { setBusiness(event.target.value); setKpiId(''); setMessage('') }}>
                      {groups.map((item) => <option key={item.code} value={item.code}>{publicDepartmentName(item)}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="kpi_id">KPI / Measure</label>
                  <select id="kpi_id" name="kpi_id" value={selectedId} onChange={(event) => setKpiId(event.target.value)} required>
                    {kpis.map((kpi) => <option key={kpi.id} value={kpi.id}>[{kpi.perspective}] {kpi.measure}</option>)}
                  </select>
                </div>
                <div className="field-row">
                  <div className="field"><label htmlFor="period_label">Period</label><select id="period_label" name="period_label" required>{MONTHS.map((month) => <option key={month}>{month}</option>)}</select></div>
                  <div className="field"><label htmlFor="period_year">Year</label><input id="period_year" name="period_year" type="number" defaultValue={new Date().getFullYear()} min="2020" max="2100" required /></div>
                </div>
                <div className="field-row">
                  <div className="field"><label htmlFor="target_value">Target</label><input id="target_value" name="target_value" type="number" step="any" /></div>
                  <div className="field">
                    <label htmlFor="actual_value">Actual</label>
                    {selected?.liveActual != null
                      ? <p id="actual_value" className="stat-desc" style={{ margin: 0 }}>{formatActual(selected.liveActual, selected.unit)}</p>
                      : <input id="actual_value" name="actual_value" type="number" step="any" />}
                  </div>
                </div>
                <button className="btn btn-primary" type="submit">Save entry</button>
              </form>
            ) : <p className="stat-desc">No KPIs are defined yet for this business.</p>}
          </div>
        </section>
      )}
      {groups.filter((item) => all || item.code === department.code).map((item) => {
        const rows = kpisForDepartment(presented.kpis, item.code).flatMap((group) => group.kpis.map((kpi) => ({ ...kpi, perspective: group.perspective })))
        return (
          <section key={item.code}>
            <h2 className="section-title">{publicDepartmentName(item)}</h2>
            <section className="card"><div className="card-body pad-0"><div className="tbl-scroll"><table className="data"><thead><tr><th>Perspective</th><th>Measure</th><th>Target</th><th>Actual</th><th>Achievement</th></tr></thead><tbody>{rows.map((kpi) => <tr key={kpi.id}><td>{kpi.perspective}</td><td>{kpi.measure}</td><td>{formatTarget(kpi.latest?.target, kpi.unit)}</td><td>{formatActual(kpi.latest?.actual, kpi.unit)}</td><td>{formatPct(kpi.latestPct)}</td></tr>)}</tbody></table></div></div></section>
          </section>
        )
      })}
      <PageFooter />
    </div>
  )
}

export function UploadScorecard() {
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    const file = event.currentTarget.workbook.files?.[0]
    if (!file) { setError('Choose an .xlsx file first.'); return }
    if (!file.name.toLowerCase().endsWith('.xlsx')) { setError('Please upload a .xlsx file (an older .xls file needs to be re-saved as .xlsx first).'); return }
    setError('Could not read that file. Workbook import runs on the scorecard service, and nothing already recorded was changed.')
  }
  return (
    <div className="wrap">
      <p className="sub">Load a workbook of KPI targets. Nothing already recorded is changed, matched, or removed.</p>
      {error && <div className="form-msg error">{error}</div>}
      <section className="card" style={{ maxWidth: 640 }}>
        <div className="card-head"><h2>Upload a workbook</h2></div>
        <div className="card-body">
          <form onSubmit={submit}>
            <div className="field"><label htmlFor="workbook">Workbook (.xlsx)</label><input id="workbook" name="workbook" type="file" accept=".xlsx" required /></div>
            <div className="field"><label htmlFor="year">Year these targets apply to</label><input id="year" name="year" type="number" defaultValue={new Date().getFullYear()} min="2020" max="2100" required /></div>
            <button className="btn btn-primary" type="submit">Upload and import</button>
          </form>
        </div>
      </section>
      <PageFooter />
    </div>
  )
}
