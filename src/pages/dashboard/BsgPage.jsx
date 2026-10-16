import BsgSection from '../../vhpms/bsg/BsgSection.jsx'
import '../../vhpms/embed.css'
export default function BsgPage() {
  return <div className="space-y-6 animate-fade-in">
    <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#1E4DFF]">Boaz · BSG desk</p><h2 className="text-xl font-bold text-slate-900 mt-1">BSG trading</h2><p className="text-sm text-slate-500 mt-1">Read-only trades, performance and strategies. No trade controls.</p></div>
    <div className="vh-embed"><BsgSection /></div>
  </div>
}
