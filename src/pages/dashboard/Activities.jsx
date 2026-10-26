import { NavLink, Outlet } from 'react-router-dom'

export default function Activities({ basePath = '/support-overview' }) {
  const tabs = [
    { path: basePath, label: 'Activities', end: true },
    { path: `${basePath}/projects`, label: 'Projects' },
  ]
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Activities sections">
        {tabs.map((tab) => <NavLink key={tab.path} to={tab.path} end={tab.end} role="tab" className={({ isActive }) => `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${isActive ? 'border-[#1E4DFF] text-[#1E4DFF]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>{tab.label}</NavLink>)}
      </div>
      <Outlet />
    </div>
  )
}
