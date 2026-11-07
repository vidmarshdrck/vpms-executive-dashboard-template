import { useEffect, useState } from 'react'
import './theme.css'
import './vhpms.css'
import { signIn, readSession, saveSession, clearSession } from './auth.js'
import { parseDirectory, homeView, findAccount } from './directory.js'
import { emptyState, parseState, STORAGE_KEY } from './model.js'
import { freshScorecard, loadScorecard, buildOrganisation, recordPeriod } from './score.js'
import { emptyBooks, parseBooks } from './books.js'
import Shell, { LoginScreen } from './Shell.jsx'
import GmDashboard from './GmDashboard.jsx'
import { Departments, DepartmentHeatMap } from './DepartmentViews.jsx'
import { KpiEntry, UploadScorecard } from './EntryViews.jsx'
import { AdminDepartments, AdminKpis, AdminUsers, AdminBusinesses } from './AdminViews.jsx'
import { BusinessList, BusinessHome } from './BusinessHome.jsx'
import WorkspaceViews from './WorkspaceViews.jsx'
import ActivitiesBoard from './ActivitiesBoard.jsx'
import { InboxView, SmsDashboard } from './InboxSms.jsx'
import { emptyActivities, parseActivities, ACTIVITY_KEY } from './activities.js'
import { emptyLabels, parseLabels, mergeLabels, inboxFromSms, labelTransaction, SMS_LABELS_KEY } from './sms.js'
import { fetchSms, pushSmsLabel } from './smsClient.js'

const DIR_KEY = 'vhpms-directory-v1'
const SCORE_KEY = 'vhpms-scorecard-v1'
const BOOKS_KEY = 'vhpms-books-v1'
const WORKSPACE = new Set(['operations', 'tasks', 'projects', 'priorities', 'calendar', 'receipts', 'sources'])
const LIVE_VIEWS = new Set(['activities', 'inbox', 'sms', 'business', 'business-list'])

function readStored(key, parse, fallback) {
  try { return parse(localStorage.getItem(key)) } catch { return fallback }
}

const TITLES = {
  gm: 'GM Dashboard', departments: 'Departments', upload: 'Upload Scorecard', 'kpi-entry': 'Enter KPI Data',
  operations: 'Operations', tasks: 'Tasks', projects: 'Projects', priorities: 'Weekly priorities', calendar: 'Calendar',
  receipts: 'Receipts', sources: 'Source records', 'admin-departments': 'Admin · Departments', 'admin-kpis': 'Admin · KPIs',
  'admin-users': 'Admin · Users', 'admin-businesses': 'Admin · Businesses', 'business-list': 'Businesses', business: 'Business',
  activities: 'Activities', inbox: 'Inbox', sms: 'SMS Transactions',
}

