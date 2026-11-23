import { useState } from 'react'
import { localDate, weekKey } from './model.js'
import { PageFooter } from './Donut.jsx'
import SlideTabs from './SlideTabs.jsx'
import OperationsPage from './OperationsPage.jsx'

const today = () => localDate(new Date())

function CalendarPage({ state, save }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [week, setWeek] = useState(() => weekKey(new Date()))
  const tasks = state.tasks || []
  return (
    <div className="wrap">
      <SlideTabs label="Calendar sections" tabs={['Calendar', 'Weekly priorities']}>
        <section className="card">
          <div className="card-head">
            <h2>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
            <div className="vh-actions">
              <button className="btn btn-ghost btn-sm" type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Previous</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setMonth(new Date())}>Today</button>
              <button className="btn btn-ghost btn-sm" type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next</button>
            </div>
          </div>
          <div className="card-body">
            <div className="vh-calendar-scroll" tabIndex="0" aria-label="Monthly calendar">
              <div className="vh-calendar">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <strong key={day}>{day}</strong>)}
                {Array.from({ length: (month.getDay() + 6) % 7 }, (_, index) => <div key={`pad${index}`} className="vh-day vh-blank" />)}
                {Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => {
                  const date = localDate(new Date(month.getFullYear(), month.getMonth(), index + 1))
                  return (
                    <div key={date} className={`vh-day ${date === today() ? 'vh-today' : ''}`}>
                      <span>{index + 1}</span>
                      {tasks.filter((task) => task.date === date).map((task) => <button key={task.id} type="button" className={task.done ? 'vh-done' : ''}>{task.title}</button>)}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-body">
            <div className="field" style={{ maxWidth: 240 }}><label>Week of<input aria-label="Planning week" type="date" value={week} onChange={(event) => setWeek(weekKey(new Date(`${event.target.value || today()}T12:00:00`)))} /></label></div>
            <label className="field">Priorities and decisions<textarea aria-label="Weekly priorities" rows="5" value={state.notes?.[week] || ''} onChange={(event) => save({ ...state, notes: { ...state.notes, [week]: event.target.value } })} /></label>
          </div>
        </section>
      </SlideTabs>
      <PageFooter />
    </div>
  )
}

export default function WorkspaceViews({ view, state, save }) {
  if (view === 'operations') return <OperationsPage />
  if (view === 'calendar') return <CalendarPage state={state} save={save} />
  return null
}
