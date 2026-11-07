import { useState } from 'react'
import { kpisForDepartment, deptAccent, formatNum, formatPct } from './score.js'
import { PageFooter } from './Donut.jsx'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function KpiEntry({ scorecard, user, onSave }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const department = scorecard.departments.find((item) => item.code === user.dept)
  if (!department) {
    return <div className="wrap"><div className="card"><div className="card-body"><p className="stat-desc">Your account is not linked to a department, so there is nothing to enter here. Ask an administrator to assign one.</p></div></div></div>
  }
  const kpis = kpisForDepartment(scorecard.kpis, department.code).flatMap((group) => group.kpis.map((kpi) => ({ ...kpi, perspective: group.perspective })))
  function submit(event) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    if (!kpis.some((kpi) => kpi.id === fields.kpi_id)) { setError('Select a valid KPI from your department.'); setMessage(''); return }
    if (!MONTHS.includes(fields.period_label)) { setError('Select a valid period.'); setMessage(''); return }
    onSave(fields.kpi_id, { label: fields.period_label, year: Number(fields.period_year), target: fields.target_value, actual: fields.actual_value })
    setError('')
    setMessage('Saved.')
  }
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">{department.name}</p><h1>Enter KPI Data</h1><p className="sub">Add or update a target and actual for one period. An existing entry for the same period is overwritten.</p></div></div>
      {message && <div className="form-msg success">{message}</div>}
      {error && <div className="form-msg error">{error}</div>}
      <section className={`card accent-${deptAccent(department.code)}`} style={{ maxWidth: 640 }}>
        <div className="card-head"><h2>New / updated entry</h2></div>
        <div className="card-body">
          {kpis.length ? (
            <form onSubmit={submit}>
              <div className="field"><label htmlFor="kpi_id">KPI / Measure</label><select id="kpi_id" name="kpi_id" required>{kpis.map((kpi) => <option key={kpi.id} value={kpi.id}>[{kpi.perspective}] {kpi.measure || kpi.milestone || kpi.id}</option>)}</select></div>
              <div className="field-row">
                <div className="field"><label htmlFor="period_label">Period</label><select id="period_label" name="period_label" required>{MONTHS.map((month) => <option key={month}>{month}</option>)}</select></div>
                <div className="field"><label htmlFor="period_year">Year</label><input id="period_year" name="period_year" type="number" defaultValue={new Date().getFullYear()} min="2020" max="2100" required /></div>
              </div>
              <div className="field-row">
                <div className="field"><label htmlFor="target_value">Target</label><input id="target_value" name="target_value" type="number" step="any" /></div>
                <div className="field"><label htmlFor="actual_value">Actual</label><input id="actual_value" name="actual_value" type="number" step="any" /></div>
              </div>
              <button className="btn btn-primary" type="submit">Save entry</button>
            </form>
          ) : <p className="stat-desc">No KPIs are defined yet for your department. Ask an administrator to add them under Admin · KPIs.</p>}
        </div>
      </section>
      <h2 className="section-title">Your department&apos;s KPIs — latest recorded period</h2>
      <section className="card"><div className="card-body pad-0"><div className="tbl-scroll"><table className="data"><thead><tr><th>Perspective</th><th>Measure</th><th>Latest period</th><th>Target</th><th>Actual</th><th>Achievement</th></tr></thead><tbody>{kpis.map((kpi) => <tr key={kpi.id}><td>{kpi.perspective}</td><td>{kpi.measure || kpi.milestone || '—'}</td><td>{kpi.latest ? `${kpi.latest.label} ${kpi.latest.year}` : '—'}</td><td>{formatNum(kpi.latest?.target)}</td><td>{formatNum(kpi.latest?.actual)}</td><td>{formatPct(kpi.latestPct)}</td></tr>)}</tbody></table></div></div></section>
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
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings</p><h1>Upload Scorecard / Strategic Plan</h1><p className="sub">Load a Balanced Scorecard workbook. Every KPI and target it contains is added as new — nothing already recorded is changed, matched, or removed.</p></div></div>
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
        <p className="card-note">Expected layout: a GM Heat Map sheet, plus one heat-map sheet per department, with Strategy, Milestone, Initiative, Measure, and Weighting, then target and actual rows.</p>
      </section>
      <PageFooter>Departments are matched to sheets by name. A sheet named &quot;ICT Heat Map&quot; matches the ICT department.</PageFooter>
    </div>
  )
}
