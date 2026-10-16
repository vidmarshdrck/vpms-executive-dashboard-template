import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, AudioLines, Check, History, Mic, Plus, Square, Pencil, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { departments } from '../../data/scorecardData.js'
import { readChats, saveChats, prepareTaskRequest } from '../../lib/tazai.js'
import { createAssistantTask, listCompanyTasks, listTasks } from '../../lib/departmentTasks.js'
import { readAttachments, validateAttachments } from '../../lib/attachments.js'
import { AttachmentList, AttachmentPicker } from '../../components/ui/Attachments.jsx'
import TaskCreateDialog from '../../components/ui/TaskCreateDialog.jsx'

const portrait = `${import.meta.env.BASE_URL}bagheera/avatar.svg`
export default function Bagheera() {
  const { user } = useAuth()
  return <TazaiChat key={user.id} user={user} />
}
function TazaiChat({ user }) {
  const [initial] = useState(() => { try { return { chats: readChats(user), error: '' } } catch { return { chats: [], error: 'Your chat history could not be loaded. Try refreshing before starting a new chat.' } } })
  const [chats, setChats] = useState(initial.chats), [selectedId, setSelectedId] = useState(initial.chats[0]?.id || null)
  const [text, setText] = useState(''), [attachments, setAttachments] = useState([]), [error, setError] = useState(initial.error)
  const [uploading, setUploading] = useState(false), [historyOpen, setHistoryOpen] = useState(false), [renaming, setRenaming] = useState(null)
  const [draft, setDraft] = useState(null), [recording, setRecording] = useState(false), [live, setLive] = useState(false), [voiceStatus, setVoiceStatus] = useState('')
  const attachmentsRef = useRef(attachments)
  useEffect(() => { attachmentsRef.current = attachments }, [attachments])
  const endRef = useRef(null), sendRef = useRef(null), recorderRef = useRef(null), streamRef = useRef(null), recognitionRef = useRef(null), timerRef = useRef(null)
  const selected = chats.find(chat => chat.id === selectedId)
  const messages = selected?.messages || []
  const canCreate = ['GM', 'Dept Head', 'Staff', 'Admin'].includes(user.role)
  const closeDraft = useCallback(() => setDraft(null), [])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'instant' }) }, [selectedId, messages.length])
  useEffect(() => () => { clearTimeout(timerRef.current); recognitionRef.current?.stop(); if (recorderRef.current?.state === 'recording') { recorderRef.current.onstop = null; recorderRef.current.stop() }; streamRef.current?.getTracks().forEach(track => track.stop()) }, [])
  function persist(next) { saveChats(user, next); setChats(next); setError('') }
  function newChat() { if (recording || live) { setError('Stop voice capture before starting a new chat.'); return }; setSelectedId(null); setText(''); setAttachments([]); setHistoryOpen(false); setError('') }
  function send(event) {
    event?.preventDefault()
    if ((!text.trim() && !attachments.length) || recording || uploading) return
    const message = { id: crypto.randomUUID(), role: 'user', text: text.trim(), attachments }
    let reply = 'I can help you prepare a task request, find your tasks, or navigate the PMS. Tell me what needs attention and which department should receive it.'
    let taskDraft
    if (!text.trim()) reply = 'Your attachment is saved in this conversation. Add a short description so I can help prepare a task request. File contents and voice recordings are not analysed yet.'
    else if (/\b(my tasks|show tasks|list tasks)\b/i.test(text)) {
      try {
        const tasks = user.role === 'GM' ? listCompanyTasks(user, departments) : user.departmentId ? listTasks(user) : []
        reply = tasks.length ? `Here are ${tasks.length} task${tasks.length === 1 ? '' : 's'}:\n${tasks.slice(0, 12).map(task => `• ${task.title} — ${task.status}`).join('\n')}\nOpen Activities to view or update them.` : 'There are no tasks available for this account yet.'
      } catch (cause) { reply = cause.message }
    } else if (/\b(task|ticket|printer|network|password|issue|error|broken|not working|outage|laptop)\b/i.test(text)) {
      if (canCreate) { taskDraft = prepareTaskRequest(text, user, departments, attachments); reply = 'I’ve prepared a task request. Review its details and receiving department before creating it. Priority is assigned automatically.' }
      else reply = 'Your account has view access. Ask your department head to create this request.'
    } else if (/\b(kpi|goal|target)\b/i.test(text)) reply = 'The GM sets department targets under KPI → KPI setup, then activates them for a year and quarter. Department users enter actuals under KPI → KPI entry. Automatic actuals come from approved book entries for that period.'
    else if (/\b(hello|hi|hey|good morning)\b/i.test(text)) reply = `Hello, ${user.name.split(' · ')[0]}. I’m Bagheera, your PMS task assistant. What would you like to follow up on today?`
    const response = { id: crypto.randomUUID(), role: 'assistant', text: reply, taskDraft }
    const now = new Date().toISOString()
    const chat = selected ? { ...selected, messages: [...messages, message, response], updatedAt: now } : { id: crypto.randomUUID(), title: (text.trim() || attachments[0]?.name || 'New chat').slice(0, 55), updatedAt: now, messages: [message, response] }
    try { persist([chat, ...chats.filter(item => item.id !== chat.id)]); setSelectedId(chat.id); setText(''); setAttachments([]) }
    catch (cause) { setError(cause.message) }
  }
  function rename(id, value) {
    const title = value.trim().slice(0, 80)
    if (!title) { setRenaming(null); return }
    try { persist(chats.map(chat => chat.id === id ? { ...chat, title } : chat)); setRenaming(null) }
    catch (cause) { setError(cause.message) }
  }
  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Voice recording is unavailable in this browser. You can attach an audio file instead.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream
      const type = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const recorder = new MediaRecorder(stream, { mimeType: type }); recorderRef.current = recorder
      const chunks = []
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = async () => {
        clearTimeout(timerRef.current); setRecording(false); stream.getTracks().forEach(track => track.stop())
        try { const file = new File(chunks, `Voice note.${type === 'audio/webm' ? 'webm' : 'ogg'}`, { type }); const added = await readAttachments([file]); setAttachments(validateAttachments([...attachmentsRef.current, ...added])); setVoiceStatus('Voice note attached. Add a description, then send.') }
        catch (cause) { setError(cause.message) }
      }
      recorder.start(); setRecording(true); setVoiceStatus('Recording… tap Stop when finished.'); setError('')
      timerRef.current = setTimeout(() => recorder.state === 'recording' && recorder.stop(), 60000)
    } catch { streamRef.current?.getTracks().forEach(track => track.stop()); setError('Microphone access was not available. Allow it in your browser settings or attach a voice file.') }
  }
  function toggleLive() {
    if (live) { recognitionRef.current?.stop(); setLive(false); setVoiceStatus(''); return }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) { setError('Live dictation is not supported in this browser. Use the microphone button to record a voice note, or type your message.'); return }
    const recognition = new Recognition(); recognitionRef.current = recognition
    recognition.lang = 'en-GB'; recognition.continuous = true; recognition.interimResults = false
    recognition.onresult = event => { const transcript = [...event.results].slice(event.resultIndex).map(result => result[0].transcript).join(' '); setText(previous => `${previous} ${transcript}`.trim()) }
    recognition.onerror = () => { setError('Live dictation stopped. Check microphone permission or type your message.'); setLive(false) }
    recognition.onend = () => { setLive(false); setVoiceStatus('') }
    try { recognition.start(); setLive(true); setVoiceStatus('Listening. Your words will appear below; press Send when ready.'); setError('') } catch { setError('Could not start live dictation. Try a voice note instead.') }
  }
  function createTask(form) {
    createAssistantTask(user, { ...form, assistantRequestId: draft.messageId }, departments)
    const receiver = departments.find(department => department.id === form.departmentId)?.name
    const response = { id: crypto.randomUUID(), role: 'assistant', text: `Task created for ${receiver}: “${form.title}”. The receiving department can find it in Activities.`, created: true }
    const next = chats.map(chat => chat.id === selectedId ? { ...chat, messages: [...chat.messages.map(message => message.id === draft.messageId ? { ...message, taskCreated: true } : message), response] } : chat)
    // A saved task must not be created again if chat storage subsequently fills up.
    setDraft(null)
    setChats(next)
    try { saveChats(user, next) } catch { setError('The task was created, but chat history could not be saved. Do not submit it again.') }
  }
  return <section className="tazai-workspace relative grid h-full min-h-0 md:grid-cols-[240px_minmax(0,1fr)]" aria-label="Bagheera chat">
    {historyOpen && <button type="button" aria-label="Close chat history" className="absolute inset-0 z-30 bg-slate-900/30 md:hidden" onClick={() => setHistoryOpen(false)} />}
    <aside className={`${historyOpen ? 'flex absolute inset-y-0 left-0 z-40 w-72 shadow-xl' : 'hidden'} min-h-0 flex-col border-r border-slate-200 bg-[#F3F2EE] p-4 md:static md:flex md:w-auto md:shadow-none`} aria-label="Personal chat history">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-800">Your chats</h2><button type="button" aria-label="Close chat history" onClick={() => setHistoryOpen(false)} className="md:hidden"><X size={18} /></button></div>
      <button type="button" onClick={newChat} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"><Plus size={17} />New chat</button>
      <div className="mt-4 flex-1 space-y-1 overflow-y-auto">{!chats.length && <p className="px-2 text-sm leading-6 text-slate-500">Your conversations will appear here after your first message.</p>}{chats.map(chat => <div key={chat.id} className={`group flex items-center gap-1 rounded-lg ${chat.id === selectedId ? 'bg-white' : 'hover:bg-white/60'}`}>
        {renaming === chat.id ? <input aria-label="Chat title" autoFocus defaultValue={chat.title} maxLength={80} onBlur={event => rename(chat.id, event.target.value)} onKeyDown={event => { if (event.key === 'Enter') rename(chat.id, event.currentTarget.value); if (event.key === 'Escape') setRenaming(null) }} className="min-w-0 flex-1 rounded border border-[#1E4DFF] p-2 text-sm" /> : <button type="button" disabled={recording || live} onClick={() => { setSelectedId(chat.id); setHistoryOpen(false); setText(''); setAttachments([]) }} aria-current={chat.id === selectedId ? 'page' : undefined} className="min-w-0 flex-1 truncate px-3 py-3 text-left text-sm text-slate-700">{chat.title}</button>}
        <button type="button" aria-label={`Rename ${chat.title}`} title="Rename chat" onClick={() => setRenaming(chat.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-[#1E4DFF]"><Pencil size={14} /></button>
      </div>)}</div>
    </aside>
    <div className="flex min-h-0 min-w-0 flex-col bg-white">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6"><button type="button" aria-label="Open chat history" onClick={() => setHistoryOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 md:hidden"><History size={20} /></button><img src={portrait} alt="Bagheera" className="h-10 w-10 rounded-full object-cover object-top" /><div><h2 className="text-sm font-semibold text-slate-900">Bagheera</h2><p className="text-xs text-slate-500">Vidmar Holdings · Personal task assistant</p></div><button type="button" onClick={newChat} aria-label="New chat" className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><Plus size={20} /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {!messages.length ? <div className="mx-auto flex h-full max-w-xl flex-col justify-center pb-6"><img src={portrait} alt="" className="mb-5 h-16 w-16 rounded-full object-cover object-top" /><h3 className="text-2xl font-semibold leading-tight text-slate-900">Hello, {user.name.split(' · ')[0]}.</h3><p className="mt-3 text-base leading-7 text-slate-600">I’m Bagheera. Tell me what needs attention, and we’ll take it from there.</p><div className="mt-6 flex flex-wrap gap-2">{['My printer is not working', 'Show my tasks', 'Where are my KPI targets?'].map(prompt => <button key={prompt} type="button" onClick={() => setText(prompt)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:border-[#1E4DFF] hover:text-[#1E4DFF]">{prompt}</button>)}</div></div> : <div className="mx-auto max-w-2xl space-y-6">{messages.map(message => <article key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[90%] rounded-2xl bg-[#F3F2EE] p-4' : 'max-w-full'} aria-label={message.role === 'user' ? 'Your message' : 'Bagheera response'}>
          {message.role === 'assistant' && <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><img src={portrait} alt="" className="h-7 w-7 rounded-full object-cover object-top" />Bagheera</div>}
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{message.text}</p><AttachmentList files={message.attachments} />
          {message.taskDraft && !message.taskCreated && <button type="button" onClick={event => { sendRef.current = event.currentTarget; setDraft({ ...message.taskDraft, messageId: message.id }) }} className="mt-3 min-h-10 rounded-lg bg-[#1E4DFF] px-4 text-sm font-semibold text-white">Review task request</button>}
          {message.taskCreated && <span className="mt-2 inline-flex items-center gap-1 text-xs text-green-700"><Check size={14} />Task created</span>}
        </article>)}<div ref={endRef} /></div>}
      </div>
      <form onSubmit={send} className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4 pt-2 sm:px-6">
        {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
        {voiceStatus && <p role="status" className="mb-2 text-xs text-slate-600">{voiceStatus}</p>}
        <div className="rounded-2xl border border-slate-300 bg-white p-3 focus-within:border-[#1E4DFF]">
          <textarea aria-label="Message Bagheera" value={text} onChange={event => setText(event.target.value)} rows={2} maxLength={4000} placeholder="Message Bagheera…" className="block max-h-40 w-full resize-none bg-transparent text-base leading-6 text-slate-900 placeholder:text-slate-500 focus:outline-none" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }} />
          <div className="mt-2 flex items-end gap-1"><div className="min-w-0 flex-1"><AttachmentPicker compact files={attachments} onChange={setAttachments} onBusy={setUploading} /></div><button type="button" disabled={live || uploading} onClick={toggleRecording} aria-label={recording ? 'Stop voice note' : 'Record voice note'} title={recording ? 'Stop recording' : 'Record voice note'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${recording ? 'bg-red-100 text-red-700' : 'text-slate-600 hover:bg-slate-100'}`}>{recording ? <Square size={17} /> : <Mic size={19} />}</button><button type="button" disabled={recording} onClick={toggleLive} aria-pressed={live} aria-label="Live voice" title="Live dictation" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${live ? 'bg-[#EEF2FF] text-[#1E4DFF]' : 'text-slate-600 hover:bg-slate-100'}`}><AudioLines size={19} /></button><button ref={sendRef} type="submit" disabled={(!text.trim() && !attachments.length) || uploading || recording || Boolean(initial.error)} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E4DFF] text-white disabled:bg-slate-200 disabled:text-slate-400"><ArrowUp size={20} /></button></div>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">Review task details before creating a request. Documents and voice notes stay attached to your conversation.</p>
      </form>
    </div>
    {draft && <TaskCreateDialog initialValues={draft} departments={departments} onClose={closeDraft} onCreate={createTask} triggerRef={sendRef} />}
  </section>
}
