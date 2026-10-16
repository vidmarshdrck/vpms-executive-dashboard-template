import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { AttachmentList } from './Attachments.jsx'
import ExcelBookImport from './ExcelBookImport.jsx'
import { Card, CardHeader, CardTitle, CardContent } from './Card.jsx'
import { InlineMessage } from './InlineMessage.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { BOOK_FIELDS, BOOK_NAMES, PRODUCTS, saveBookEntry, reviewBookEntry } from '../../lib/entryBooks.js'
import { useEntryBooks } from '../../lib/useEntryBooks.js'

const control = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100'
const primary = 'min-h-11 rounded-lg bg-[#1E4DFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1638CC] disabled:opacity-50'
const secondary = 'min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
const tone = { DRAFT: 'neutral', SUBMITTED: 'warning', RETURNED: 'negative', APPROVED: 'positive' }
const statusLabel = { DRAFT: 'Draft', SUBMITTED: 'Awaiting review', RETURNED: 'Returned', APPROVED: 'Approved' }
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
function weekEnd(start) {
  if (!start) return ''
  const date = new Date(`${start}T12:00:00`)
  date.setDate(Math.min(date.getDate() + 6, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()))
  return localDate(date)
}
function freshForm() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(Math.max(1, today.getDate() - (today.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(Math.min(start.getDate() + 6, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()))
  return { frequency: 'weekly', start: localDate(start), end: localDate(end), product: '', values: {}, notes: '', attachments: [] }
}
function dateLabel(entry) { return entry.start === entry.end ? entry.start : `${entry.start} – ${entry.end}` }
function Figures({ entry }) {
  return <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{BOOK_FIELDS[entry.departmentId].map((field) => <div key={field.key}><dt className="text-xs text-slate-500">{field.label}</dt><dd className="font-semibold tabular-nums text-slate-900">{Number(entry.values[field.key]).toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd></div>)}</dl>
}

export function DepartmentEntryBook() {
  const { user } = useAuth()
  const store = useEntryBooks()
  const [form, setForm] = useState(freshForm)
  const [message, setMessage] = useState(null)
  const [uploading, setUploading] = useState(false)
  if (user.role !== 'Dept Head' || !BOOK_FIELDS[user.departmentId]) return null
  const entries = store.entries.filter((entry) => entry.departmentId === user.departmentId).sort((a, b) => b.start.localeCompare(a.start))
  const patch = (values) => setForm((previous) => ({ ...previous, ...values }))
  const published = form.id && store.published[form.id]
  function save(submit) {
    try {
      saveBookEntry(user, form, submit)
      setMessage({ tone: 'positive', text: submit ? 'Submitted for review. The executive overview updates after approval.' : 'Entry saved as a draft.' })
      setForm(freshForm())
    } catch (error) { setMessage({ tone: 'negative', text: error.message }) }
  }
  return <section id="department-entry-book" className="space-y-4 scroll-mt-4" aria-label={BOOK_NAMES[user.departmentId]}>
    <Card>
      <CardHeader>
        <CardTitle>{BOOK_NAMES[user.departmentId]}</CardTitle>
        <p className="mt-1 text-sm text-slate-500">Record weekly totals or daily figures. Approved entries feed the executive overview by month and quarter.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <InlineMessage tone="negative">{store.error}</InlineMessage>
        {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
        {form.id && <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-800">{published ? 'Correct approved figures' : 'Edit entry'}</span><button type="button" onClick={() => { setForm(freshForm()); setMessage(null) }} className="inline-flex min-h-10 items-center gap-1 text-slate-600"><X size={15} />Cancel edit</button></div>}
        {published && <InlineMessage tone="neutral">The last approved figures stay published while the GM reviews your correction.</InlineMessage>}
        <form onSubmit={(event) => { event.preventDefault(); save(true) }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Frequency<select aria-label="Book frequency" value={form.frequency} disabled={Boolean(published)} onChange={(event) => patch({ frequency: event.target.value, end: event.target.value === 'daily' ? form.start : weekEnd(form.start) })} className={control}><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>
            <label className="text-sm font-medium text-slate-700">{form.frequency === 'daily' ? 'Date' : 'Period starts'}<input aria-label="Book start date" type="date" required value={form.start} disabled={Boolean(published)} onChange={(event) => patch({ start: event.target.value, end: form.frequency === 'daily' ? event.target.value : weekEnd(event.target.value) })} className={control} /></label>
            {form.frequency === 'weekly' && <label className="text-sm font-medium text-slate-700">Period ends<input aria-label="Book end date" type="date" required min={form.start} value={form.end} disabled={Boolean(published)} onChange={(event) => patch({ end: event.target.value })} className={control} /></label>}
          </div>
          <p className="text-xs text-slate-500">Weekly entries cover up to seven days. Split a week at month end so monthly totals remain accurate. Do not enter the same dates again as daily figures.</p>
          {user.departmentId === 'operations' && <label className="block max-w-sm text-sm font-medium text-slate-700">Product<select aria-label="Book product" required value={form.product} disabled={Boolean(published)} onChange={(event) => patch({ product: event.target.value })} className={control}><option value="">Choose product</option>{PRODUCTS.map((product) => <option key={product}>{product}</option>)}</select></label>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{BOOK_FIELDS[user.departmentId].map((field) => <label key={field.key} className="text-sm font-medium text-slate-700">{field.label}<input aria-label={field.label} type="number" min="0" step="0.01" required value={form.values[field.key] ?? ''} onChange={(event) => patch({ values: { ...form.values, [field.key]: event.target.value } })} placeholder="0.00" className={`${control} tabular-nums`} /></label>)}</div>
          <label className="block text-sm font-medium text-slate-700">Notes <span className="font-normal text-slate-500">(optional)</span><textarea value={form.notes} onChange={(event) => patch({ notes: event.target.value })} rows={2} maxLength={1000} className={control} placeholder="Source reference or explanation of the figures" /></label>
          <ExcelBookImport user={user} attachments={form.attachments || []} onAttachments={attachments => patch({ attachments })} onBusy={setUploading} />
          <div className="flex flex-wrap gap-3"><button type="button" disabled={Boolean(store.error) || uploading} onClick={() => save(false)} className={secondary}>Save book draft</button><button type="submit" disabled={Boolean(store.error) || uploading} className={primary}>Submit book for review</button></div>
        </form>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Book entries · {entries.length}</CardTitle></CardHeader><CardContent>
      {!entries.length && <p className="text-sm text-slate-500">No entries yet. Start with the period you want to report.</p>}
      <ul className="divide-y divide-slate-200">{entries.map((entry) => <li key={entry.id} className="space-y-3 py-4 first:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-sm font-semibold text-slate-800">{dateLabel(entry)} {entry.product && `· ${entry.product}`}</span><p className="text-xs text-slate-500">{entry.frequency === 'weekly' ? 'Weekly' : 'Daily'} · entered by {entry.createdBy.name}</p></div><div className="flex items-center gap-2"><StatusBadge tone={tone[entry.status]} label={statusLabel[entry.status]} />{entry.status !== 'SUBMITTED' && <button type="button" aria-label={`Edit book entry ${entry.start}${entry.product ? ` ${entry.product}` : ''}`} title="Edit entry" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => { setForm({ ...entry }); setMessage(null) }}><Pencil size={16} /></button>}</div></div>
        <Figures entry={entry} />
        <AttachmentList files={entry.attachments || []} />
        {entry.reviewComment && <p className="text-sm text-slate-600">Comment: {entry.reviewComment}</p>}
        {entry.notes && <p className="text-xs text-slate-500">{entry.notes}</p>}
        <details className="text-xs text-slate-500"><summary className="cursor-pointer">Entry history</summary><ul className="mt-2 space-y-1">{entry.history.map((event, index) => <li key={index}>{event.action} · {event.by.name} · {new Date(event.at).toLocaleString()}{event.comment && ` · ${event.comment}`}</li>)}</ul></details>
      </li>)}</ul>
    </CardContent></Card>
  </section>
}

export function EntryBookApprovals() {
  const { user } = useAuth()
  const store = useEntryBooks()
  const [message, setMessage] = useState(null)
  const [comments, setComments] = useState({})
  const pending = store.entries.filter((entry) => entry.status === 'SUBMITTED')
  const recent = store.entries.filter((entry) => ['APPROVED', 'RETURNED'].includes(entry.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8)
  function review(entry, approve) {
    try { reviewBookEntry(user, entry.id, approve, comments[entry.id] || ''); setMessage({ tone: 'positive', text: approve ? 'Book entry approved and published to the executive overview.' : 'Book entry returned to the department.' }) }
    catch (error) { setMessage({ tone: 'negative', text: error.message }) }
  }
  return <Card><CardHeader><CardTitle>Finance &amp; Operations entry books</CardTitle><p className="mt-1 text-sm text-slate-500">{pending.length} entr{pending.length === 1 ? 'y' : 'ies'} awaiting review. Only approved figures appear in the executive overview.</p></CardHeader><CardContent className="space-y-4">
    <InlineMessage tone="negative">{store.error}</InlineMessage>
    {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
    {!pending.length && <p className="text-sm text-slate-500">No book entries awaiting review.</p>}
    {pending.map((entry) => <section key={entry.id} className="space-y-3 border-b border-slate-200 pb-5 last:border-0">
      <div><h4 className="text-sm font-semibold text-slate-900">{BOOK_NAMES[entry.departmentId]} · {dateLabel(entry)} {entry.product && `· ${entry.product}`}</h4><p className="text-xs text-slate-500">Submitted by {entry.createdBy.name}{store.published[entry.id] ? ' · correction to approved figures' : ''}</p></div>
      <Figures entry={entry} />
      <AttachmentList files={entry.attachments || []} />
      {entry.notes && <p className="text-sm text-slate-600">{entry.notes}</p>}
      <label className="block text-sm font-medium text-slate-700">Book review comment<textarea aria-label={`Book review comment ${entry.start}`} rows={2} value={comments[entry.id] || ''} onChange={(event) => setComments({ ...comments, [entry.id]: event.target.value })} className={control} placeholder="Required when returning an entry" /></label>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => review(entry, true)} className={primary}>Approve book entry</button><button type="button" onClick={() => review(entry, false)} className={secondary}>Return book entry</button></div>
    </section>)}
    {recent.length > 0 && <details className="text-sm text-slate-600"><summary className="cursor-pointer font-medium">Recent book decisions</summary><ul className="mt-3 space-y-2">{recent.map((entry) => <li key={entry.id}>{BOOK_NAMES[entry.departmentId]} · {dateLabel(entry)} {entry.product} · <StatusBadge label={statusLabel[entry.status]} tone={tone[entry.status]} /></li>)}</ul></details>}
  </CardContent></Card>
}
