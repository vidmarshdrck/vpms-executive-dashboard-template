import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import { hasPermission, homePath } from './auth/permissions.js'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import Login from './pages/Login.jsx'
import Executive from './pages/dashboard/Executive.jsx'
import BalancedScorecard from './pages/dashboard/BalancedScorecard.jsx'
import DepartmentScorecards from './pages/dashboard/DepartmentScorecards.jsx'
import StrategyMap from './pages/dashboard/StrategyMap.jsx'
import Operations from './pages/dashboard/Operations.jsx'
import Financial from './pages/dashboard/Financial.jsx'
import KPIHeatmap from './pages/dashboard/KPIHeatmap.jsx'
import Projects from './pages/dashboard/Projects.jsx'
import Support from './pages/dashboard/Support.jsx'
import Admin from './pages/dashboard/Admin.jsx'

function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

// Route-level authorization guard. This is the real enforcement point for
// role-restricted pages — navigating directly to /admin as a Management
// viewer is blocked here, not just by the sidebar omitting the link.
function RequirePermission({ permission }) {
  const { user } = useAuth()
  return hasPermission(user, permission) ? <Outlet /> : <Navigate to={homePath(user)} replace />
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePath(user)} replace />
}

function LoginRoute() {
  const { user } = useAuth()
  return user ? <Navigate to={homePath(user)} replace /> : <Login />
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route element={<RequirePermission permission="dashboard.department" />}>
          <Route path="my-department" element={<DepartmentScorecards />} />
        </Route>
        <Route element={<RequirePermission permission="dashboard.org" />}>
          <Route path="executive" element={<Executive />} />
          <Route path="scorecard" element={<BalancedScorecard />} />
          <Route path="departments" element={<DepartmentScorecards />} />
          <Route path="strategy" element={<StrategyMap />} />
          <Route path="operations" element={<Operations />} />
          <Route path="financial" element={<Financial />} />
          <Route path="heatmap" element={<KPIHeatmap />} />
          <Route path="projects" element={<Projects />} />
          <Route path="support" element={<Support />} />
        </Route>
        <Route element={<RequirePermission permission="system.configure" />}>
          <Route path="admin" element={<Admin />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
}
