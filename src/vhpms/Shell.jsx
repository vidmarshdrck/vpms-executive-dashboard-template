import { useEffect, useState } from 'react'
import { BUSINESS_ICONS, NavIcon, MenuIcon } from './icons.jsx'
import { VidmarCredit } from './Donut.jsx'
import { accountRoles, roleLabel, managementLinks, adminLinks, WORKSPACE_LINKS } from './directory.js'
import { activeBusinesses } from './books.js'
import { readSidebarRetracted, writeSidebarRetracted } from './sidebar.js'
import { ReportingPeriodProvider, TimeframePopover } from './TimeframePopover.jsx'

const PERIOD_HIDDEN = new Set(['profile', 'activities', 'inbox', 'sms'])

const LOGIN_SLIDES = [
  ['business.webp', 'Glass office towers'],
  ['markets.webp', 'A rising trading chart'],
  ['estate.webp', 'A house and keys'],
  ['transport.webp', 'An airplane wing above the clouds'],
  ['tech.webp', 'A computer circuit board'],
  ['classical.webp', 'The Colosseum, a ring of classical arches'],
]

export function LoginScreen({ error, busy, onSubmit }) {
  const [slide, setSlide] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  useEffect(() => {
    const media = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media && media.matches) return undefined
    const timer = setInterval(() => setSlide((current) => (current + 1) % LOGIN_SLIDES.length), 7000)
    return () => clearInterval(timer)
  }, [])
  const base = import.meta.env.BASE_URL || '/'
  return (
    <div className="vh-app">
      <div className="login-shell">
        <div className="login-slides" aria-hidden="true">
          {LOGIN_SLIDES.map(([file], index) => (
            <img key={file} src={`${base}login/${file}`} alt="" className={[index === slide ? 'is-active' : '', file === 'transport.webp' ? 'is-transport' : ''].filter(Boolean).join(' ')} loading={index === 0 ? 'eager' : 'lazy'} />
          ))}
          <div className={LOGIN_SLIDES[slide][0] === 'markets.webp' ? 'login-markets-shade is-active' : 'login-markets-shade'} />
        </div>
        <div className="login-layout">
          <div className="login-stage" />
          <div className="login-card">
            <div className="login-brand">
              <span className="brand-name">VHPMS</span>
            </div>
            <h1>Performance Management System</h1>
            <p className="sub">Sign in with your PMS account.</p>
            {error && <div className="form-msg error">{error}</div>}
            <form onSubmit={onSubmit} noValidate>
              <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" type="text" autoComplete="username" required /></div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="password-field">
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required />
                  <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)}><NavIcon name={showPassword ? 'eye-off' : 'eye'} /></button>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </form>
            <p className="login-foot"><VidmarCredit /></p>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavButton({ item, current, onOpen }) {
  return <button type="button" aria-current={current === item.id ? 'page' : undefined} onClick={() => onOpen(item.id)}><NavIcon name={item.icon} /><span className="nav-label">{item.label}</span></button>
}

const LIVE_LINKS = [
  { id: 'activities', label: 'Activities', icon: 'clipboard' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox' },
  { id: 'sms', label: 'SMS Transactions', icon: 'activity' },
]

export default function Shell({ user, view, menu, setMenu, mode, books, businessId, inboxCount = 0, onOpen, onLive, onBack, onBusiness, onRole, title, headerAction = null, today, children }) {
  return (
    <ReportingPeriodProvider userId={user?.username || user?.id || ''} today={today}>
      <ShellFrame user={user} view={view} menu={menu} setMenu={setMenu} mode={mode} books={books} businessId={businessId} inboxCount={inboxCount} onOpen={onOpen} onLive={onLive} onBack={onBack} onBusiness={onBusiness} onRole={onRole} title={title} headerAction={headerAction} today={today}>{children}</ShellFrame>
    </ReportingPeriodProvider>
  )
}

function ShellFrame({ user, view, menu, setMenu, mode, books, businessId, inboxCount = 0, onOpen, onLive, onBack, onBusiness, onRole, title, headerAction = null, today, children }) {
  const businesses = activeBusinesses(books)
  const [retracted, setRetracted] = useState(() => (typeof localStorage === 'undefined' ? false : readSidebarRetracted(localStorage)))
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    writeSidebarRetracted(localStorage, retracted)
  }, [retracted])
  function toggleSidebar() {
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
    if (mobile) { setMenu(false); return }
    setRetracted((current) => !current)
  }
  return (
    <div className={`vh-app${retracted ? ' sidebar-retracted' : ''}`}>
      <aside className={`sidebar ${menu ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-sticky">
        <button type="button" className="sidebar-brand" aria-controls="sidebar" aria-expanded={menu || !retracted} aria-label={retracted && !menu ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleSidebar}>
          <span className="brand-logo" aria-hidden="true"><NavIcon name="hexagon" /></span>
          <span className="brand-text"><span className="brand-name">Vidmar Holdings</span><span className="brand-sub">VHPMS</span></span>
        </button>
        <nav className="side-nav" aria-label="Primary navigation">
          {mode === 'businesses' ? (
            <>
              {LIVE_LINKS.map((item) => <button type="button" key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => onOpen(item.id)}><NavIcon name={item.icon} /><span className="nav-label">{item.label}{item.id === 'inbox' && inboxCount > 0 ? ` (${inboxCount})` : ''}</span></button>)}
              <div className="side-label spaced">Businesses</div>
              {businesses.map((business) => <button type="button" key={business.id} aria-current={view === 'business' && businessId === business.id ? 'page' : undefined} onClick={() => onBusiness(business.id)}><NavIcon name={BUSINESS_ICONS[business.id] || 'building'} /><span className="nav-label">{business.name}</span></button>)}
              {!businesses.length && <p className="side-label">No active businesses</p>}
              <button type="button" className="back-management" onClick={onBack}><NavIcon name="dashboard" /><span className="nav-label">Back to management</span></button>
            </>
          ) : (
            <>
              <div className="side-label">Management views</div>
              {managementLinks(user).map((item) => <NavButton key={item.id} item={item} current={view} onOpen={onOpen} />)}
              <div className="side-label spaced">Workspace</div>
              {WORKSPACE_LINKS.map((item) => <NavButton key={item.id} item={item} current={view} onOpen={onOpen} />)}
              {adminLinks(user).length > 0 && <div className="side-label spaced">Administration</div>}
              {adminLinks(user).map((item) => <NavButton key={item.id} item={item} current={view} onOpen={onOpen} />)}
            </>
          )}
        </nav>
        {mode === 'management' && <button type="button" className="live-btn" onClick={onLive}><span className="nav-label">Live workspace</span></button>}
        <div className="side-user">
          {accountRoles(user).length > 1 && (
            <label className="role-switch">
              <span>Current role</span>
              <select aria-label="Current role" value={user.currentRole || 'all'} onChange={(event) => onRole(event.target.value)}>
                <option value="all">All roles</option>
                {accountRoles(user).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
            </label>
          )}
        </div>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenu(false)} />
      <div className="app-main">
        <header className="app-header">
          <button className="menu-btn" type="button" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><MenuIcon /></button>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">VHPMS performance management</div>
            <div className="page-title">{title}</div>
          </div>
          <div className="header-tools">
            {headerAction}
            {!PERIOD_HIDDEN.has(view) && <TimeframePopover pageTitle={title} today={today} />}
            <div className="profile-slot">
              <button type="button" className="profile-btn" aria-label="Profile" onClick={() => onOpen('profile')}>
                <span className="avatar" aria-hidden="true"><NavIcon name="user" /></span>
              </button>
            </div>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
