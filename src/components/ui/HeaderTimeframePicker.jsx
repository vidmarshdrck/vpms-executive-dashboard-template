import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { useReportingPeriod } from '../../lib/ReportingPeriodContext.jsx'
import { monthlyRevenue } from '../../data/kpiData.js'

// The single, global time-period control. Lives in the header (rendered by
// DashboardLayout, inside the shared ReportingPeriodProvider) so every
// dashboard page reads the same selection via useReportingPeriod() — there
// is deliberately no other timeframe picker anywhere else in the app.
const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1]

export function HeaderTimeframePicker() {
  const { timeframe, setTimeframe, periodLabel } = useReportingPeriod()
  const [open, setOpen] = useState(false)
  // Draft state so picking months doesn't apply until "Apply" is pressed —
  // seeded from the live selection each time the popover opens.
  const [draft, setDraft] = useState({ from: timeframe.customFrom, to: timeframe.customTo, year: timeframe.customYear ?? currentYear })

  function handleOpen() {
    setDraft({ from: timeframe.customFrom, to: timeframe.customTo, year: timeframe.customYear ?? currentYear })
    setOpen(true)
  }

  function apply() {
    setTimeframe({ id: 'custom', customFrom: draft.from, customTo: Math.max(draft.from, draft.to), customYear: draft.year })
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      >
        <CalendarDays size={12} className="text-[#B42318]" />
        <span className="hidden sm:inline">{periodLabel}</span>
        <ChevronDown size={11} className="text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Reporting period · applies to every dashboard</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">From</span>
                <select
                  value={draft.from}
                  onChange={(e) => setDraft((d) => ({ ...d, from: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {monthlyRevenue.map((entry, index) => <option key={entry.month} value={index}>{entry.month}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">To</span>
                <select
                  value={draft.to}
                  onChange={(e) => setDraft((d) => ({ ...d, to: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {monthlyRevenue.map((entry, index) => <option key={entry.month} value={index}>{entry.month}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Year</span>
                <select
                  value={draft.year}
                  onChange={(e) => setDraft((d) => ({ ...d, year: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {YEAR_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
              <button type="button" onClick={apply} className="px-3 py-1.5 rounded-md bg-[#B42318] text-white text-xs font-bold hover:bg-[#9A1D14]">Apply</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
