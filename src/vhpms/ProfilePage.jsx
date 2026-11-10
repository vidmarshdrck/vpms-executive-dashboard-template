import { PageFooter } from './Donut.jsx'
import { accountRoles, roleLabel } from './directory.js'

export default function ProfilePage({ user, onLogout }) {
  const roles = accountRoles(user).map(roleLabel)
  return (
    <div className="wrap">
      <div className="topbar"><div><p className="brand-eyebrow">Account</p><h1>Profile</h1></div></div>
      <section className="card" style={{ maxWidth: 560 }}>
        <div className="card-body">
          <dl className="vh-evidence">
            <div><dt>Name</dt><dd>{user?.name || '—'}</dd></div>
            <div><dt>Username</dt><dd>{user?.username || '—'}</dd></div>
            <div><dt>Roles</dt><dd>{roles.length ? roles.join(', ') : '—'}</dd></div>
          </dl>
          <button type="button" className="btn btn-primary" onClick={onLogout}>Log out</button>
        </div>
      </section>
      <PageFooter />
    </div>
  )
}
