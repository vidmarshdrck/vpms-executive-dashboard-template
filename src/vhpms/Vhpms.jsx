import { useEffect, useRef, useState } from 'react'
import './theme.css'
import './vhpms.css'
import { signIn, readSession, saveSession, clearSession } from './auth.js'
import { parseDirectory, homeView, findAccount, withCurrentRole, canSee, scopedDepartment, entryDepartment, isViewOnly } from './directory.js'
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
import ProfilePage from './ProfilePage.jsx'
import { InboxView, SmsDashboard } from './InboxSms.jsx'
import { emptyActivities, parseActivities, ACTIVITY_KEY } from './activities.js'
import { emptyLabels, parseLabels, mergeLabels, inboxFromSms, labelTransaction, clearPrivateSms, SMS_LABELS_KEY } from './sms.js'
import { fetchSms, pushSmsLabel, endSmsSession, smsWatchKey } from './smsClient.js'

const DIR_KEY = 'vhpms-directory-v1'
const SCORE_KEY = 'vhpms-scorecard-v1'
const BOOKS_KEY = 'vhpms-books-v1'
const WORKSPACE = new Set(['operations', 'tasks', 'projects', 'priorities', 'calendar', 'receipts', 'sources'])
const LIVE_VIEWS = new Set(['activities', 'inbox', 'sms', 'business', 'business-list'])

function readStored(key, parse, fallback) {
  try { return parse(localStorage.getItem(key)) } catch { return fallback }
}

