import { useState } from 'react'
import { operatingDepartments, formatWeight, addDepartment, updateDepartment, deleteDepartment, addKpi, toggleKpi, deleteKpi } from './score.js'
import { accountList, ROLES, roleLabel, addAccount, setAccountActive, isActiveAccount, canDisable } from './directory.js'
import { setBusinessActive } from './books.js'
import { PageFooter } from './Donut.jsx'

function Note({ message, error }) {
  return <>{message && <div className="form-msg success">{message}</div>}{error && <div className="form-msg error">{error}</div>}</>
}

export function AdminDepartments({ scorecard, onChange }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  function run(mutate) {
    try { onChange(mutate(scorecard)); setMessage('Saved.'); setError('') } catch (err) { setError(err.message); setMessage('') }
  }
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Admin</p><h1>Departments</h1><p className="sub">Departments mirror the scorecard heat-map sheets. Deleting one removes its KPIs.</p></div></div>
      <Note message={message} error={error} />
      <section className="card" style={{ maxWidth: 640, marginBottom: 24 }}>
        <div className="card-head"><h2>Add department</h2></div>
        <div className="card-body">
          <form onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); run((current) => addDepartment(current, fields)); if (!error) event.currentTarget.reset() }}>
            <div className="field-row">
              <div className="field"><label htmlFor="code">Code</label><input id="code" name="code" type="text" required /></div>
              <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" type="text" required /></div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="sheet">Source sheet name</label><input id="sheet" name="sheet" type="text" /></div>
              <div className="field"><label htmlFor="sort">Sort order</label><input id="sort" name="sort" type="number" defaultValue="0" /></div>
            </div>
            <button className="btn btn-primary" type="submit">Add department</button>
          </form>
        </div>
      </section>
      <section className="card">
        <div className="card-body pad-0"><div className="tbl-scroll"><table className="data">
          <thead><tr><th>Code</th><th>Name</th><th>Source sheet</th><th>Sort</th><th></th></tr></thead>
          <tbody>
            {scorecard.departments.map((department) => (
              <tr key={department.code}>
                <td><span className="badge-dept">{department.code}</span></td>
                <td colSpan="4">
                  <form className="row-actions" onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); run((current) => updateDepartment(current, department.code, { name: fields.name, sheet: fields.sheet, sort: Number(fields.sort) || 0 })) }}>
                    <input className="inline-input" name="name" type="text" defaultValue={department.name} aria-label={`${department.name} name`} style={{ width: 180 }} />
                    <input className="inline-input" name="sheet" type="text" defaultValue={department.sheet || ''} aria-label={`${department.name} sheet`} style={{ width: 180 }} />
                    <input className="inline-input" name="sort" type="number" defaultValue={department.sort || 0} aria-label={`${department.name} sort`} style={{ width: 80 }} />
                    <button className="btn btn-ghost btn-sm" type="submit">Save</button>
                    {department.code !== 'gm' && <button className="btn btn-danger btn-sm" type="button" onClick={() => { if (window.confirm('Delete this department and all its KPI data?')) run((current) => deleteDepartment(current, department.code)) }}>Delete</button>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      </section>
      <PageFooter />
    </div>
  )
}

export function AdminKpis({ scorecard, onChange }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const departments = operatingDepartments(scorecard.departments)
  const perspectives = ['Financial', 'Customer', 'Internal Processes', 'Learning & Growth']
  const rows = scorecard.kpis.filter((kpi) => !filter || kpi.dept === filter)
  function run(mutate) {
    try { onChange(mutate(scorecard)); setMessage('Saved.'); setError('') } catch (err) { setError(err.message); setMessage('') }
  }
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Admin</p><h1>KPIs</h1><p className="sub">Every KPI belongs to a department and a Balanced Scorecard perspective.</p></div></div>
      <Note message={message} error={error} />
      <section className="card" style={{ maxWidth: 680, marginBottom: 24 }}>
        <div className="card-head"><h2>Add KPI</h2></div>
        <div className="card-body">
          <form onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); run((current) => addKpi(current, fields)); event.currentTarget.reset() }}>
            <div className="field-row">
              <div className="field"><label htmlFor="department_id">Department</label><select id="department_id" name="dept" required>{departments.map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}</select></div>
              <div className="field"><label htmlFor="perspective_id">Perspective</label><select id="perspective_id" name="perspective" required>{perspectives.map((name) => <option key={name}>{name}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="measure">Measure</label><input id="measure" name="measure" type="text" required /></div>
            <div className="field"><label htmlFor="milestone">Milestone</label><input id="milestone" name="milestone" type="text" /></div>
            <div className="field"><label htmlFor="initiative">Initiative</label><input id="initiative" name="initiative" type="text" /></div>
            <div className="field"><label htmlFor="weighting">Weighting %</label><input id="weighting" name="weighting" type="number" step="any" /></div>
            <button className="btn btn-primary" type="submit">Add KPI</button>
          </form>
        </div>
      </section>
      <div style={{ marginBottom: 14, maxWidth: 320 }}>
        <div className="field" style={{ margin: 0 }}><label htmlFor="dept">Filter by department</label>
          <select id="dept" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}</select>
        </div>
      </div>
      <section className="card"><div className="card-body pad-0"><div className="tbl-scroll"><table className="data">
        <thead><tr><th>Department</th><th>Perspective</th><th>Measure</th><th>Weighting</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((kpi) => (
            <tr key={kpi.id}>
              <td><span className="badge-dept">{kpi.dept}</span></td>
              <td>{kpi.perspective}</td>
              <td>{kpi.measure || kpi.milestone || '—'}</td>
              <td>{formatWeight(kpi.weighting)}</td>
              <td><span className={`chip ${kpi.active === false ? 'na' : 'green'}`}>{kpi.active === false ? 'Inactive' : 'Active'}</span></td>
              <td className="row-actions">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => run((current) => toggleKpi(current, kpi.id))}>{kpi.active === false ? 'Activate' : 'Deactivate'}</button>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => { if (window.confirm('Delete this KPI and all its recorded periods?')) run((current) => deleteKpi(current, kpi.id)) }}>Delete</button>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="6" className="stat-desc" style={{ padding: 16 }}>No KPIs found.</td></tr>}
        </tbody>
      </table></div></div></section>
      <PageFooter />
    </div>
  )
}

