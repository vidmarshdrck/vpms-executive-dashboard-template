import { useEffect, useState } from 'react'
import LiveWorkspace from '../../vhpms/LiveWorkspace.jsx'
import { probeTaskApi, taskApiBase } from '../../vhpms/backendStatus.js'
import '../../vhpms/embed.css'
const tone = s => s === 'Backend connected' ? 'status-positive' : s === 'Backend not ready' ? 'status-warning' : s === 'Checking backend' ? 'status-neutral' : 'status-negative'
export default function LiveWorkspacePage() {
  const [backend, setBackend] = useState('Checking backend')
  useEffect(() => { let live = true; const run = () => probeTaskApi(taskApiBase(import.meta.env)).then(s => { if (live) setBackend(s) }); run(); const id = setInterval(run, 60000); return () => { live = false; clearInterval(id) } }, [])
  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#1E4DFF]">Tasks · live workspace</p><h2 className="text-xl font-bold text-slate-900 mt-1">Live workspace</h2><p className="text-sm text-slate-500 mt-1">Authenticated, read-only source projects and tasks with automatic priority.</p></div>
      <span role="status" aria-live="polite" className={`status-badge ${tone(backend)}`}>{backend}</span></div>
    <div className="vh-embed"><LiveWorkspace /></div>
  </div>
}