const TITLES = {
  gm: 'GM Dashboard', hr: 'Human Resources', departments: 'Departments', upload: 'Upload Scorecard', 'kpi-entry': 'Enter KPI Data',
  operations: 'Operations', tasks: 'Tasks', projects: 'Projects', priorities: 'Weekly priorities', calendar: 'Calendar',
  receipts: 'Receipts', sources: 'Source records', 'admin-departments': 'Admin · Departments', 'admin-kpis': 'Admin · KPIs',
  'admin-users': 'Admin · Users', 'admin-businesses': 'Admin · Businesses', 'business-list': 'Businesses', business: 'Business',
  activities: 'Activities', inbox: 'Inbox', sms: 'SMS Transactions', profile: 'Profile',
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
  const smsGeneration = useRef(0)
  const smsKey = smsWatchKey(user)

  function persist(key, value, setter) {
    try { localStorage.setItem(key, JSON.stringify(value)); setter(value) } catch { setError('Could not save in this browser.') }
  }
  useEffect(() => {
    if (!smsKey) return undefined
    const generation = smsGeneration.current
    let cancelled = false
    fetchSms({ env: import.meta.env, token: user?.token || '' }).then((result) => {
      if (!cancelled && smsGeneration.current === generation) setSmsRemote(result)
    })
    return () => { cancelled = true }
  }, [smsKey, user?.token])
  function open(next) {
    setView(next)
    setMenu(false)
    if (!LIVE_VIEWS.has(next)) setMode('management')
  }
  function rememberLabel(next) {
    setLabels(next)
    try { localStorage.setItem(SMS_LABELS_KEY, JSON.stringify(next)) } catch { /* the service copy is the durable record */ }
    setSmsRemote((current) => ({
      ...current,
      rows: current.rows.map((row) => {
        const label = next.byId?.[row.id]
        return label ? { ...row, businessId: label.businessId, purpose: label.purpose } : row
      }),
    }))
  }
  async function labelSms(id, fields) {
    const saved = await pushSmsLabel({ env: import.meta.env, token: user?.token || '', id, businessId: fields.businessId, purpose: fields.purpose })
    if (!saved.ok) throw new Error('The label was not saved. The item is still in the Inbox.')
    rememberLabel(labelTransaction(labels, id, fields.businessId, fields.purpose))
  }
  async function login(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    const result = await signIn(String(fields.get('username') || ''), String(fields.get('password') || ''), { directory })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    const next = result.token ? { ...result.user, token: result.token } : result.user
    saveSession(next, result.token)
    setUser(next)
    setMode('management')
    setView(homeView(result.user))
    if (result.user.dept) setSelectedDept(result.user.dept)
  }
  function switchRole(value) {
    const account = findAccount(user.username, directory) || user
    const next = { ...withCurrentRole(account, value === 'all' ? null : value), token: user.token }
    setUser(next)
    saveSession(next, next.token)
    if (!canSee(next, view)) setView(homeView(next))
  }
  function logout() {
    smsGeneration.current += 1
    clearSession()
    clearPrivateSms(localStorage)
    setLabels(emptyLabels())
    setSmsRemote({ ok: true, rows: [] })
    setSmsFocus('')
    void endSmsSession({ env: import.meta.env })
    setUser(null)
    setView('login')
    setMode('management')
    setMenu(false)
  }
  if (!user) return <LoginScreen error={error} busy={busy} onSubmit={login} />

  const activeUser = withCurrentRole(findAccount(user.username, directory) || user, user.currentRole)
  const sessionUser = user.token ? { ...activeUser, token: user.token } : activeUser
  const displayView = canSee(sessionUser, view) ? view : homeView(sessionUser)
  const deptCode = displayView === 'hr' ? 'hr' : (scopedDepartment(sessionUser) || selectedDept)
  const department = scorecard.departments.find((item) => item.code === deptCode)
  const business = books.businesses.find((item) => item.id === businessId)
  const title = displayView === 'department' || displayView === 'hr' ? (department?.name || 'Department') : displayView === 'business' ? (business?.name || 'Business') : (TITLES[displayView] || 'Dashboard')
  const model = buildOrganisation(scorecard.kpis, scorecard.year)
  const smsRows = mergeLabels(smsRemote.rows, labels)

  return (
    <Shell
      user={sessionUser}
      view={displayView}
      menu={menu}
      setMenu={setMenu}
      mode={mode}
      books={books}
      businessId={businessId}
      inboxCount={inboxFromSms(smsRows).length}
      title={title}
      onOpen={open}
      onLive={() => { setReturnView(displayView); setMode('businesses'); setView('activities'); setMenu(false) }}
      onBack={() => { setMode('management'); setView(returnView || homeView(sessionUser)); setMenu(false) }}
      onBusiness={(id) => { setBusinessId(id); setView('business'); setMenu(false) }}
      onRole={switchRole}
      onLogout={logout}
    >
      {displayView === 'gm' && <GmDashboard model={model} scorecard={scorecard} viewOnly={isViewOnly(sessionUser)} />}
      {displayView === 'departments' && <Departments scorecard={scorecard} onOpen={(code) => { setSelectedDept(code); open('department') }} />}
      {(displayView === 'department' || displayView === 'hr') && <DepartmentHeatMap scorecard={scorecard} code={deptCode} />}
      {displayView === 'kpi-entry' && <KpiEntry scorecard={scorecard} user={{ ...sessionUser, dept: entryDepartment(sessionUser) }} onSave={(id, period) => persist(SCORE_KEY, recordPeriod(scorecard, id, period), setScorecard)} />}
      {displayView === 'upload' && <UploadScorecard />}
      {displayView === 'admin-departments' && <AdminDepartments scorecard={scorecard} onChange={(next) => persist(SCORE_KEY, next, setScorecard)} />}
      {displayView === 'admin-kpis' && <AdminKpis scorecard={scorecard} onChange={(next) => persist(SCORE_KEY, next, setScorecard)} />}
      {displayView === 'admin-users' && <AdminUsers directory={directory} onChange={(next) => persist(DIR_KEY, next, setDirectory)} />}
      {displayView === 'admin-businesses' && <AdminBusinesses books={books} onChange={(next) => persist(BOOKS_KEY, next, setBooks)} />}
      {displayView === 'business-list' && <BusinessList books={books} onOpen={(id) => { setBusinessId(id); setView('business') }} />}
      {displayView === 'business' && <BusinessHome books={books} businessId={businessId} token={sessionUser.token || ''} onChange={(next) => persist(BOOKS_KEY, next, setBooks)} />}
      {displayView === 'activities' && <ActivitiesBoard state={activities} onChange={(next) => persist(ACTIVITY_KEY, next, setActivities)} />}
      {displayView === 'profile' && <ProfilePage user={sessionUser} onLogout={logout} />}
      {displayView === 'inbox' && <InboxView rows={smsRows} books={books} onLabel={labelSms} onOpenSms={(id) => { setSmsFocus(id); open('sms') }} />}
      {displayView === 'sms' && <SmsDashboard user={sessionUser} books={books} rows={smsRows} loadError={!smsRemote.ok} labels={labels} focusId={smsFocus} onLabelled={rememberLabel} />}
      {WORKSPACE.has(displayView) && <WorkspaceViews view={displayView} state={planner} save={(next) => persist(STORAGE_KEY, next, setPlanner)} />}
    </Shell>
  )
}
