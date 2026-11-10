import { useEffect, useRef, useState } from 'react'
import { STATUSES, PRIORITIES, statusCounts, addActivity, setActivityStatus, addInitiative, initiativeProgress, addForceItem, setForceStatus } from './activities.js'
import SlideTabs from './SlideTabs.jsx'
import { PageFooter } from './Donut.jsx'

function statusChip(status) {
  if (status === 'Done') return 'green'
  if (status === 'Blocked') return 'red'
  if (status === 'In progress') return 'amber'
  return 'na'
}

function Counts({ items }) {
  return <div className="grid-4" style={{ marginBottom: 16 }}>{statusCounts(items).map(([status, count]) => <section className="card" key={status}><div className="card-body"><div className="stat-num" style={{ fontSize: 28 }}>{count}</div><div className="stat-desc">{status}</div></div></section>)}</div>
}

export default function ActivitiesBoard({ state, onChange, composing = false }) {
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState(0)
  const [localOpen, setLocalOpen] = useState(composing)
  const open = localOpen
  const formRef = useRef(null)
  useEffect(() => {
    if (open) formRef.current?.querySelector('[name="title"]')?.focus()
  }, [open])
  function run(mutate) {
    try { onChange(mutate(state)); setMessage('Saved.'); return true } catch (error) { setMessage(error.message); return false }
  }
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Vidmar Holdings</p><h1>Activities</h1><p className="sub">Personal activities, initiatives, and task force work.</p></div></div>
      {message && <p className="vh-status" role="status">{message}</p>}
      <SlideTabs label="Activities sections" tabs={['Activities', 'Initiatives', 'Task Force']} index={tab} onIndex={setTab} action={<button type="button" className="btn btn-primary" onClick={() => { setTab(0); setLocalOpen(true) }}>Add task</button>}>
        <div>
          <Counts items={state.tasks} />
          <section className="card" id="new-activity" ref={formRef} hidden={!open} style={{ marginBottom: 16 }}><div className="card-head"><h2>New activity</h2></div><div className="card-body">
            <form className="vh-form" onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); if (!run((current) => addActivity(current, fields))) return; event.currentTarget.reset(); setLocalOpen(false) }}>
              <div className="field"><label>Title<input name="title" type="text" required /></label></div>
              <div className="field"><label>Status<select name="status">{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label></div>
              <div className="field"><label>Priority<select name="priority">{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label></div>
              <div className="field"><label>Due<input name="due" type="date" /></label></div>
              <div className="field"><label>Initiative<select name="initiativeId"><option value="">None</option>{state.initiatives.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
              <div className="field"><label>Description<input name="description" type="text" /></label></div>
              <div className="row-actions"><button className="btn btn-primary" type="submit">Save activity</button><button className="btn btn-ghost" type="button" onClick={() => setLocalOpen(false)}>Cancel</button></div>
            </form>
          </div></section>
          {state.tasks.length ? state.tasks.map((task) => (
            <section className="card" key={task.id} style={{ marginBottom: 12 }}><div className="card-body">
              <div className="card-head" style={{ padding: 0 }}><h2>{task.title}</h2><span className={`chip ${statusChip(task.status)}`}>{task.status}</span></div>
              {task.description && <p className="stat-desc">{task.description}</p>}
              <div className="row-actions" style={{ marginTop: 10 }}>
                <span className="chip na">{task.priority}</span>
                {task.due && <span className="vh-muted">Due {task.due}</span>}
                <label style={{ margin: 0 }}>Move<select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => run((current) => setActivityStatus(current, task.id, event.target.value))}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
              </div>
            </div></section>
          )) : <p className="empty">No activities yet.</p>}
        </div>
        <div>
          <section className="card" style={{ marginBottom: 16 }}><div className="card-head"><h2>New initiative</h2></div><div className="card-body">
            <form className="vh-form" onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); run((current) => addInitiative(current, fields)); event.currentTarget.reset() }}>
              <div className="field"><label>Name<input name="title" type="text" required /></label></div>
              <div className="field"><label>Due<input name="due" type="date" /></label></div>
              <div className="field"><label>Description<input name="description" type="text" /></label></div>
              <button className="btn btn-primary" type="submit">Save initiative</button>
            </form>
          </div></section>
          {state.initiatives.length ? <div className="grid">{state.initiatives.map((item) => {
            const progress = initiativeProgress(state, item.id)
            return <section className="card" key={item.id}><div className="card-body"><h2 style={{ fontSize: 16 }}>{item.title}</h2>{item.description && <p className="stat-desc">{item.description}</p>}<p className="stat-desc">{progress.total ? `${progress.done} of ${progress.total} linked activities done · ${progress.pct}%` : 'No linked activities yet.'}</p>{item.due && <p className="vh-muted">Due {item.due}</p>}</div></section>
          })}</div> : <p className="empty">No initiatives yet.</p>}
        </div>
        <div>
          <Counts items={state.force} />
          <section className="card" style={{ marginBottom: 16 }}><div className="card-head"><h2>New task force item</h2></div><div className="card-body">
            <form className="vh-form" onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); run((current) => addForceItem(current, fields)); event.currentTarget.reset() }}>
              <div className="field"><label>Title<input name="title" type="text" required /></label></div>
              <div className="field"><label>People<input name="members" type="text" required /></label></div>
              <div className="field"><label>Status<select name="status">{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label></div>
              <div className="field"><label>Due<input name="due" type="date" /></label></div>
              <button className="btn btn-primary" type="submit">Save task force item</button>
            </form>
          </div></section>
          {state.force.length ? state.force.map((item) => (
            <section className="card" key={item.id} style={{ marginBottom: 12 }}><div className="card-body">
              <div className="card-head" style={{ padding: 0 }}><h2>{item.title}</h2><span className={`chip ${statusChip(item.status)}`}>{item.status}</span></div>
              <p className="stat-desc">{item.members}</p>
              <label style={{ marginTop: 8 }}>Move<select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => run((current) => setForceStatus(current, item.id, event.target.value))}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            </div></section>
          )) : <p className="empty">No task force items yet.</p>}
        </div>
      </SlideTabs>
      <PageFooter />
    </div>
  )
}
