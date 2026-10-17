// Small neutral marker for synthetic preview data. Deliberately quiet: grey, not red.
export default function SamplePill({ show = import.meta.env.VITE_BSG_FIXTURE === 'true', title = 'Synthetic preview data. Nothing here is real.' }) {
  if (!show) return null
  return <span title={title} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 align-middle">
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-400" />Sample data
  </span>
}
