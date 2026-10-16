import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AttachmentPicker } from './Attachments.jsx'
import { InlineMessage } from './InlineMessage.jsx'
import { ISSUE_CATEGORIES, TICKET_DEPARTMENTS, PRIORITY_EXPLANATIONS, priorityFor } from '../../lib/ticketPriority.js'

const PRIORITY_STYLE = {
  Critical: 'border-red-200 bg-red-50 text-red-800',
  High: 'border-orange-200 bg-orange-50 text-orange-800',
  Medium: 'border-amber-200 bg-amber-50 text-amber-800',
  Low: 'border-green-200 bg-green-50 text-green-800',
}
const FIELD_STYLE = 'mt-1 w-full min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-[#1E4DFF] focus-visible:ring-2 focus-visible:ring-[#1E4DFF]/15'
const EMPTY_FORM = { title: '', description: '', affectedDepartment: '', category: '', due: '', departmentId: '', projectId: '' }

function dateForInput(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function TaskCreateDialog({ onClose, onCreate, initialTask, initialValues, departments = [], projects = [], triggerRef }) {
  const preset = initialTask ?? initialValues
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState(() => preset ? {
    title: preset.title ?? '', description: preset.description ?? '', affectedDepartment: preset.affectedDepartment ?? '',
    category: preset.category ?? '', due: dateForInput(preset.due), departmentId: preset.departmentId ?? '', projectId: preset.projectId ?? '',
    attachments: preset.attachments ?? [],
  } : { ...EMPTY_FORM, attachments: [] })
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const priority = priorityFor(form.affectedDepartment, form.category)
  const availableProjects = departments.length ? projects.filter((project) => project.departmentId === form.departmentId) : projects
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value, ...(field === 'departmentId' ? { projectId: '' } : {}) }))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const trigger = triggerRef?.current
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector('input[name="task-title"]')?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') ?? [])]
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [onClose, triggerRef])

  const submit = (event) => {
    event.preventDefault()
    try {
      onCreate(form)
      onClose()
    } catch (cause) {
      setError(cause.message)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/70 p-2 backdrop-blur-[2px] sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-task-title" className="max-h-[96dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 border-t-4 border-t-[#1E4DFF] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.17)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <h3 id="new-task-title" className="text-lg font-semibold text-slate-900">{initialTask ? 'Edit task' : 'New task'}</h3>
          <button type="button" onClick={onClose} aria-label="Close new task window" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#1E4DFF]"><X size={18} /></button>
        </div>
        <form className="space-y-3 px-4 py-3 sm:px-5" onSubmit={submit}>
          <label className="block text-xs font-semibold text-slate-700">Task title<input name="task-title" required value={form.title} onChange={update('title')} maxLength={160} className={FIELD_STYLE} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Task type<select required value={form.category} onChange={update('category')} className={FIELD_STYLE}><option value="">Select type</option>{ISSUE_CATEGORIES.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-700">Affected department<select required value={form.affectedDepartment} onChange={update('affectedDepartment')} className={FIELD_STYLE}><option value="">Select department</option>{TICKET_DEPARTMENTS.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            {departments.length > 0 && <label className="block text-xs font-semibold text-slate-700">Assign task to<select required disabled={Boolean(initialTask)} value={form.departmentId} onChange={update('departmentId')} className={FIELD_STYLE}><option value="">Select PMS department</option>{departments.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>}
            <label className="block text-xs font-semibold text-slate-700">Due date<input type="date" value={form.due} onChange={update('due')} className={FIELD_STYLE} /></label>
          </div>
          {availableProjects.length > 0 && <label className="block text-xs font-semibold text-slate-700">Project (optional)<select value={form.projectId} onChange={update('projectId')} className={FIELD_STYLE}><option value="">Standalone task</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>}
          <div aria-live="polite" className={`rounded-lg border px-3 py-2 ${priority ? PRIORITY_STYLE[priority] : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-[11px] font-semibold uppercase tracking-wide">Priority · system assigned</span><strong className="text-sm">{priority?.toUpperCase() ?? 'Pending selection'}</strong></div>
            <p className="mt-0.5 text-xs leading-snug">{priority ? PRIORITY_EXPLANATIONS[priority] : 'Select a task type and affected department to determine priority.'}</p>
          </div>
          <label className="block text-xs font-semibold text-slate-700">Details (optional)<textarea value={form.description} onChange={update('description')} rows={2} maxLength={600} className={`${FIELD_STYLE} min-h-[3.7rem] py-2`} /></label>
          <AttachmentPicker files={form.attachments} onChange={attachments => setForm(current => ({ ...current, attachments }))} onBusy={setUploading} />
          {error && <InlineMessage tone="negative">{error}</InlineMessage>}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <span className="text-[11px] text-slate-500">{initialTask ? 'Original creation time is preserved.' : 'Created date and time are recorded automatically.'}</span>
            <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" disabled={!priority || uploading} className="min-h-9 rounded-lg bg-[#1E4DFF] px-4 text-sm font-semibold text-white hover:bg-[#9A1D14] disabled:cursor-not-allowed disabled:opacity-50">{initialTask ? 'Save changes' : 'Create task'}</button></div>
          </div>
        </form>
      </div>
    </div>
  )
}