export function AdminUsers({ directory, onChange }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const departments = ['engineering', 'ict', 'operations', 'finance', 'hr', 'procurement', 'safety', 'security', 'pm']
  function run(mutate) {
    try { onChange(mutate(directory)); setMessage('Saved.'); setError(''); return true } catch (err) { setError(err.message); setMessage(''); return false }
  }
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Admin</p><h1>Users</h1><p className="sub">An account can hold more than one role. Administrator, General Manager, and HRD (Human Resources Director) can be combined. Board is view only. Department head and staff work inside one department. Sign-in is checked by the authentication service.</p></div></div>
      <Note message={message} error={error} />
      <section className="card" style={{ maxWidth: 640, marginBottom: 24 }}>
        <div className="card-head"><h2>Add user</h2></div>
        <div className="card-body">
          <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const saved = run((current) => addAccount(current, { username: data.get('username'), name: data.get('full_name'), roles: data.getAll('roles'), dept: data.get('department') || null, agent: data.get('agent') === 'yes' })); if (saved) event.currentTarget.reset() }}>
            <div className="field-row">
              <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" type="text" required /></div>
              <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" type="text" required /></div>
            </div>
            <div className="field">
              <span className="role-legend">Roles</span>
              <div className="role-choices">{ROLES.map((role) => <label key={role} className="vh-check"><input type="checkbox" name="roles" value={role} /> <span>{role === 'hrd' ? 'HRD — Human Resources Director' : roleLabel(role)}</span></label>)}</div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="department">Department</label><select id="department" name="department"><option value="">—</option>{departments.map((code) => <option key={code} value={code}>{code}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="agent">AI agent</label><select id="agent" name="agent"><option value="no">No</option><option value="yes">Yes</option></select></div>
            <button className="btn btn-primary" type="submit">Add user</button>
          </form>
        </div>
      </section>
      <section className="card"><div className="card-body pad-0"><div className="tbl-scroll"><table className="data">
        <thead><tr><th>Username</th><th>Full name</th><th>Roles</th><th>Department</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {accountList(directory).map((account) => {
            const active = isActiveAccount(account, directory)
            return (
              <tr key={account.username}>
                <td>{account.username}</td>
                <td>{account.name}{account.agent && <> <span className="chip role">AI agent</span></>}</td>
                <td><span className="role-list">{account.roles.map((role) => <span key={role} className="chip role" title={role === 'hrd' ? 'Human Resources Director' : roleLabel(role)}>{roleLabel(role)}</span>)}</span></td>
                <td>{account.dept || '—'}</td>
                <td><span className={`chip ${active ? 'green' : 'na'}`}>{active ? 'Active' : 'Disabled'}</span></td>
                <td>{canDisable(account.username) && <button className="btn btn-ghost btn-sm" type="button" onClick={() => run((current) => setAccountActive(current, account.username, !active))}>{active ? 'Disable' : 'Enable'}</button>}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div></div></section>
      <PageFooter />
    </div>
  )
}

export function AdminBusinesses({ books, onChange }) {
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Admin</p><h1>Businesses</h1><p className="sub">Inactive businesses stay out of the Live workspace list. Their records remain stored.</p></div></div>
      <section className="card"><div className="card-body pad-0"><div className="tbl-scroll"><table className="data">
        <thead><tr><th>Business</th><th>Code</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {books.businesses.map((business) => (
            <tr key={business.id}>
              <td><strong>{business.name}</strong></td>
              <td><span className="badge-dept">{business.code}</span></td>
              <td><span className={`chip ${business.active ? 'green' : 'na'}`}>{business.active ? 'Active' : 'Inactive'}</span></td>
              <td><button className="btn btn-ghost btn-sm" type="button" onClick={() => onChange(setBusinessActive(books, business.id, !business.active))}>{business.active ? 'Mark inactive' : 'Mark active'}</button></td>
            </tr>
          ))}
        </tbody>
      </table></div></div></section>
      <PageFooter />
    </div>
  )
}
