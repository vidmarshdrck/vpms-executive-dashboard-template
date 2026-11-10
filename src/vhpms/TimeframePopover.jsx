import { useContext, useEffect, useRef, useState, createContext } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
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
    const safe = writeStoredPeriod(storageOrNull(), userId, next)
    setPeriod(safe)
  }
  const todayYear = defaultPeriod(today).year
  const value = { ...period, ...periodBounds(period), label: periodLabel(period), today, todayYear, apply }
  return <ReportingPeriodContext.Provider value={value}>{children}</ReportingPeriodContext.Provider>
}

export function useReportingPeriod(today) {
  const context = useContext(ReportingPeriodContext)
  if (context) return context
  const period = clampPeriod(defaultPeriod(today))
  return { ...period, ...periodBounds(period), label: periodLabel(period), today, todayYear: period.year, apply() {} }
}

export function TimeframePopover({ pageTitle = 'Dashboard', today, initiallyOpen = false }) {
  const period = useReportingPeriod(today)
  const [open, setOpen] = useState(initiallyOpen)
  const [draft, setDraft] = useState({ year: period.year, from: period.from, to: period.to })
  const root = useRef(null)
  const help = `Reporting period · ${pageTitle}`
  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key !== 'Escape') return
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: Number(value) }))
  }
  function apply(event) {
    event.preventDefault()
    const from = Number(draft.from)
    const to = Number(draft.to)
    period.apply({ year: Number(draft.year), from, to: to < from ? from : to })
    setOpen(false)
  }
  const years = yearOptions(period.todayYear || defaultPeriod(today).year, Number(draft.year))
  return (
    <div className="vh-timeframe" ref={root}>
      <button type="button" className="vh-timeframe-trigger" aria-label="Select reporting period" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (open) { setOpen(false); return } setDraft({ year: period.year, from: period.from, to: period.to }); setOpen(true) }}>
        <Calendar aria-hidden="true" size={12} strokeWidth={1.8} />
        <span>{period.label}</span>
        <ChevronDown className="vh-timeframe-chevron" aria-hidden="true" size={11} strokeWidth={1.8} />
      </button>
      {open && (
        <form className="vh-timeframe-panel" aria-label={help} onSubmit={apply}>
          <p>{help}</p>
          <label>From
            <select name="period_from" value={draft.from} onChange={(event) => setField('from', event.target.value)}>
              {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </label>
          <label>To
            <select name="period_to" value={draft.to} onChange={(event) => setField('to', event.target.value)}>
              {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </label>
          <label>Year
            <select name="period_year" value={draft.year} onChange={(event) => setField('year', event.target.value)}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <div>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Apply</button>
          </div>
        </form>
      )}
    </div>
  )
}
