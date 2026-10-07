import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

// Six depot photographs from the organization's asset library, cross-fading on a
// timer. Purely decorative — the credentials themselves are never shown on
// this page (see forgotten-password note below and demoAuth.js).
const BASE = import.meta.env.BASE_URL
const BACKGROUND_IMAGES = [
  `${BASE}login-bg-1.jpg`,
  `${BASE}login-bg-2.jpg`,
  `${BASE}login-bg-3.jpg`,
  `${BASE}login-bg-4.jpg`,
  `${BASE}login-bg-5.jpg`,
  `${BASE}login-bg-6.jpg`,
]
const SLIDE_INTERVAL_MS = 5000

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [showForgotNotice, setShowForgotNotice] = useState(false)
  const [bgIndex, setBgIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setBgIndex((i) => (i + 1) % BACKGROUND_IMAGES.length), SLIDE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  function submit(event) {
    event.preventDefault()
    if (!login(email, password)) setError('Those credentials were not recognised. Check your username and password and try again.')
  }

  return <main className="min-h-screen lg:h-screen grid lg:grid-cols-[1.15fr_1fr] bg-white">
    <section className="relative hidden lg:flex overflow-hidden bg-stone-950 text-white p-12 xl:p-16 flex-col justify-between">
      {BACKGROUND_IMAGES.map((src, index) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
          style={{ backgroundImage: `url(${src})`, opacity: index === bgIndex ? 1 : 0 }}
          aria-hidden="true"
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-stone-950/60" aria-hidden="true" />
      {/* Logo lives on the white side (below), not here — see the form section. */}
      <div />
      <div className="relative max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-white/70 mb-4">Management reporting</p>
        <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.05] tracking-tight">A clear view of performance, operations, and delivery.</h1>
        <p className="text-sm leading-6 text-white/75 mt-5 max-w-md">Strategic KPIs and operational follow-through for your organization's management, in one place.</p>
      </div>
      <div className="relative flex items-center gap-2 text-xs text-white/70"><ShieldCheck size={16} /> Authorised personnel only · Confidential</div>
    </section>
      <section className="flex flex-col p-6 sm:p-10 xl:p-16 overflow-y-auto">
        {/* Logo + brand name live here, on the white side, for every screen size. */}
        <div className="mb-8 flex items-center gap-3">
          <img src={`${BASE}vpms-logo.svg`} alt="VPMS" className="w-9 h-9 rounded border border-slate-200 object-contain p-1" />
          <div><div className="brand-mark text-base font-bold tracking-tight text-[#B42318]">VPMS</div><div className="text-[10px] uppercase tracking-[.14em] text-slate-500">Vidmar Performance Management System</div></div>
        </div>
        <div className="flex-1 flex items-center">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#B42318]">Secure sign-in</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-2">Sign in to the VPMS dashboard</h2>
            <p className="text-sm text-slate-500 mt-1.5">Enter your assigned credentials to continue.</p>
          </div>
          <form onSubmit={submit} className="space-y-3.5">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Username</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="text" autoComplete="username" autoCapitalize="none" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900" placeholder="e.g. ict_head" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Password</span>
              <div className="relative mt-1.5">
                <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm text-slate-900" placeholder="Password" />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
              <div className="mt-1.5 text-right">
                <button type="button" onClick={() => setShowForgotNotice((v) => !v)} className="text-xs font-semibold text-[#B42318] hover:underline">Forgot password?</button>
              </div>
              {showForgotNotice && (
                <p className="mt-1.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                  Self-service password reset is not yet available. Contact your system administrator to have your password reset.
                </p>
              )}
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button type="submit" className="w-full rounded-lg bg-[#B42318] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#8F1D14] transition-colors"><LockKeyhole size={16} className="inline mr-2" />Sign in</button>
          </form>
        </div>
        </div>
      </section>
  </main>
}
