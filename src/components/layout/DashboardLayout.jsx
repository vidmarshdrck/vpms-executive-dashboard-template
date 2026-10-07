import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Gauge, Building2, Waypoints, Activity, TrendingUp, Grid3X3, FolderKanban, Headset, Menu, X, ShieldCheck } from 'lucide-react'
import { companyInfo } from '../../data/kpiData.js'
import { DataStatus } from '../ui/StatusBadge.jsx'
import { ProfileMenu } from '../ui/ProfileMenu.jsx'
import { NotesAssistant } from '../ui/NotesAssistant.jsx'
import { HeaderTimeframePicker } from '../ui/HeaderTimeframePicker.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { hasPermission } from '../../auth/permissions.js'
import { ReportingPeriodProvider } from '../../lib/ReportingPeriodContext.jsx'
import { recordActivity } from '../../lib/activityLog.js'

// Order follows how management actually uses it: the org-wide picture first
// (Executive), then the two operating views day to day (Operations,
// Financial), then drilling into a specific department's KPIs, then the
// less frequent strategic/administrative views last.
const navItems = [
  { path: '/executive', label: 'Executive overview', icon: LayoutDashboard },
  { path: '/operations', label: 'Operations', icon: Activity },
  { path: '/financial', label: 'Financial', icon: TrendingUp },
  { path: '/departments', label: 'Departments', icon: Building2 },
  { path: '/heatmap', label: 'KPI register', icon: Grid3X3 },
  { path: '/scorecard', label: 'Balanced scorecard', icon: Gauge },
  { path: '/strategy', label: 'Strategy map', icon: Waypoints },
  { path: '/projects', label: 'Projects & actions', icon: FolderKanban },
  { path: '/support', label: 'Support', icon: Headset },
]

const adminNavItem = { path: '/admin', label: 'Administration', icon: ShieldCheck, permission: 'system.configure' }
// Department Heads and Staff only ever see their own department (PMS guide, "Who's who").
const departmentNavItems = [{ path: '/my-department', label: 'My department', icon: Building2 }]

function initials(name = '') {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const mainRef = useRef(null)
  const location = useLocation()
  const { user } = useAuth()

  const orgNav = hasPermission(user, adminNavItem.permission) ? [...navItems, adminNavItem] : navItems
  const visibleNavItems = hasPermission(user, 'dashboard.org') ? orgNav : departmentNavItems
  const currentPage = visibleNavItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'

  useEffect(() => {
    if (currentPage) recordActivity({ category: 'navigation', label: `Viewed ${currentPage}` })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  function toggleSidebar() {
    // Below the lg breakpoint the sidebar is an off-canvas drawer; above it,
    // the VPMS logo collapses/expands the persistent icon rail (section 3).
    if (window.innerWidth < 1024) setMobileOpen((value) => !value)
    else setCollapsed((value) => !value)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-50 h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${collapsed ? 'lg:w-[76px]' : 'lg:w-64'} w-64 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
          className="flex items-center gap-3 px-4 py-5 border-b border-slate-200 hover:bg-slate-50 transition-colors text-left"
        >
          <img src={`${import.meta.env.BASE_URL}vpms-logo.svg`} alt="VPMS" className="w-10 h-10 rounded object-contain flex-shrink-0 border border-slate-200 p-1" />
          {!collapsed && (
            <span className="min-w-0">
              <span className="brand-mark block text-sm font-bold tracking-tight text-slate-900 leading-tight truncate">VPMS</span>
              <span className="block text-[11px] uppercase tracking-[0.12em] text-slate-500">Vidmar Performance Management System</span>
            </span>
          )}
        </button>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {!collapsed && <div className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Management views</div>}
          {visibleNavItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-[#FDECEC] text-[#B42318]' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-3 py-3">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            title={collapsed ? `${user?.name} · ${user?.role}` : undefined}
            className={`w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-100 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#FDECEC] text-[#B42318] flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initials(user?.name)}</div>
            {!collapsed && (
              <span className="min-w-0 text-left">
                <span className="block text-xs font-semibold text-slate-800 truncate">{user?.name}</span>
                <span className="block text-[10px] text-slate-500 truncate">{user?.role}</span>
              </span>
            )}
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className={`flex flex-col h-screen transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        {/* Wraps header + main so the header's timeframe picker and every
            dashboard page (via Outlet) share one reporting-period selection —
            this is the app's only timeframe control. */}
        <ReportingPeriodProvider>
          <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4 z-30">
            <button aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMobileOpen((v) => !v)} className="lg:hidden text-slate-500">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#B42318]">VPMS executive dashboard</div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight truncate">{currentPage}</h1>
            </div>
            <div className="ml-auto flex-shrink-0">
              <HeaderTimeframePicker />
            </div>
          </header>
          <div className="px-4 sm:px-6 pt-4 flex-shrink-0">
            <DataStatus source={companyInfo.dataSource} isProvisional={companyInfo.dataIsProvisional} />
          </div>
          <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </ReportingPeriodProvider>
      </div>

      <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} />
      {/* mainRef lets the Notes Assistant watch scroll position on the actual
          scrolling element (<main>, not the window) to decide when to tuck
          itself toward the edge — see NotesAssistant.jsx for the full heuristic. */}
      <NotesAssistant scrollContainerRef={mainRef} />
    </div>
  )
}
