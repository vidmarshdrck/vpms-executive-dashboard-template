import { useEffect, useRef, useState } from 'react'
import { Bot, Minus } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'

// VPMS in-app notes assistant. Frontend-only: notes are kept in this
// browser (localStorage, scoped per user) and there is no real mail
// service wired up — the "email it to you" line in the intro is part of the
// assistant's scripted persona, not a live integration. Do not connect this
// to a real backend without updating that copy to match reality.

const IDLE_MS = 5 * 60 * 1000
const CORNER_PROXIMITY_PX = 180

// Greetings use a first name only ("Hi Jane" not "Hi Jane Doe").
function firstName(name = '') {
  return name.split(' ')[0] || 'there'
}

export function NotesAssistant({ scrollContainerRef }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [introToShow, setIntroToShow] = useState(false)
  const [shy, setShy] = useState(false)
  const [pointerNear, setPointerNear] = useState(false)
  const notesKey = user ? `vpms-notes-${user.id}` : null
  const introKey = user ? `vpms-intro-seen-${user.id}` : null

  // Restore any notes already jotted down this browser, so an accidental
  // panel close doesn't lose them. Read lazily as the initial state (not in
  // an effect) so there's no cascading re-render on mount.
  const [notes, setNotes] = useState(() => {
    if (!notesKey) return ''
    try {
      return localStorage.getItem(notesKey) || ''
    } catch {
      return '' // localStorage unavailable (private mode etc.)
    }
  })
  const [status, setStatus] = useState('idle') // 'idle' | 'typing' | 'ready'
  const idleTimer = useRef(null)

  // "Senses" that the page has been scrolled (i.e. there is now real content
  // sitting where the button rests) and eases toward the right edge, as if
  // sliding behind the laptop bezel. A pointer near that corner, or the
  // panel being open, brings it back out.
  useEffect(() => {
    const el = scrollContainerRef?.current
    if (!el) return undefined
    function handleScroll() { setShy(el.scrollTop > 24) }
    handleScroll()
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollContainerRef])

  useEffect(() => {
    function handlePointerMove(event) {
      const nearCorner = window.innerWidth - event.clientX < CORNER_PROXIMITY_PX
        && window.innerHeight - event.clientY < CORNER_PROXIMITY_PX
      setPointerNear(nearCorner)
    }
    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [])

  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current) }, [])

  if (!user) return null

  // "Tucked" = button slid toward the edge. True only when the page has been
  // scrolled (shy) AND the pointer isn't hovering nearby AND the panel isn't
  // open — i.e. get out of the way only when nothing is actively using it.
  const tucked = shy && !pointerNear && !open

  // Opens/closes the panel. The scripted introduction is shown at most once
  // per browser session per user (tracked via sessionStorage under
  // `introKey`) — reopening the panel later in the same session just shows
  // the notes, not the full "Hi, I'm the VPMS Assistant..." speech again.
  function handleToggle() {
    setOpen((value) => {
      const next = !value
      if (next) {
        const alreadySeen = introKey ? sessionStorage.getItem(introKey) === '1' : true
        setIntroToShow(!alreadySeen)
        if (!alreadySeen && introKey) {
          try { sessionStorage.setItem(introKey, '1') } catch { /* ignore */ }
        }
      }
      return next
    })
  }

  // Saves every keystroke to localStorage immediately (so nothing is lost),
  // and separately restarts a 5-minute idle timer on every keystroke. Once
  // that timer fires uninterrupted, status flips to 'ready' and the UI shows
  // the "notes ready to send" line — no email is actually sent (see the
  // file-level comment above); this only simulates the persona's promise.
  function handleNotesChange(event) {
    const value = event.target.value
    setNotes(value)
    setStatus('typing')
    if (notesKey) {
      try { localStorage.setItem(notesKey, value) } catch { /* ignore */ }
    }
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setStatus('ready'), IDLE_MS)
  }

  const name = firstName(user.name)

  return (
    <div className="fixed bottom-6 right-6 z-[70] flex flex-col items-end">
      {open && (
        <div className="mb-3 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#B42318] text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Bot size={18} />
              <span className="text-sm font-bold truncate">Notes Assistant</span>
            </div>
            <button type="button" aria-label="Minimize Notes Assistant" onClick={handleToggle} className="text-white/80 hover:text-white flex-shrink-0">
              <Minus size={16} />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {introToShow ? (
              <p className="text-sm text-slate-700 leading-6">
                Hi {name}, I'm the VPMS Assistant. I'll help you take down notes as you
                go through these dashboards, and I'll email them to you five minutes after you stop typing.
                You can minimize or expand me anytime by clicking the button.
              </p>
            ) : (
              <p className="text-xs text-slate-500">Hi {name}, pick up your notes below.</p>
            )}

            <textarea
              value={notes}
              onChange={handleNotesChange}
              rows={6}
              placeholder="Jot down anything you want to follow up on..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#B42318]/30 focus:border-[#B42318]"
            />

            {status === 'ready' && (
              <p className="text-[11px] font-semibold text-emerald-600">
                ✓ Notes ready to send to {user.email}
              </p>
            )}

            <p className="text-[11px] text-slate-400">
              Saved in this browser for this session only. Email delivery isn't connected to a live mail
              service yet.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        onMouseEnter={() => setPointerNear(true)}
        onMouseLeave={() => setPointerNear(false)}
        aria-label={open ? 'Close Notes Assistant' : 'Open Notes Assistant'}
        title="Notes Assistant"
        className={`relative w-12 h-12 rounded-full bg-[#B42318] text-white flex items-center justify-center transition-all duration-300 ease-out hover:-translate-y-0.5 shadow-[0_8px_24px_rgba(180,35,24,0.45)] hover:shadow-[0_12px_28px_rgba(180,35,24,0.55)] ${tucked ? 'translate-x-[42%] opacity-70' : 'translate-x-0 opacity-100'}`}
      >
        <Bot size={22} />
      </button>
    </div>
  )
}
