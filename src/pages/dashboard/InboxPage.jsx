import InboxSection from '../../vhpms/inbox/InboxSection.jsx'
import SamplePill from '../../vhpms/SamplePill.jsx'
export default function InboxPage() {
  return <div className="space-y-5 animate-fade-in">
    <div>
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold text-slate-900">Inbox</h2><SamplePill title="Synthetic requests for the preview. Nothing here is real." /></div>
      <p className="text-sm text-slate-500 mt-1">Approvals, decisions and tasks from your agents. Your decision is recorded; the agent carries it out.</p>
    </div>
    <InboxSection />
  </div>
}