export default function Vhpms() {
  const [directory, setDirectory] = useState(() => readStored(DIR_KEY, parseDirectory, parseDirectory(null)))
  const [user, setUser] = useState(() => readSession(readStored(DIR_KEY, parseDirectory, parseDirectory(null))))
  const [view, setView] = useState(() => homeView(readSession(readStored(DIR_KEY, parseDirectory, parseDirectory(null)))))
  const [menu, setMenu] = useState(false)
  const [mode, setMode] = useState('management')
  const [returnView, setReturnView] = useState('gm')
  const [selectedDept, setSelectedDept] = useState('engineering')
  const [businessId, setBusinessId] = useState('ve')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [planner, setPlanner] = useState(() => readStored(STORAGE_KEY, parseState, emptyState()))
  const [scorecard, setScorecard] = useState(() => readStored(SCORE_KEY, loadScorecard, freshScorecard()))
  const [books, setBooks] = useState(() => readStored(BOOKS_KEY, parseBooks, emptyBooks()))
  const [activities, setActivities] = useState(() => readStored(ACTIVITY_KEY, parseActivities, emptyActivities()))
  const [labels, setLabels] = useState(() => readStored(SMS_LABELS_KEY, parseLabels, emptyLabels()))
  const [smsRemote, setSmsRemote] = useState({ ok: true, rows: [] })
  const [smsFocus, setSmsFocus] = useState('')

  function persist(key, value, setter) {
    try { localStorage.setItem(key, JSON.stringify(value)); setter(value) } catch { setError('Could not save in this browser.') }
  }
  useEffect(() => {
    if (!user?.token && !import.meta.env.VITE_SUPABASE_URL) return undefined
    let cancelled = false
    fetchSms({ env: import.meta.env, token: user?.token || '' }).then((result) => { if (!cancelled) setSmsRemote(result) })
    return () => { cancelled = true }
  }, [user?.token])
  function open(next) {
    setView(next)
    setMenu(false)
    if (!LIVE_VIEWS.has(next)) setMode('management')
  }
  async function labelSms(id, fields) {
    const next = labelTransaction(labels, id, fields.businessId, fields.purpose)
    const saved = await pushSmsLabel({ env: import.meta.env, token: user?.token || '', id, businessId: fields.businessId, purpose: fields.purpose })
    if (!saved.ok) throw new Error('The SMS service did not confirm the label.')
    persist(SMS_LABELS_KEY, next, setLabels)
  }
  async function login(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    const result = await signIn(String(fields.get('username') || ''), String(fields.get('password') || ''), { directory })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    saveSession(result.user, result.token)
    setUser(result.token ? { ...result.user, token: result.token } : result.user)
    setMode('management')
    setView(homeView(result.user))
    if (result.user.dept) setSelectedDept(result.user.dept)
  }
  function logout() {
    clearSession()
    setUser(null)
    setView('login')
    setMode('management')
    setMenu(false)
  }
  if (!user) return <LoginScreen error={error} busy={busy} onSubmit={login} />

  const deptCode = (user.role === 'dept_head' || user.role === 'staff') ? user.dept : selectedDept
  const department = scorecard.departments.find((item) => item.code === deptCode)
  const business = books.businesses.find((item) => item.id === businessId)
  const title = view === 'department' ? (department?.name || 'Department') : view === 'business' ? (business?.name || 'Business') : (TITLES[view] || 'Dashboard')
  const model = buildOrganisation(scorecard.kpis, scorecard.year)

  return (
    <Shell
      user={findAccount(user.username, directory) || user}
      view={view}
      menu={menu}
      setMenu={setMenu}
      mode={mode}
      books={books}
      businessId={businessId}
      inboxCount={inboxFromSms(mergeLabels(smsRemote.rows, labels)).length}
      title={title}
      onOpen={open}
      onHome={() => { setMode('management'); open(homeView(user)) }}
      onLive={() => { setReturnView(view); setMode('businesses'); setView('activities'); setMenu(false) }}
      onBack={() => { setMode('management'); setView(returnView || homeView(user)); setMenu(false) }}
      onBusiness={(id) => { setBusinessId(id); setView('business'); setMenu(false) }}
      onLogout={logout}
    >
      {view === 'gm' && <GmDashboard model={model} scorecard={scorecard} viewOnly={user.role === 'board'} />}
      {view === 'departments' && <Departments scorecard={scorecard} onOpen={(code) => { setSelectedDept(code); open('department') }} />}
      {view === 'department' && <DepartmentHeatMap scorecard={scorecard} code={deptCode} />}
      {view === 'kpi-entry' && <KpiEntry scorecard={scorecard} user={user} onSave={(id, period) => persist(SCORE_KEY, recordPeriod(scorecard, id, period), setScorecard)} />}
      {view === 'upload' && <UploadScorecard />}
      {view === 'admin-departments' && <AdminDepartments scorecard={scorecard} onChange={(next) => persist(SCORE_KEY, next, setScorecard)} />}
      {view === 'admin-kpis' && <AdminKpis scorecard={scorecard} onChange={(next) => persist(SCORE_KEY, next, setScorecard)} />}
      {view === 'admin-users' && <AdminUsers directory={directory} onChange={(next) => persist(DIR_KEY, next, setDirectory)} />}
      {view === 'admin-businesses' && <AdminBusinesses books={books} onChange={(next) => persist(BOOKS_KEY, next, setBooks)} />}
      {view === 'business-list' && <BusinessList books={books} onOpen={(id) => { setBusinessId(id); setView('business') }} />}
      {view === 'business' && <BusinessHome books={books} businessId={businessId} onChange={(next) => persist(BOOKS_KEY, next, setBooks)} />}
      {view === 'activities' && <ActivitiesBoard state={activities} onChange={(next) => persist(ACTIVITY_KEY, next, setActivities)} />}
      {view === 'inbox' && <InboxView rows={mergeLabels(smsRemote.rows, labels)} books={books} onLabel={labelSms} onOpenSms={(id) => { setSmsFocus(id); open('sms') }} />}
      {view === 'sms' && <SmsDashboard user={user} books={books} rows={mergeLabels(smsRemote.rows, labels)} loadError={!smsRemote.ok} labels={labels} focusId={smsFocus} onLabelled={(next) => persist(SMS_LABELS_KEY, next, setLabels)} />}
      {WORKSPACE.has(view) && <WorkspaceViews view={view} state={planner} save={(next) => persist(STORAGE_KEY, next, setPlanner)} />}
    </Shell>
  )
}
