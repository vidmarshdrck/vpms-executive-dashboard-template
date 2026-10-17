import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ThumbsUp, ThumbsDown, MessageCircle, Flag, ImagePlus, X, Trash2, ShieldAlert, Eye, ArrowLeft, Megaphone, CalendarDays, ScrollText, User, Pencil, Share2, Tag, EyeOff, MapPin, Filter } from 'lucide-react'
import ForumProfileHeader from '../../components/ui/ForumProfileHeader.jsx'
import PostImages from '../../components/ui/PostImages.jsx'
import { useUserProfiles } from '../../lib/userProfiles.js'
import ForumHighlights from '../../components/ui/ForumHighlights.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import {
  CATEGORIES, SENSITIVE_CATEGORIES, REPORT_REASONS, MAX_TEXT, MAX_COMMENT,
  subscribeToForum, getFeed, upcomingEvents, getComments, createPost, deletePost, addComment, removeComment, toggleReaction,
  report, getModerationQueue, POST_TYPES, resolveReport, restorePost, validateImage, presentAuthor, canModerate, timeAgo,
} from '../../lib/forumStore.js'
import { useProfilePhotos } from '../../lib/profilePhotos.js'
import { hasPermission } from '../../auth/permissions.js'

function useForumVersion() {
  const [v, setV] = useState(0)
  useEffect(() => subscribeToForum(() => setV((x) => x + 1)), [])
  return v
}

// Runs a store call and shows the validation/authorization error instead of losing it.
function useAction() {
  const [error, setError] = useState('')
  const run = (fn) => { try { fn(); setError(''); return true } catch (e) { setError(e.message); return false } }
  return [error, run]
}

