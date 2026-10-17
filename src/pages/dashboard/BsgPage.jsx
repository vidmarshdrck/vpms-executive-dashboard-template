import BsgSection from '../../vhpms/bsg/BsgSection.jsx'
import SamplePill from '../../vhpms/SamplePill.jsx'
import '../../vhpms/embed.css'
export default function BsgPage() {
  return <div className="space-y-6 animate-fade-in">
    <div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold text-slate-900">BSG trading</h2><SamplePill title="Synthetic trades for the preview. Not real trades." /></div><p className="text-sm text-slate-500 mt-1">Read-only trades, performance and strategies from Boaz. No trade controls.</p></div>
    <div className="vh-embed"><BsgSection /></div>
  </div>
}
