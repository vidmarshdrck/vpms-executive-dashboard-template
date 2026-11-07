import { useState } from 'react'
import { addRecord, toggleTask, totals, weekKey, localDate } from './model.js'
import LiveWorkspace from './LiveWorkspace.jsx'
import { PageFooter } from './Donut.jsx'

const businesses = ['Vidmar Holdings', 'VAI', 'VE', 'REZ', 'BSG', 'VT', 'Eunique Apparel', 'Digital Products']
const owners = ['Me', 'Nehemiah', 'Barnabas', 'Joseph', 'Joshua', 'Boaz', 'Nathan', 'Daniel', 'Caleb']
const today = () => localDate(new Date())
const money = (amount) => `ZMW ${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Badge({ children }) {
  return <span className={`chip ${String(children).toLowerCase() === 'paid' || String(children).toLowerCase() === 'done' ? 'green' : String(children).toLowerCase() === 'overdue' ? 'red' : String(children).toLowerCase() === 'pending' ? 'amber' : 'na'}`}>{children}</span>
}

export default function WorkspaceViews({ view, state, save }) {
  const [business, setBusiness] = useState('All businesses')
  const [scope, setScope] = useState('Business')
  const [message, setMessage] = useState('')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [week, setWeek] = useState(() => weekKey(new Date()))
  const inBusiness = (record) => business === 'All businesses' || record.business === business
  const tasks = state.tasks.filter(inBusiness)
  const open = tasks.filter((task) => !task.done)
  const projects = state.projects.filter(inBusiness)
  const ledger = state.ledger.filter(inBusiness).filter((record) => record.scope === scope)
  const sums = totals(ledger, scope)
  function submit(event, kind) {
    event.preventDefault()
    const form = event.currentTarget
    try { save(addRecord(state, kind, Object.fromEntries(new FormData(form)))); form.reset(); setMessage('Saved.') }
    catch (error) { setMessage(error.message) }
  }
  function remove(kind, id) { save({ ...state, [kind]: state[kind].filter((record) => record.id !== id) }); setMessage('Saved.') }
  function taskList(items) {
    if (!items.length) return <p className="empty">No tasks in this view.</p>
    return <ul className="vh-list">{items.map((task) => <li key={task.id}><label className="vh-check"><input type="checkbox" checked={task.done} onChange={() => save(toggleTask(state, task.id))} /><span className={task.done ? 'vh-done' : ''}><strong>{task.title}</strong><small>{task.owner || 'Me'} · {task.business} · {task.date || 'No due date'}</small></span></label><Badge>{task.done ? 'Done' : task.date && task.date < today() ? 'Overdue' : 'Pending'}</Badge><button className="btn btn-danger btn-sm" type="button" aria-label={`Delete task ${task.title}`} onClick={() => remove('tasks', task.id)}>Delete</button></li>)}</ul>
  }
  function planner() {
    return (
      <section className="card"><div className="card-head"><h2>Weekly priorities</h2></div><div className="card-body">
        <div className="field" style={{ maxWidth: 240 }}><label>Week of<input aria-label="Planning week" type="date" value={week} onChange={(event) => setWeek(weekKey(new Date(`${event.target.value || today()}T12:00:00`)))} /></label></div>
        <p className="vh-muted">Set the outcome, the next action, and the person accountable.</p>
        <label className="field">Priorities and decisions<textarea aria-label="Weekly priorities" rows="5" value={state.notes[week] || ''} onChange={(event) => save({ ...state, notes: { ...state.notes, [week]: event.target.value } })} /></label>
      </div></section>
    )
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `vhpms-local-${today()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="wrap">
      <div className="topbar">
        <div><p className="brand-eyebrow">Vidmar Holdings</p><h1>{view === 'operations' ? 'Operations' : view === 'sources' ? 'Source records' : view[0].toUpperCase() + view.slice(1)}</h1></div>
        <div className="vh-actions"><button className="btn btn-ghost" type="button" onClick={exportData}>Export JSON</button><button className="btn btn-ghost" type="button" onClick={() => window.print()}>Print / PDF</button></div>
      </div>
      {view !== 'sources' && <div className="vh-toolbar"><label>Business<select aria-label="Business" value={business} onChange={(event) => setBusiness(event.target.value)}><option>All businesses</option>{businesses.map((item) => <option key={item}>{item}</option>)}</select></label></div>}
      <p className="vh-status" role="status">{message}</p>
      {view === 'sources' && <LiveWorkspace />}
      {view === 'operations' && <><section className="card"><div className="card-head"><h2>Due and overdue</h2></div><div className="card-body">{taskList([...open].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')))}</div></section>{planner()}</>}
      {view === 'priorities' && planner()}
      {view === 'tasks' && <>
        <section className="card"><div className="card-head"><h2>Add a task</h2></div><div className="card-body">
          <form className="vh-form" onSubmit={(event) => submit(event, 'tasks')}>
            <div className="field"><label>Task<input name="title" required maxLength="180" /></label></div>
            <div className="field"><label>Owner<select aria-label="Owner" name="owner">{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label></div>
            <div className="field"><label>Business<select name="business" defaultValue={business === 'All businesses' ? 'Vidmar Holdings' : business}>{businesses.map((item) => <option key={item}>{item}</option>)}</select></label></div>
            <div className="field"><label>Due date<input name="date" type="date" defaultValue={today()} /></label></div>
            <div className="field"><label>Project<select name="project"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label></div>
            <button className="btn btn-primary" type="submit">Save task</button>
          </form>
          <p className="vh-muted">Owner names are labels for planning.</p>
        </div></section>
        <section className="card"><div className="card-head"><h2>Tasks</h2></div><div className="card-body">{taskList(tasks)}</div></section>
      </>}
      {view === 'projects' && <>
        <section className="card"><div className="card-head"><h2>Add a project</h2></div><div className="card-body">
          <form className="vh-form" onSubmit={(event) => submit(event, 'projects')}>
            <div className="field"><label>Project<input name="title" required maxLength="180" /></label></div>
            <div className="field"><label>Business<select name="business">{businesses.map((item) => <option key={item}>{item}</option>)}</select></label></div>
            <div className="field"><label>Target date<input type="date" name="date" /></label></div>
            <button className="btn btn-primary" type="submit">Save project</button>
          </form>
        </div></section>
        <section className="card"><div className="card-head"><h2>Project register</h2></div><div className="card-body">{projects.length ? <ul className="vh-list">{projects.map((project) => <li key={project.id}><div><strong>{project.title}</strong><small>{project.business} · {project.date || 'No target date'} · {tasks.filter((task) => task.project === project.id && !task.done).length} open tasks</small></div><button className="btn btn-danger btn-sm" type="button" aria-label={`Delete project ${project.title}`} onClick={() => remove('projects', project.id)}>Delete</button></li>)}</ul> : <p className="empty">No projects yet.</p>}</div></section>
      </>}
      {view === 'calendar' && <section className="card"><div className="card-head"><h2>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2><div className="vh-actions"><button className="btn btn-ghost btn-sm" type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Previous</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => setMonth(new Date())}>Today</button><button className="btn btn-ghost btn-sm" type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next</button></div></div><div className="card-body"><div className="vh-calendar-scroll" tabIndex="0" aria-label="Monthly calendar"><div className="vh-calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <strong key={day}>{day}</strong>)}{Array.from({ length: (month.getDay() + 6) % 7 }, (_, index) => <div key={`pad${index}`} className="vh-day vh-blank" />)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => { const date = localDate(new Date(month.getFullYear(), month.getMonth(), index + 1)); return <div key={date} className={`vh-day ${date === today() ? 'vh-today' : ''}`}><span>{index + 1}</span>{tasks.filter((task) => task.date === date).map((task) => <button key={task.id} type="button" className={task.done ? 'vh-done' : ''}>{task.title}</button>)}</div> })}</div></div></div></section>}
      {view === 'receipts' && <>
        <div className="legend" style={{ marginBottom: 16 }}>{['Personal', 'Business', 'BSG'].map((item) => <button key={item} type="button" className={`btn btn-sm ${scope === item ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={scope === item} onClick={() => setScope(item)}>{item}</button>)}</div>
        {scope === 'BSG' && <section className="card"><div className="card-head"><h2>Setup evidence and confidence</h2></div><div className="card-body"><p>No historical dataset is connected. Win rate, number of reviewed setups, drawdown, and confidence stay unavailable.</p><dl className="vh-evidence"><div><dt>Baseline</dt><dd>Stage 2+ baseline cohort. Baseline risk remains at or under 1% and subject to the stricter existing limits.</dd></div><div><dt>Paper exception</dt><dd>Stage 1 study stays separate. Above-1% paper structural-stop scenarios need an individually recorded approval. Baseline and exception outcomes stay separate.</dd></div><div><dt>Evidence required</dt><dd>Setup ID, timestamp, symbol, stage, entry, exit, risk, outcome, source chart, and dataset provenance.</dd></div><div><dt>Historical confidence</dt><dd>Unavailable until the evidence is reviewed.</dd></div></dl></div></section>}
        <section className="card"><div className="card-head"><h2>{scope} receipts</h2></div><div className="card-body">
          <div className="grid-3" style={{ marginBottom: 16 }}>{Object.entries(sums).map(([key, value]) => <div key={key}><Badge>{key[0].toUpperCase() + key.slice(1)}</Badge><div className="stat-num" style={{ fontSize: 28 }}>{money(value)}</div></div>)}</div>
          <form className="vh-form" onSubmit={(event) => submit(event, 'ledger')}><input type="hidden" name="scope" value={scope} /><div className="field"><label>Description<input required name="title" maxLength="180" /></label></div><div className="field"><label>Amount (ZMW)<input name="amount" type="number" required min="0.01" step="0.01" /></label></div><div className="field"><label>Status<select aria-label="Receipt status" name="status"><option>Pending</option><option>Paid</option><option>Overdue</option></select></label></div><div className="field"><label>Business<select name="business" defaultValue={business === 'All businesses' ? 'Vidmar Holdings' : business}>{businesses.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="field"><label>Date<input name="date" type="date" defaultValue={today()} /></label></div><button className="btn btn-primary" type="submit">Save entry</button></form>
          {ledger.length ? <ul className="vh-list">{ledger.map((record) => <li key={record.id}><div><strong>{record.title}</strong><small>{record.date} · {record.business}</small></div><strong>{money(record.amount)}</strong><Badge>{record.status}</Badge><button className="btn btn-danger btn-sm" type="button" aria-label={`Delete receipt ${record.title}`} onClick={() => remove('ledger', record.id)}>Delete</button></li>)}</ul> : <p className="empty">No receipts in this scope.</p>}
        </div></section>
      </>}
      <PageFooter />
    </div>
  )
}