// Subtle category tints: distinguishable without shouting.
const CATEGORY_STYLE = {
  General: 'bg-slate-100 text-slate-600',
  Safety: 'bg-amber-50 text-amber-800',
  'Workplace Concern': 'bg-orange-50 text-orange-800',
  Suggestion: 'bg-sky-50 text-sky-800',
  Operations: 'bg-indigo-50 text-indigo-800',
  'Ethics & Integrity': 'bg-violet-50 text-violet-800',
  'Brand': 'bg-[#EEF2FF] text-[#1638CC]',
  Other: 'bg-stone-100 text-stone-600',
}
const TYPE_LABEL = { POST: 'Post', ANNOUNCEMENT: 'Announcement', EVENT: 'Event' }
const fmtEvent = (ts) => new Date(ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const HUES = ['#1E4DFF', '#0F766E', '#4338CA', '#B45309', '#475569', '#7C3AED']
function Avatar({ item, size = 40 }) {
  const photos = useProfilePhotos()
  const profiles = useUserProfiles()
  const photo = item.showName ? photos[item.authorId] : null
  const n = Number(String(item.staffNo).replace(/\D/g, '')) || 0
  return (
    <span className="flex flex-shrink-0 items-center justify-center rounded-full text-white" style={{ width: size, height: size, background: HUES[n % HUES.length] }} aria-hidden="true">
      {photo ? <img src={photo} alt="" className="h-full w-full rounded-full object-cover" /> : item.showName ? <span className="text-xs font-bold">{(profiles[item.authorId]?.displayName || item.displayName).split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span> : <User size={size * 0.5} />}
    </span>
  )
}

// ---------------------------------------------------------------- right rail
function RailCard({ icon: Icon, title, children }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_-12px_rgba(16,24,40,0.12)]">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Icon size={16} className="text-[#1E4DFF]" />{title}</h3>
      {children}
    </section>
  )
}

function RightRail({ showHighlights = true }) {
  const { user } = useAuth()
  const version = useForumVersion()
  const announcements = useMemo(() => getFeed(user).filter((p) => p.status === 'VISIBLE' && p.type === 'ANNOUNCEMENT').slice(0, 3), [user, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const events = useMemo(() => upcomingEvents(user), [user, version]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      {showHighlights && <ForumHighlights />}
      <RailCard icon={Megaphone} title="Announcements">
        {announcements.length ? (
          <ul className="space-y-3">{announcements.map((a) => (
            <li key={a.id}><Link to={`/forum/${a.id}`} className="block"><div className="line-clamp-2 text-sm font-semibold text-slate-800 hover:text-[#1E4DFF]">{a.text}</div><p className="text-xs text-slate-500">{timeAgo(a.createdAt)}</p></Link></li>
          ))}</ul>
        ) : <p className="text-xs text-slate-500">No announcements.</p>}
      </RailCard>
      <RailCard icon={CalendarDays} title="Upcoming events">
        {events.length ? (
          <ul className="space-y-3">{events.map((e) => (
            <li key={e.id}><Link to={`/forum/${e.id}`} className="block"><div className="text-[11px] font-semibold uppercase tracking-wide text-[#1E4DFF]">{fmtEvent(e.eventAt)}</div><div className="line-clamp-2 text-sm font-semibold text-slate-800">{e.text}</div>{e.location && <div className="text-xs text-slate-500">{e.location}</div>}</Link></li>
          ))}</ul>
        ) : <p className="text-xs text-slate-500">No upcoming events.</p>}
      </RailCard>
      <RailCard icon={ScrollText} title="Forum guidelines">
        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
          <li>Be factual and respectful.</li>
          <li>No personal attacks or unverified accusations.</li>
          <li>Administrators can always see who posted, even when you show only your staff number.</li>
        </ul>
      </RailCard>
      <p className="px-1 text-[11px] text-slate-400">Sample content for the development preview.</p>
    </div>
  )
}

// ------------------------------------------------------------------- shell
export default function Forum() {
  const { user } = useAuth()
  return (
    <div className="forum-ui -mx-4 -mt-4 grid max-w-5xl gap-6 sm:mx-auto sm:mt-0 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white sm:rounded-3xl sm:shadow-[0_8px_30px_-12px_rgba(16,24,40,0.12)] lg:max-w-none">
          <Outlet context={{ user }} />
        </div>
        <div className="mx-4 mt-4 sm:mx-0 lg:hidden"><RightRail /></div>
      </div>
      <aside className="hidden lg:block"><div className="sticky top-0 space-y-4"><RightRail /></div></aside>
    </div>
  )
}

// ---------------------------------------------------------------- composer
function Composer({ placeholder = "What's happening at VPMS?", onPosted, compact = false }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [showName, setShowName] = useState(true) // default: name visible; toggle off to show the staff number only
  const [type, setType] = useState('POST')
  const [eventAt, setEventAt] = useState('')
  const [location, setLocation] = useState('')
  const canAnnounce = hasPermission(user, 'forum.announce')
  const [images, setImages] = useState([])
  const [readingImages, setReadingImages] = useState(false)
  const [error, run] = useAction()
  const fileRef = useRef(null)
  const areaRef = useRef(null)
  const fileId = useId()

  // Single line until the user types, then grows (X-style).
  function grow(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }

  async function pickFile(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setReadingImages(true)
    try {
      if (images.length + files.length > 5) throw new Error('Choose up to five images per post.')
      for (const file of files) { const problem = validateImage(file); if (problem) throw new Error(problem) }
      if (images.reduce((size, src) => size + src.length * 0.75, 0) + files.reduce((size, file) => size + file.size, 0) > 2 * 1024 * 1024) throw new Error('Keep the combined images below 2 MB.')
      const added = await Promise.all(files.map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('An image could not be opened. Try again.')); reader.readAsDataURL(file) })))
      setImages(current => [...current, ...added]); run(() => {})
    } catch (cause) { run(() => { throw cause }) }
    finally { setReadingImages(false); e.target.value = '' }
  }

  function submit(e) {
    e.preventDefault()
    const ok = run(() => { const p = createPost(user, { text, category, showName, images, type, eventAt, location }); onPosted?.(p) })
    if (ok) {
      setText(''); setCategory(''); setImages([]); setType('POST'); setEventAt(''); setLocation('')
      if (fileRef.current) fileRef.current.value = ''
      if (areaRef.current) areaRef.current.style.height = 'auto'
    }
  }

  const me = { authorId: user.id, staffNo: 'EMP-0', showName, displayName: user.name }
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-full text-[#1E4DFF] hover:bg-[#EEF2FF]'
  return (
    <form onSubmit={submit} className="flex gap-3 border-b border-slate-200 px-4 pb-3 pt-4">
      <Avatar item={me} />
      <div className="min-w-0 flex-1">
        <textarea
          ref={areaRef} value={text} rows={1} maxLength={MAX_TEXT} aria-label="Create post" placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); grow(e.target) }}
          className="forum-composer-input block w-full resize-none border-0"
        />
        {(category || !showName || type !== 'POST') && (
          <div className="mb-2 flex flex-wrap gap-2">
            {category && <span className="inline-flex items-center gap-1 rounded-full border border-[#1E4DFF]/30 px-3 py-1 text-xs font-semibold text-[#1E4DFF]">{category}<button type="button" aria-label="Clear category" onClick={() => setCategory('')}><X size={12} /></button></span>}
            {type !== 'POST' && <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#1E4DFF]">{TYPE_LABEL[type]}</span>}
            {!showName && <span className="inline-flex items-center gap-1 rounded-full border border-[#1E4DFF]/30 px-3 py-1 text-xs font-semibold text-[#1E4DFF]">Staff number only</span>}
          </div>
        )}
        {type === 'EVENT' && (
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} aria-label="Event date and time" className="h-10 flex-1 rounded-full border border-slate-200 px-4 text-sm" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" aria-label="Event location" maxLength={120} className="h-10 flex-1 rounded-full border border-slate-200 px-4 text-sm" />
          </div>
        )}
        {SENSITIVE_CATEGORIES.includes(category) && <div className="mb-2"><InlineMessage tone="neutral">Please provide factual information and avoid personal attacks or unverified accusations.</InlineMessage></div>}
        {images.length > 0 && <div className="mb-3 flex gap-2 overflow-x-auto" aria-label="Selected photos">{images.map((src, index) => <div key={index} className="relative h-28 w-28 shrink-0 rounded-xl bg-slate-100"><img src={src} alt={`Selected photo ${index + 1}`} className="h-full w-full rounded-xl object-contain" /><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setImages(current => current.filter((_, i) => i !== index))} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white"><X size={14} /></button></div>)}</div>}
        {readingImages && <p role="status" className="mb-2 text-xs text-slate-500">Reading photos…</p>}
        <div className="-ml-2 flex items-center gap-0.5">
          <input ref={fileRef} type="file" multiple disabled={readingImages} accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickFile} className="hidden" id={fileId} />
          <label htmlFor={fileId} aria-label="Add photo" title="Add photo" className={`${iconBtn} cursor-pointer`}><ImagePlus size={19} /></label>
          {canAnnounce && !compact && (
            <label className={`${iconBtn} relative cursor-pointer`} title="Post type">
              <Megaphone size={19} />
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Post type" className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
                {POST_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>
          )}
          {!compact && type === 'POST' && (
            <label className={`${iconBtn} relative cursor-pointer`} title="Category">
              <Tag size={19} />
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
                <option value="">Category</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={() => setShowName((v) => !v)} aria-pressed={showName} aria-label="Show my name" title={showName ? 'Your name and staff number are shown. Tap to show only your staff number.' : 'Only your staff number is shown. Tap to show your name too.'} className={`${iconBtn} ${showName ? '' : 'bg-[#EEF2FF]'}`}>
            {showName ? <Eye size={19} /> : <EyeOff size={19} />}
          </button>
          <button type="submit" disabled={!text.trim() || readingImages} className="forum-press ml-auto h-9 rounded-full bg-[#1E4DFF] px-5 text-[15px] font-bold text-white disabled:bg-[#1E4DFF]/40">{compact ? 'Reply' : 'Post'}</button>
        </div>
        {text.trim() && <p className="mt-2 text-[11px] text-slate-400">{showName ? 'Colleagues will see your name and staff number.' : 'Colleagues will see only your staff number.'} Administrators can always see who posted.</p>}
        <InlineMessage tone="negative">{error}</InlineMessage>
      </div>
    </form>
  )
}

function ReportMenu({ kind, id }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [error, run] = useAction()
  if (done) return <span className="px-2 text-xs text-slate-500">Reported</span>
  return (
    <span className="relative">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }} aria-label="Report" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Flag size={15} /></button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="px-2 pb-1 text-xs font-semibold text-slate-500">Report this {kind.toLowerCase()}</div>
          {REPORT_REASONS.map((reason) => (
            <button key={reason} type="button" onClick={() => { if (run(() => report(user, { kind, id, reason }))) { setDone(true); setOpen(false) } }} className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50">{reason}</button>
          ))}
          {error && <div className="px-2 pt-1 text-xs text-red-700">{error}</div>}
        </div>
      )}
    </span>
  )
}

