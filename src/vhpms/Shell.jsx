import { NavIcon, MenuIcon } from './icons.jsx'
import { initials, roleLine, managementLinks, adminLinks, WORKSPACE_LINKS } from './directory.js'
import { activeBusinesses } from './books.js'

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
          <p className="login-foot">Powered by VIDMΛR</p>
        </div>
      </div>
    </div>
  )
}

function NavButton({ item, current, onOpen }) {
  return <button type="button" aria-current={current === item.id ? 'page' : undefined} onClick={() => onOpen(item.id)}><NavIcon name={item.icon} />{item.label}</button>
}

export default function Shell({ user, view, menu, setMenu, mode, books, businessId, onOpen, onLive, onBack, onBusiness, onHome, onLogout, title, children }) {
  const businesses = activeBusinesses(books)
  return (
    <div className="vh-app">
      <aside className={`sidebar ${menu ? 'open' : ''}`} id="sidebar">
        <button type="button" className="sidebar-brand" onClick={onHome}>
          <span className="brand-logo">VH</span>
          <span className="brand-text"><span className="brand-name">Vidmar Holdings</span><span className="brand-sub">VHPMS</span></span>
        </button>
        <nav className="side-nav" aria-label="Primary navigation">
          {mode === 'businesses' ? (
            <>
              <button type="button" className="back-management" onClick={onBack}><NavIcon name="dashboard" />Back to management</button>
              <div className="side-label">Businesses</div>
              {businesses.map((business) => <button type="button" key={business.id} aria-current={view === 'business' && businessId === business.id ? 'page' : undefined} onClick={() => onBusiness(business.id)}><NavIcon name="building" />{business.name}</button>)}
              {!businesses.length && <p className="side-label">No active businesses</p>}
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
        {mode === 'management' && <button type="button" className="live-btn" onClick={onLive}>Live workspace</button>}
        <div className="side-user">
          <div className="side-user-row">
            <span className="avatar">{initials(user.name)}</span>
            <span style={{ minWidth: 0 }}>
              <span className="side-user-name">{user.name}</span>
              <span className="side-user-role">{roleLine(user)}</span>
            </span>
          </div>
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
