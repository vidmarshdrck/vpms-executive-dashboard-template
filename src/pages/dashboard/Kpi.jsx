import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { hasPermission } from '../../auth/permissions.js'

// One "KPI" sidebar entry. The tabs shown depend on the user's permissions:
// department heads/staff get KPI entry only (no tab bar); the GM and other
// org-wide roles get the register, and the GM also gets approvals.
const TABS = [
  { path: 'entry', label: 'KPI entry', permission: 'kpi.submit' },
  { path: 'register', label: 'KPI register', permission: 'dashboard.org' },
  { path: 'approvals', label: 'Approvals', permission: 'kpi.approve' },
  { path: 'setup', label: 'KPI setup', permission: 'kpi.configure' },
]

function useTabs() {
  const { user } = useAuth()
  return TABS.filter((tab) => hasPermission(user, tab.permission))
}

export function KpiIndex() {
  const tabs = useTabs()
  return tabs.length ? <Navigate to={tabs[0].path} replace /> : <Navigate to="/" replace />
}

export default function Kpi() {
  const tabs = useTabs()
  return (
    <div className="space-y-5">
      {tabs.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="KPI sections">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              role="tab"
              className={({ isActive }) => `shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium -mb-px border-b-2 ${isActive ? 'border-[#1E4DFF] text-[#1E4DFF]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      )}
      <Outlet />
    </div>
  )
}
