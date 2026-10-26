import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import { hasPermission, homePath } from './auth/permissions.js'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import Bagheera from './pages/dashboard/Tazai.jsx'
import Login from './pages/Login.jsx'
import Executive from './pages/dashboard/Executive.jsx'
import BalancedScorecard from './pages/dashboard/BalancedScorecard.jsx'
import DepartmentScorecards from './pages/dashboard/DepartmentScorecards.jsx'
import StrategyMap from './pages/dashboard/StrategyMap.jsx'
import ScorecardsWorkspace from './pages/dashboard/ScorecardsWorkspace.jsx'
import Operations from './pages/dashboard/Operations.jsx'
import Financial from './pages/dashboard/Financial.jsx'
import KPIHeatmap from './pages/dashboard/KPIHeatmap.jsx'
import Projects from './pages/dashboard/Projects.jsx'
import Activities from './pages/dashboard/Activities.jsx'
import CompanyActivities from './pages/dashboard/CompanyActivities.jsx'
import DepartmentSupport from './pages/dashboard/DepartmentSupport.jsx'
import TaskLinkedProjects from './pages/dashboard/TaskLinkedProjects.jsx'
import Forum, { ForumFeed, ForumThread, ForumModeration } from './pages/dashboard/Forum.jsx'
import Admin from './pages/dashboard/Admin.jsx'
import KpiSetup from './pages/dashboard/KpiSetup.jsx'
import KpiEntry from './pages/dashboard/KpiEntry.jsx'
import KpiApprovals from './pages/dashboard/KpiApprovals.jsx'
import Kpi, { KpiIndex } from './pages/dashboard/Kpi.jsx'
import LiveWorkspacePage from './pages/dashboard/LiveWorkspacePage.jsx'
import BsgPage from './pages/dashboard/BsgPage.jsx'
import FinancesPage from './pages/dashboard/FinancesPage.jsx'

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
  return <Navigate to={window.matchMedia('(max-width: 767px)').matches ? '/tazai' : homePath(user)} replace />
}

function LoginRoute() {
  const { user } = useAuth()
  return user ? <Navigate to={window.matchMedia('(max-width: 767px)').matches ? '/tazai' : homePath(user)} replace /> : <Login />
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="tazai" element={<Bagheera />} />
        <Route element={<RequirePermission permission="dashboard.department" />}>
          <Route path="my-department" element={<DepartmentScorecards />} />
        </Route>
        <Route element={<RequirePermission permission="forum.post" />}>
          <Route path="profile" element={<Forum />}><Route index element={<ForumFeed profile />} /></Route>
          <Route path="forum" element={<Forum />}>
            <Route index element={<ForumFeed />} />
            <Route path="moderation" element={<ForumModeration />} />
            <Route path=":postId" element={<ForumThread />} />
          </Route>
        </Route>
        <Route element={<RequirePermission permission="support.department" />}>
          <Route path="activities" element={<Activities basePath="/activities" />}>
            <Route index element={<DepartmentSupport />} />
            <Route path="projects" element={<TaskLinkedProjects />} />
          </Route>
        </Route>
        <Route path="kpi" element={<Kpi />}>
          <Route index element={<KpiIndex />} />
          <Route element={<RequirePermission permission="kpi.submit" />}>
            <Route path="entry" element={<KpiEntry />} />
          </Route>
          <Route element={<RequirePermission permission="dashboard.org" />}>
            <Route path="register" element={<KPIHeatmap />} />
          </Route>
          <Route element={<RequirePermission permission="kpi.configure" />}><Route path="setup" element={<KpiSetup />} /></Route>
          <Route element={<RequirePermission permission="kpi.approve" />}>
            <Route path="approvals" element={<KpiApprovals />} />
          </Route>
        </Route>
        <Route element={<RequirePermission permission="dashboard.org" />}>
          <Route path="executive" element={<Executive />} />
          <Route path="scorecards" element={<ScorecardsWorkspace />}>
            <Route index element={<BalancedScorecard />} />
            <Route path="strategy" element={<StrategyMap />} />
          </Route>
          <Route path="scorecard" element={<Navigate to="/scorecards" replace />} />
          <Route path="departments" element={<DepartmentScorecards />} />
          <Route path="strategy" element={<Navigate to="/scorecards/strategy" replace />} />
          <Route path="operations" element={<Operations />} />
          <Route path="live-workspace" element={<LiveWorkspacePage />} />
          <Route path="finances" element={<FinancesPage />} />
          <Route path="bsg" element={<BsgPage />} />
          <Route path="financial" element={<Financial />} />
          <Route path="heatmap" element={<Navigate to="/kpi/register" replace />} />
          <Route path="projects" element={<Navigate to="/support-overview/projects" replace />} />
          <Route path="support-overview" element={<Activities />}>
            <Route index element={<CompanyActivities />} />
            <Route path="projects" element={<Projects />} />
          </Route>
        </Route>
        <Route element={<RequirePermission permission="system.configure" />}>
          <Route path="admin" element={<Admin />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
}
