import { useEffect, useState } from 'react'
import { NavIcon, MenuIcon } from './icons.jsx'
import { VidmarCredit } from './Donut.jsx'
import { accountRoles, initials, roleLabel, roleLine, managementLinks, adminLinks, WORKSPACE_LINKS } from './directory.js'
import { activeBusinesses } from './books.js'
import { readSidebarRetracted, writeSidebarRetracted } from './sidebar.js'

export function LoginScreen({ error, busy, onSubmit }) {
  return (
    <div className="vh-app">
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-logo">VH</span>
            <span className="brand-text"><span className="brand-name">Vidmar Holdings</span><span className="brand-sub">VHPMS</span></span>
          </div>
          <p className="brand-eyebrow">Vidmar Holdings</p>
          <h1>Performance Management System</h1>
          <p className="sub">Sign in with your PMS account.</p>
          {error && <div className="form-msg error">{error}</div>}
          <form onSubmit={onSubmit} noValidate>
            <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" type="text" autoComplete="username" required /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="login-foot"><VidmarCredit /></p>
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

export default function Shell({ user, view, menu, setMenu, mode, books, businessId, inboxCount = 0, onOpen, onLive, onBack, onBusiness, onLogout, onRole, title, children }) {
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
        <button type="button" className="sidebar-brand" aria-controls="sidebar" aria-expanded={menu || !retracted} aria-label={retracted && !menu ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleSidebar}>
          <span className="brand-logo">VH</span>
          <span className="brand-text"><span className="brand-name">Vidmar Holdings</span><span className="brand-sub">VHPMS</span></span>
        </button>
        <nav className="side-nav" aria-label="Primary navigation">
          {mode === 'businesses' ? (
            <>
              {LIVE_LINKS.map((item) => <button type="button" key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => onOpen(item.id)}><NavIcon name={item.icon} /><span className="nav-label">{item.label}{item.id === 'inbox' && inboxCount > 0 ? ` (${inboxCount})` : ''}</span></button>)}
              <div className="side-label spaced">Businesses</div>
              {businesses.map((business) => <button type="button" key={business.id} aria-current={view === 'business' && businessId === business.id ? 'page' : undefined} onClick={() => onBusiness(business.id)}><NavIcon name="building" /><span className="nav-label">{business.name}</span></button>)}
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
          <div className="side-user-row">
            <span className="avatar">{initials(user.name)}</span>
            <span style={{ minWidth: 0 }}>
              <span className="side-user-name">{user.name}</span>
              <span className="side-user-role">{roleLine(user)}</span>
            </span>
          </div>
          {accountRoles(user).length > 1 && (
            <label className="role-switch">
              <span>Current role</span>
              <select aria-label="Current role" value={user.currentRole || 'all'} onChange={(event) => onRole(event.target.value)}>
                <option value="all">All roles</option>
                {accountRoles(user).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="logout" onClick={onLogout}>Log out</button>
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
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
