import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/scorecards', label: 'Scorecards' },
  { path: '/scorecards/strategy', label: 'Strategy Map' },
]

export default function ScorecardsWorkspace() {
  const location = useLocation()

  return <div className="space-y-5">
    <nav className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Scorecards sections">
      {tabs.map(({ path, label }) => <NavLink
        key={path}
        to={path}
        end
        role="tab"
        aria-selected={location.pathname === path}
        className={({ isActive }) => `px-4 py-2 text-sm font-medium -mb-px border-b-2 ${isActive ? 'border-[#1E4DFF] text-[#1E4DFF]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
      >{label}</NavLink>)}
    </nav>
    <Outlet />
  </div>
}
