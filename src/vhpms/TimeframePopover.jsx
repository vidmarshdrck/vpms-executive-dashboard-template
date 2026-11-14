import { useContext, useEffect, useRef, useState, createContext } from 'react'
import { MONTHS, clampPeriod, defaultPeriod, periodBounds, periodLabel, readStoredPeriod, writeStoredPeriod, yearOptions } from './reportingPeriod.js'

const ReportingPeriodContext = createContext(null)

function storageOrNull() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function ReportingPeriodProvider({ userId = '', today, children }) {
  const loadedKey = `${userId}|${today || ''}`
  const [period, setPeriod] = useState(() => readStoredPeriod(storageOrNull(), userId, today))
  const [loadedFor, setLoadedFor] = useState(loadedKey)
  if (loadedFor !== loadedKey) {
    setLoadedFor(loadedKey)
    setPeriod(readStoredPeriod(storageOrNull(), userId, today))
  }
  function apply(next) {
    const safe = writeStoredPeriod(storageOrNull(), userId, next, today)
    setPeriod(safe)
  }
  const todayYear = defaultPeriod(today).year
  const value = { ...period, ...periodBounds(period), label: periodLabel(period), today, todayYear, apply }
  return <ReportingPeriodContext.Provider value={value}>{children}</ReportingPeriodContext.Provider>
}

export function useReportingPeriod(today) {
  const context = useContext(ReportingPeriodContext)
  if (context) return context
  const period = clampPeriod(defaultPeriod(today), today)
  return { ...period, ...periodBounds(period), label: periodLabel(period), today, todayYear: period.year, apply() {} }
}

export function TimeframePopover({ pageTitle = 'Dashboard', today, initiallyOpen = false }) {
  const period = useReportingPeriod(today)
  const [open, setOpen] = useState(initiallyOpen)
  const root = useRef(null)
  const help = `Reporting period \u00b7 ${pageTitle}`
  useEffect(() => {
    function onClick(event) {
      const popover = root.current
      if (!popover?.open || popover.contains(event.target)) return
      setOpen(false)
    }
    function onKey(event) {
      const popover = root.current
      if (event.key !== 'Escape' || !popover?.open) return
      setOpen(false)
      popover.querySelector('summary')?.focus()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  function onToggle(event) {
    setOpen(event.currentTarget.open)
  }
  function onSummaryClick(event) {
    event.preventDefault()
    setOpen((current) => {
      const next = !current
      if (next) root.current?.querySelector('form')?.reset()
      return next
    })
  }
  function apply(event) {
    event.preventDefault()
    const form = event.currentTarget
    const from = Number(form.elements.period_from.value)
    let to = Number(form.elements.period_to.value)
    if (to < from) {
      to = from
      form.elements.period_to.value = String(from)
    }
    period.apply({ year: Number(form.elements.period_year.value), from, to })
    setOpen(false)
  }
  const years = yearOptions(period.todayYear || defaultPeriod(today).year, period.year)
  return (
    <details ref={root} className="hod-header-popover hod-timeframe-popover" open={open} onToggle={onToggle}>
      <summary role="button" aria-label="Select reporting period" aria-haspopup="dialog" onClick={onSummaryClick}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
        <span>{period.label}</span>
        <svg className="hod-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <form key={`${period.year}-${period.from}-${period.to}`} className="hod-timeframe-panel" aria-label={help} onSubmit={apply}>
        <p>{help}</p>
        <label>From
          <select name="period_from" defaultValue={period.from}>
            {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </label>
        <label>To
          <select name="period_to" defaultValue={period.to}>
            {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </label>
        <label>Year
          <select name="period_year" defaultValue={period.year}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <div>
          <button type="button" data-cancel-period onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary">Apply</button>
        </div>
      </form>
    </details>
  )
}
