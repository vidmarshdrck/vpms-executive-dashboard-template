import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useReportingPeriod } from '../../lib/ReportingPeriodContext.jsx'
import { buildExecutiveSummary, monthsForTimeframe, summaryToCsv, summaryToHtml } from '../../lib/executiveSummary.js'
import { recordActivity } from '../../lib/activityLog.js'

// Header export for management: a summary of the selected period as an
// Excel-ready CSV, or a printable page that can be saved as PDF.
export function ExportMenu() {
  const { user } = useAuth()
  const { timeframe, periodLabel } = useReportingPeriod()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const model = () => buildExecutiveSummary({ periodLabel, months: monthsForTimeframe(timeframe), generatedBy: user.name, year: timeframe.customYear })
  const slug = periodLabel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

  function downloadCsv() {
    const blob = new Blob([summaryToCsv(model())], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tppl-executive-summary-${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
    recordActivity({ category: 'export', label: 'Exported executive summary (CSV)' })
    setOpen(false)
  }

  function printPdf() {
    // A hidden iframe avoids pop-up blockers; the browser's print dialog offers "Save as PDF".
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)
    frame.contentDocument.open()
    frame.contentDocument.write(summaryToHtml(model()))
    frame.contentDocument.close()
    frame.contentWindow.focus()
    setTimeout(() => { frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000) }, 250)
    recordActivity({ category: 'export', label: 'Exported executive summary (PDF)' })
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Export summary" className="flex h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Download size={15} aria-hidden="true" /><span className="hidden sm:inline">Export</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="px-3 py-1.5 text-xs text-slate-500">Executive summary · {periodLabel}</div>
          <button type="button" role="menuitem" onClick={downloadCsv} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-slate-50"><FileSpreadsheet size={16} className="text-[#1E4DFF]" />Excel (CSV)</button>
          <button type="button" role="menuitem" onClick={printPdf} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-slate-50"><FileText size={16} className="text-[#1E4DFF]" />PDF (print / save)</button>
        </div>
      )}
    </div>
  )
}