// -------------------------------------------------------------------- post
function PostRow({ post, detail = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, run] = useAction()
  useUserProfiles()
  const [shareMessage, setShareMessage] = useState(''), [shareLink, setShareLink] = useState('')
  const who = presentAuthor(post, user)
  const removed = post.status !== 'VISIBLE'
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  const react = (type, Icon, count, active, label) => (
    <button type="button" disabled={removed} onClick={stop(() => run(() => toggleReaction(user, post.id, type)))} aria-pressed={active} aria-label={label}
      className={`forum-press flex h-10 items-center gap-1.5 rounded-full px-3 text-sm ${active ? 'text-[#1E4DFF]' : 'text-slate-500 hover:bg-slate-100'}`}>
      <Icon size={17} fill={active ? 'currentColor' : 'none'} />{count}
    </button>
  )
  async function sharePost() {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}${import.meta.env.VITE_ROUTER === 'hash' ? '#/' : ''}forum/${post.id}`
    setShareMessage(''); setShareLink('')
    try {
      if (navigator.share) { await navigator.share({ title: 'VPMS Forum', text: post.text.slice(0, 150), url }); setShareMessage('Post shared.') }
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setShareMessage('Post link copied.') }
      else { setShareLink(url); setShareMessage('Copy this link to share the post.') }
    } catch (cause) { if (cause.name !== 'AbortError') { setShareLink(url); setShareMessage('Copy this link to share the post.') } }
  }
  const open = () => { if (!detail) navigate(`/forum/${post.id}`) }
  return (
    <article
      onClick={open} role={detail ? undefined : 'link'} tabIndex={detail ? undefined : 0}
      onKeyDown={(e) => { if (!detail && e.key === 'Enter' && e.target === e.currentTarget) open() }}
      className={`flex gap-3 border-b border-slate-200 p-4 ${detail ? '' : 'cursor-pointer hover:bg-slate-50/70'} ${removed ? 'opacity-60' : ''}`}
    >
      <Avatar item={post} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-bold text-slate-900">{who.label}</span>
          <span className="text-xs text-slate-500">· {timeAgo(post.createdAt)}</span>
          {post.type !== 'POST' && <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#1E4DFF]">{post.type === 'EVENT' ? <CalendarDays size={11} /> : <Megaphone size={11} />}{TYPE_LABEL[post.type]}</span>}
          {post.category && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLE[post.category] ?? CATEGORY_STYLE.Other}`}>{post.category}</span>}
          {removed && <StatusBadge tone="negative" label={post.status.replaceAll('_', ' ').toLowerCase()} />}
          <span className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
            {post.authorId !== user.id && !removed && <ReportMenu kind="POST" id={post.id} />}
            {!removed && (post.authorId === user.id || canModerate(user)) && (
              <button type="button" aria-label="Delete post" onClick={stop(() => { if (window.confirm('Remove this post?')) run(() => deletePost(user, post.id)) })} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900"><Trash2 size={15} /></button>
            )}
          </span>
        </div>
        {who.trueAuthor && <div className="mt-0.5 flex items-center gap-1 text-xs text-[#1E4DFF]"><Eye size={12} />Moderator view — author: {who.trueAuthor}</div>}
        <p className={`mt-1 whitespace-pre-wrap break-words text-slate-900 ${detail ? 'text-lg' : 'text-[15px]'}`}>{post.text}</p>
        {post.type === 'EVENT' && post.eventAt && (
          <div className="mt-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            <span className="inline-flex items-center gap-1"><CalendarDays size={13} className="text-[#1E4DFF]" />{fmtEvent(post.eventAt)}</span>
            {post.location && <span className="inline-flex items-center gap-1"><MapPin size={13} className="text-[#1E4DFF]" />{post.location}</span>}
          </div>
        )}
        <PostImages images={post.images?.length ? post.images : post.image ? [post.image] : []} />
        {detail && <div className="mt-3 text-xs text-slate-500">{new Date(post.createdAt).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</div>}
        <div className="-ml-3 mt-2 flex items-center gap-1">
          {react('LIKE', ThumbsUp, post.likes, post.myReaction === 'LIKE', 'Like')}
          {react('DISLIKE', ThumbsDown, post.dislikes, post.myReaction === 'DISLIKE', 'Dislike')}
          <Link to={`/forum/${post.id}`} aria-label={`Comments (${post.commentCount})`} onClick={event => event.stopPropagation()} className="flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-slate-500 hover:bg-slate-100"><MessageCircle size={17} />{post.commentCount}</Link>
          <button type="button" disabled={removed} aria-label="Share post" onClick={stop(sharePost)} className="flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-slate-500 hover:bg-slate-100"><Share2 size={17} /><span className="hidden sm:inline">Share</span></button>
          {removed && canModerate(user) && <button type="button" onClick={stop(() => run(() => restorePost(user, post.id)))} className="ml-auto rounded-full px-3 text-xs text-slate-600 hover:bg-slate-100">Restore</button>}
        </div>
        <p role="status" className="text-xs text-slate-600">{shareMessage}</p>
        {shareLink && <input readOnly aria-label="Post share link" value={shareLink} onClick={event => { event.stopPropagation(); event.target.select() }} className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm" />}
        <InlineMessage tone="negative">{error}</InlineMessage>
      </div>
    </article>
  )
}

// -------------------------------------------------------------------- feed
const FEED_TABS = [
  { id: 'foryou', label: 'For you' },
  { id: 'feed', label: 'Feed' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'events', label: 'Events' },
]
const EMPTY = {
  foryou: 'Nothing here yet. Posts from you, your department and threads you replied in appear here.',
  feed: 'No posts yet.', announcements: 'No announcements yet.', events: 'No events yet.',
}

export function ForumFeed({ profile = false }) {
  const { user } = useAuth()
  const version = useForumVersion()
  const [params, setParams] = useSearchParams()
  const tab = FEED_TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'foryou'
  const [filter, setFilter] = useState('')
  const [sheet, setSheet] = useState(false)
  const sheetRef = useRef(null)
  useEffect(() => {
    if (!sheet) return undefined
    const previous = document.activeElement
    sheetRef.current?.querySelector('textarea')?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') setSheet(false)
      if (event.key !== 'Tab') return
      const controls = [...sheetRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type="file"]), textarea, select')]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); previous?.focus() }
  }, [sheet])
  const feed = useMemo(() => getFeed(user), [user, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const byTab = {
    foryou: feed.filter((p) => p.type === 'POST' && (profile ? p.authorId === user.id : p.involvesMe)),
    feed: feed.filter((p) => p.type === 'POST'),
    announcements: feed.filter((p) => p.type === 'ANNOUNCEMENT'),
    events: feed.filter((p) => p.type === 'EVENT').sort((a, b) => a.eventAt - b.eventAt),
  }
  const showFilter = tab === 'foryou' || tab === 'feed'
  const shown = showFilter && filter ? byTab[tab].filter((p) => p.category === filter) : byTab[tab]
  return (
    <>
      <header className={`forum-brand-header z-10 border-b border-[#1638CC] text-white ${profile ? '' : 'sticky top-0'}`}>
        {profile ? <ForumProfileHeader /> : <div className="flex flex-wrap items-start gap-3 px-4 pt-4">
          <div className="min-w-0 flex-1 basis-full sm:basis-0">
            <h2 className="text-xl font-bold leading-tight text-white">VPMS Forum</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/90">
              <span>Staff Voice</span><span aria-hidden="true" className="text-white/60">•</span>
              <span>Workplace Discussion</span><span aria-hidden="true" className="text-white/60">•</span>
              <span>Safety &amp; Integrity</span>
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {showFilter && (
              <label className="relative flex h-10 items-center gap-1.5 rounded-full border border-white/40 bg-[#1638CC] pl-3 pr-2 text-sm text-white">
                <Filter size={14} className="text-white/90" aria-hidden="true" />
                <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by category" className="max-w-[9.5rem] cursor-pointer appearance-none truncate bg-transparent pr-1 text-sm focus:outline-none">
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            )}
            {canModerate(user) && (
              <Link to="/forum/moderation" aria-label="Moderation" title="Moderation" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white hover:bg-white/15"><ShieldAlert size={17} /></Link>
            )}
          </div>
        </div>}
        <nav className="mt-2 flex" aria-label="Forum sections">
          {FEED_TABS.map((t) => {
            const active = tab === t.id
            return (
              <button key={t.id} type="button" onClick={() => setParams(t.id === 'foryou' ? {} : { tab: t.id })} aria-current={active ? 'page' : undefined}
                className={`flex flex-1 justify-center px-1 py-3.5 text-[13px] hover:bg-white/15 sm:text-[15px] ${active ? 'font-bold text-white' : 'font-medium text-white/85'}`}>
                <span className="relative whitespace-nowrap">
                  {t.label}
                  {active && <span className="absolute -bottom-3.5 left-0 right-0 h-1 rounded-full bg-white" />}
                </span>
              </button>
            )
          })}
        </nav>
      </header>
      <div className="hidden md:block"><Composer /></div>
      {shown.length ? shown.map((p) => <PostRow key={p.id} post={p} />) : <p className="px-6 py-12 text-center text-sm text-slate-500">{profile && tab === 'foryou' ? 'Your posts will appear here. Share your first update below.' : EMPTY[tab]}</p>}
      <div className="h-28 md:hidden" aria-hidden="true" />
      <button type="button" onClick={() => setSheet(true)} aria-label="Create post" className="forum-press fixed bottom-24 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#1E4DFF] text-white shadow-[0_10px_24px_-8px_rgba(30,77,255,0.65)] md:bottom-6"><Pencil size={23} /></button>
      {sheet && (
        <div ref={sheetRef} className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="New post">
          <button type="button" aria-label="Close" onClick={() => setSheet(false)} className="forum-fade absolute inset-0 bg-slate-900/40" />
          <div className="forum-sheet absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-12px_rgba(16,24,40,0.3)]">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            </div>
            <div className="flex items-center justify-between px-4 pb-1 pt-2">
              <h3 className="text-base font-bold text-slate-900">New post</h3>
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><X size={19} /></button>
            </div>
            <Composer onPosted={() => setSheet(false)} />
          </div>
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------------ thread
function Reply({ c }) {
  const { user } = useAuth()
  const [error, run] = useAction()
  useUserProfiles()
  const who = presentAuthor(c, user)
  return (
    <article className="flex gap-3 border-b border-slate-200 p-4">
      <Avatar item={c} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-bold text-slate-900">{who.label}</span>
          <span className="text-xs text-slate-500">· {timeAgo(c.createdAt)}</span>
          {c.status !== 'VISIBLE' && <StatusBadge tone="negative" label="removed" />}
          <span className="ml-auto flex items-center">
            {c.status === 'VISIBLE' && c.authorId !== user.id && <ReportMenu kind="COMMENT" id={c.id} />}
            {c.status === 'VISIBLE' && (c.authorId === user.id || canModerate(user)) && (
              <button type="button" aria-label="Remove comment" onClick={() => run(() => removeComment(user, c.id))} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900"><Trash2 size={15} /></button>
            )}
          </span>
        </div>
        {who.trueAuthor && <div className="text-xs text-[#1E4DFF]">Moderator view — author: {who.trueAuthor}</div>}
        <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-slate-900">{c.text}</p>
        <InlineMessage tone="negative">{error}</InlineMessage>
      </div>
    </article>
  )
}

function ReplyBox({ postId }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [showName, setShowName] = useState(true)
  const [error, run] = useAction()
  const me = { authorId: user.id, staffNo: 'EMP-0', showName, displayName: user.name }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (run(() => addComment(user, postId, { text, showName }))) setText('') }} className="flex gap-3 border-b border-slate-200 p-4">
      <Avatar item={me} size={36} />
      <div className="min-w-0 flex-1">
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_COMMENT} rows={2} aria-label="Write a reply" placeholder="Post your reply" className="w-full resize-none border-0 bg-transparent p-0 pt-1.5 text-base placeholder-slate-400 focus:outline-none focus:ring-0" />
        <div className="mt-2 flex items-center gap-3">
          <label className="inline-flex min-h-9 items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-4 w-4" />Show my name</label>
          <button type="submit" disabled={!text.trim()} className="forum-press ml-auto h-11 rounded-full bg-[#1E4DFF] px-7 text-sm font-bold text-white disabled:opacity-40">Reply</button>
        </div>
        <InlineMessage tone="negative">{error}</InlineMessage>
      </div>
    </form>
  )
}

export function ForumThread() {
  const { user } = useAuth()
  const { postId } = useParams()
  const version = useForumVersion()
  const post = useMemo(() => getFeed(user).find((p) => p.id === postId), [user, postId, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const comments = useMemo(() => (post ? getComments(user, postId) : []), [user, postId, post, version]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <Link to="/forum" aria-label="Back to forum" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"><ArrowLeft size={19} /></Link>
        <h2 className="text-lg font-bold text-slate-900">Thread</h2>
      </header>
      {!post ? <p className="py-12 text-center text-sm text-slate-500">This post is not available.</p> : (
        <>
          <PostRow post={post} detail />
          {post.status === 'VISIBLE' && <ReplyBox postId={post.id} />}
          {comments.length ? comments.map((c) => <Reply key={c.id} c={c} />) : <p className="py-10 text-center text-sm text-slate-500">No replies yet. Start the conversation.</p>}
        </>
      )}
    </>
  )
}

// -------------------------------------------------------------- moderation
export function ForumModeration() {
  const { user } = useAuth()
  const version = useForumVersion()
  const moderator = canModerate(user)
  const queue = useMemo(() => (moderator ? getModerationQueue(user) : []), [user, moderator, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const [error, run] = useAction()
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <Link to="/forum" aria-label="Back to forum" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"><ArrowLeft size={19} /></Link>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldAlert size={18} />Moderation</h2>
      </header>
      {!moderator ? <p className="py-12 text-center text-sm text-slate-500">Moderators only.</p> : (
        <>
          <div className="px-4 pt-3"><InlineMessage tone="negative">{error}</InlineMessage></div>
          {queue.length === 0 && <p className="py-12 text-center text-sm text-slate-500">No reports.</p>}
          {queue.map((r) => (
            <div key={r.id} className="border-b border-slate-200 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <StatusBadge tone={r.status === 'OPEN' ? 'warning' : 'neutral'} label={r.status.toLowerCase()} />
                <span>{r.kind.toLowerCase()} reported for <b className="text-slate-700">{r.reason}</b></span><span>{timeAgo(r.createdAt)}</span>
              </div>
              {r.target && <>
                <p className="mt-2 whitespace-pre-wrap break-words text-slate-900">{r.target.text}</p>
                <p className="mt-1 text-xs text-[#1E4DFF]">Author: {r.target.displayName} ({r.target.authorId}) · {r.target.staffNo}</p>
              </>}
              {r.status === 'OPEN' && (
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => run(() => resolveReport(user, r.id, 'REMOVE'))} className="h-10 rounded-full bg-[#1E4DFF] px-5 text-sm font-semibold text-white">Remove content</button>
                  <button type="button" onClick={() => run(() => resolveReport(user, r.id, 'DISMISS'))} className="h-10 rounded-full border border-slate-200 px-5 text-sm">Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </>
  )
}
