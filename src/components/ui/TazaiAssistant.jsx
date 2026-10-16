import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ExternalLink, MessageCircle, Minus, NotebookPen, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { quickTazaiReply, readChats, saveChats, scheduleTazaiNoteEmail } from '../../lib/tazai.js'

const portrait = `${import.meta.env.BASE_URL}bagheera/avatar.svg`

function firstName(name = '') {
  return name.split(' · ')[0].split(' ')[0] || 'there'
}

export function TazaiAssistant({ scrollContainerRef, currentPage, social = false }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('chat')
  const [shy, setShy] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [chats, setChats] = useState(() => {
    try { return user ? readChats(user) : [] } catch { return [] }
  })
  const [selectedId, setSelectedId] = useState(() => chats[0]?.id || null)
  const notesKey = user ? `tazai-notes-${user.id}` : null
  const emailKey = user ? `tazai-note-email-${user.id}` : null
  const [notes, setNotes] = useState(() => {
    try { return notesKey ? localStorage.getItem(notesKey) || '' : '' } catch { return '' }
  })
  const [emailSchedule, setEmailSchedule] = useState(() => {
    try { return emailKey ? JSON.parse(localStorage.getItem(emailKey)) : null } catch { return null }
  })
  const [emailStatus, setEmailStatus] = useState(emailSchedule ? 'scheduled' : 'idle')
  const triggerRef = useRef(null)
  const inputRef = useRef(null)
  const endRef = useRef(null)
  const selected = chats.find(chat => chat.id === selectedId)
  const messages = selected?.messages || []

  useEffect(() => {
    const container = scrollContainerRef?.current
    if (!container) return undefined
    const onScroll = () => setShy(container.scrollTop > 24)
    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [scrollContainerRef])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    requestAnimationFrame(() => inputRef.current?.focus())
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, mode])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  useEffect(() => {
    if (!emailSchedule) return undefined
    const markReady = () => setEmailStatus('ready')
    const timer = setTimeout(markReady, Math.max(0, emailSchedule.dueAt - Date.now()))
    return () => clearTimeout(timer)
  }, [emailSchedule])

  if (!user) return null

  function persist(next) {
    try { saveChats(user, next); setChats(next); setError('') }
    catch (cause) { setError(cause.message) }
  }

  function send(event) {
    event.preventDefault()
    const prompt = text.trim()
    if (!prompt) return
    const now = new Date().toISOString()
    const userMessage = { id: crypto.randomUUID(), role: 'user', text: prompt }
    const response = { id: crypto.randomUUID(), role: 'assistant', text: quickTazaiReply(prompt, user, currentPage) }
    const chat = selected
      ? { ...selected, messages: [...messages, userMessage, response], updatedAt: now }
      : { id: crypto.randomUUID(), title: prompt.slice(0, 55), updatedAt: now, messages: [userMessage, response] }
    persist([chat, ...chats.filter(item => item.id !== chat.id)])
    setSelectedId(chat.id)
    setText('')
  }

  function newChat() {
    setSelectedId(null)
    setText('')
    setError('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function changeNotes(event) {
    const value = event.target.value
    setNotes(value)
    const schedule = scheduleTazaiNoteEmail(value, user, currentPage)
    try {
      if (notesKey) localStorage.setItem(notesKey, value)
      if (emailKey && schedule) localStorage.setItem(emailKey, JSON.stringify(schedule))
      else if (emailKey) localStorage.removeItem(emailKey)
      setEmailSchedule(schedule)
      setEmailStatus(schedule ? 'scheduled' : 'idle')
      setError('')
    } catch { setError('Your note could not be saved in this browser.') }
  }

  const bottom = social ? 'bottom-40 md:bottom-24' : 'bottom-24 md:bottom-6'
  return <div className={`fixed right-3 z-[60] md:right-5 ${bottom}`}>
    {open && <section id="quick-tazai-panel" role="dialog" aria-modal="false" aria-label="Quick Bagheera assistant" className="absolute bottom-[68px] right-0 flex h-[min(560px,calc(100vh-9rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_55px_rgba(15,23,42,.24)]">
      <header className="flex shrink-0 items-center gap-3 bg-[#1E4DFF] px-4 py-3 text-white">
        <img src={portrait} alt="" className="h-10 w-10 rounded-full object-cover object-top" />
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Bagheera</h2><p className="truncate text-xs text-blue-100">Quick help on {currentPage}</p></div>
        {mode === 'chat' && <button type="button" onClick={newChat} aria-label="Start a new quick chat" title="New chat" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Plus size={18} /></button>}
        <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus() }} aria-label="Minimize quick Bagheera" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Minus size={18} /></button>
      </header>
      <div className="grid shrink-0 grid-cols-2 border-b border-slate-200 bg-white p-1" role="tablist" aria-label="Quick Bagheera tools">
        <button type="button" role="tab" aria-selected={mode === 'chat'} onClick={() => setMode('chat')} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium ${mode === 'chat' ? 'bg-[#EEF2FF] text-[#1E4DFF]' : 'text-slate-600 hover:bg-slate-50'}`}><MessageCircle size={16} />Chat</button>
        <button type="button" role="tab" aria-selected={mode === 'notes'} onClick={() => setMode('notes')} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium ${mode === 'notes' ? 'bg-[#EEF2FF] text-[#1E4DFF]' : 'text-slate-600 hover:bg-slate-50'}`}><NotebookPen size={16} />Notes</button>
      </div>
      {mode === 'chat' ? <>
        <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
          {!messages.length ? <div className="flex h-full flex-col justify-center"><h3 className="text-lg font-semibold text-slate-900">Hello, {firstName(user.name)}.</h3><p className="mt-2 text-sm leading-6 text-slate-600">Ask a quick question without leaving {currentPage}. This conversation will also appear in your full Bagheera history.</p></div> : <div className="space-y-4">{messages.map(message => <article key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[88%] rounded-2xl bg-slate-100 px-3 py-2.5' : 'max-w-[94%]'}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{message.text}</p></article>)}<div ref={endRef} /></div>}
        </div>
        <form onSubmit={send} className="shrink-0 border-t border-slate-200 p-3">
          {error && <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-[#1E4DFF] focus-within:ring-2 focus-within:ring-[#1E4DFF]/15"><textarea ref={inputRef} aria-label="Quick message to Bagheera" value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }} rows={2} maxLength={1000} placeholder="Ask Bagheera…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none" /><button type="submit" disabled={!text.trim()} aria-label="Send quick message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E4DFF] text-white disabled:bg-slate-200 disabled:text-slate-400"><ArrowUp size={18} /></button></div>
          <Link to="/tazai" className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[#1E4DFF] underline-offset-4 hover:underline">Open full Bagheera <ExternalLink size={13} /></Link>
        </form>
      </> : <div className="flex min-h-0 flex-1 flex-col p-4"><label htmlFor="quick-tazai-notes" className="text-sm font-semibold text-slate-900">Notes for later</label><p className="mt-1 text-xs leading-5 text-slate-500">Saved privately here and queued for {user.email} ten minutes after you stop typing.</p><textarea ref={inputRef} id="quick-tazai-notes" value={notes} onChange={changeNotes} maxLength={6000} placeholder="Write a note while you review this page…" className="mt-3 min-h-0 flex-1 resize-none rounded-xl border border-slate-300 p-3 text-sm leading-6 text-slate-900 placeholder:text-slate-500 focus:border-[#1E4DFF] focus:outline-none focus:ring-2 focus:ring-[#1E4DFF]/15" />{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}<div className="mt-2 flex items-start justify-between gap-3 text-[11px] text-slate-500"><p role="status" className="leading-4">{emailStatus === 'scheduled' && `Queued for ${new Date(emailSchedule.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Editing resets the timer.`}{emailStatus === 'ready' && 'Ready to email when the VPMS mail service is connected.'}</p><span className="shrink-0 tabular-nums">{notes.length} / 6000</span></div></div>}
    </section>}
    <button ref={triggerRef} type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="quick-tazai-panel" aria-label={open ? 'Close quick Bagheera' : 'Open quick Bagheera'} title="Quick chat with Bagheera" className={`ml-auto block h-14 w-14 overflow-hidden rounded-full shadow-[0_10px_28px_rgba(15,23,42,.28)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E4DFF] ${shy && !open ? 'translate-x-3 opacity-80 md:translate-x-2' : ''}`}><img src={portrait} alt="" className="h-full w-full object-cover object-top" /></button>
  </div>
}
