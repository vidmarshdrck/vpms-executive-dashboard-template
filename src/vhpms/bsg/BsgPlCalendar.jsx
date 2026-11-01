import { bsgPlConfig } from './plConfig.js'
import { MODE_LABEL, PL_MODES, buildMonthGrid, formatDayLabel, formatPl, isPlCalendar, monthTitle, plSign, shiftMonth } from './plCalendar.js'

function Chevron({ dir }) {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d={dir === 'prev' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export function BsgPlCalendar({
  data = null,
  phase = 'ready',
  month,
  mode = 'PAPER',
  unit = bsgPlConfig.defaultUnit,
  onMonth = () => {},
  onMode = () => {},
  onUnit = () => {},
  config = bsgPlConfig,
}) {
  const ready = phase === 'ready' && isPlCalendar(data)
  const title = monthTitle(month)
  const grid = buildMonthGrid(month, ready ? data.days : [], ready ? data.weeks : [])
  const summary = ready ? data.summary : null
  const total = ready ? (unit === 'r' ? summary.pl_r : summary.pl_usd) : null
  const best = ready && summary.best_day?.day ? data.days.find((day) => String(day.day).slice(0, 10) === String(summary.best_day.day).slice(0, 10)) : null
  const bestValue = best ? (unit === 'r' ? best.pl_r : best.pl_usd) : null
  const note = phase === 'signin'
    ? 'Sign in on the Live workspace page first.'
    : phase === 'unavailable'
      ? 'Monthly P/L is unavailable.'
      : null
  return <article className="vh-pl" data-testid="bsg-pl-card" data-state={ready ? 'ready' : phase} data-unit={unit}>
    <header className="vh-pl-bar">
      <div className="vh-pl-bar-lead">
        <span className="vh-pl-live"><i />LIVE</span>
        {config.showModeTag ? <span className="vh-pl-tag" data-testid="bsg-pl-mode-tag">{MODE_LABEL[mode] || mode}</span> : null}
      </div>
      <div className="vh-pl-bar-controls">
        <div className="vh-pl-switch" role="group" aria-label="P/L unit">
          {[['usd', '$'], ['r', 'R']].map(([key, label]) => <button key={key} type="button" aria-pressed={unit === key} onClick={() => onUnit(key)}>{label}</button>)}
        </div>
        {config.showModeSelector ? <div className="vh-pl-switch" role="group" aria-label="Account mode" data-testid="bsg-pl-mode-switch">
          {PL_MODES.map((key) => <button key={key} type="button" aria-pressed={mode === key} onClick={() => onMode(key)}>{MODE_LABEL[key]}</button>)}
        </div> : null}
      </div>
    </header>
    <div className="vh-pl-top">
      <div className="vh-pl-monthblock">
        <button type="button" className="vh-pl-nav" aria-label="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}><Chevron dir="prev" /></button>
        <div>
          <h2 className="vh-pl-month">{title.name}</h2>
          <p className="vh-pl-year">{title.year}</p>
        </div>
        <button type="button" className="vh-pl-nav" aria-label="Next month" onClick={() => onMonth(shiftMonth(month, 1))}><Chevron dir="next" /></button>
      </div>
      <div className={`vh-pl-hero is-${ready ? plSign(total) : 'zero'}`}>
        <span>Monthly P/L</span>
        <strong data-testid="bsg-pl-total">{ready ? formatPl(total, unit) : '—'}</strong>
      </div>
    </div>
    {note ? <p className="vh-pl-note" role="status">{note}</p> : null}
    <div className="vh-pl-kpis">
      <div><span>Trades</span><strong>{ready ? summary.trades : '—'}</strong></div>
      <div><span>Avg hold</span><strong>{ready && summary.avg_hold_minutes != null ? `${Math.round(Number(summary.avg_hold_minutes))}m` : '—'}</strong></div>
      <div><span>Profit factor</span><strong>{ready && summary.profit_factor != null ? Number(summary.profit_factor).toFixed(2) : '—'}</strong></div>
      <div><span>Best day</span><strong data-testid="bsg-pl-best">{ready && best ? formatPl(bestValue, unit) : '—'}</strong>{ready && best ? <small>{formatDayLabel(best.day)}</small> : null}</div>
    </div>
    <div className="vh-pl-cal" role="grid" aria-label="Monday to Friday P/L">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label) => <div key={label} className="vh-pl-dow" role="columnheader">{label}</div>)}
      <div className="vh-pl-dow vh-pl-dow-week" role="columnheader">Weekly P/L</div>
      {grid.map((week) => <div className="vh-pl-week" key={week.weekStart} role="row">
        {week.cells.map((cell, index) => {
          if (!cell) return <div key={`${week.weekStart}-out-${index}`} className="vh-pl-cell is-out" role="gridcell" />
          const value = ready && cell.trades ? (unit === 'r' ? cell.pl_r : cell.pl_usd) : null
          const tone = !ready || !cell.trades ? 'empty' : plSign(value)
          return <div key={cell.date} className={`vh-pl-cell is-${tone}`} role="gridcell">
            <span className="vh-pl-daynum">{cell.dayNum}</span>
            {ready && cell.trades ? <><strong>{formatPl(value, unit)}</strong><small>{cell.trades} {cell.trades === 1 ? 'trade' : 'trades'}</small></> : null}
          </div>
        })}
        <div className={`vh-pl-weekpl is-${ready ? plSign(unit === 'r' ? week.pl_r : week.pl_usd) : 'zero'}`} role="gridcell" data-testid="bsg-pl-week">
          <strong>{ready ? formatPl(unit === 'r' ? week.pl_r : week.pl_usd, unit) : '—'}</strong>
          {ready && week.trades ? <small>{week.winDays}W / {week.lossDays}L</small> : null}
        </div>
      </div>)}
    </div>
    <footer className="vh-pl-foot">Powered by <b>VIDΛR</b></footer>
  </article>
}
