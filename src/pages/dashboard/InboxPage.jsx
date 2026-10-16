import InboxSection from '../../vhpms/inbox/InboxSection.jsx'
import '../../vhpms/embed.css'
export default function InboxPage() {
  return <div className="space-y-6 animate-fade-in">
    <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#1E4DFF]">Owner · approvals</p><h2 className="text-xl font-bold text-slate-900 mt-1">Inbox</h2><p className="text-sm text-slate-500 mt-1">Approvals, decisions and tasks from your agents. Decisions are recorded only; agents carry them out.</p></div>
    <div className="vh-embed"><InboxSection /></div>
  </div>
}
