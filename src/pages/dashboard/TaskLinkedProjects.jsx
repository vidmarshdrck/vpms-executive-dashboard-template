import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { Card, CardContent } from '../../components/ui/Card.jsx'
import { AttachmentList, AttachmentPicker } from '../../components/ui/Attachments.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
import { departments } from '../../data/scorecardData.js'
import { addCompanyProject, addDepartmentProject, updateCompanyProject, updateDepartmentProject, listCompanyProjects, listDepartmentProjects, subscribeToTasks } from '../../lib/departmentTasks.js'

const FIELD_STYLE = 'mt-1 w-full min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-[#1E4DFF] focus-visible:ring-2 focus-visible:ring-[#1E4DFF]/15'

function dateForInput(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function NewProjectDialog({ user, initialProject, onClose, triggerRef }) {
  const [form, setForm] = useState(() => initialProject ? {
    title: initialProject.title ?? '', description: initialProject.description ?? '', due: dateForInput(initialProject.due), departmentId: initialProject.departmentId ?? '', attachments: initialProject.attachments ?? [],
  } : { title: '', description: '', due: '', departmentId: '', attachments: [] })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const trigger = triggerRef.current
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector('input[name="project-title"]')?.focus()
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
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [onClose, triggerRef])

  const submit = (event) => {
    event.preventDefault()
    try {
      if (initialProject) {
        if (user.role === 'GM') updateCompanyProject(user, initialProject.departmentId, initialProject.id, form, departments)
        else updateDepartmentProject(user, initialProject.id, form)
      } else if (user.role === 'GM') addCompanyProject(user, form.departmentId, form, departments)
      else addDepartmentProject(user, form)
      onClose()
    } catch (cause) { setError(cause.message) }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/70 p-2 backdrop-blur-[2px] sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-project-title" className="max-h-[96dvh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 border-t-4 border-t-[#1E4DFF] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.17)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 id="new-project-title" className="text-lg font-semibold text-slate-900">{initialProject ? 'Edit project' : 'New project'}</h3><button type="button" onClick={onClose} aria-label="Close project window" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
      <form className="space-y-3 px-5 py-4" onSubmit={submit}>
        <label className="block text-xs font-semibold text-slate-700">Project name<input name="project-title" required maxLength={160} value={form.title} onChange={update('title')} className={FIELD_STYLE} /></label>
        {user.role === 'GM' && <label className="block text-xs font-semibold text-slate-700">Assign to department<select required disabled={Boolean(initialProject)} value={form.departmentId} onChange={update('departmentId')} className={FIELD_STYLE}><option value="">Select department</option>{departments.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>}
        <label className="block text-xs font-semibold text-slate-700">Due date (optional)<input type="date" value={form.due} onChange={update('due')} className={FIELD_STYLE} /></label>
        <label className="block text-xs font-semibold text-slate-700">Description (optional)<textarea rows={2} maxLength={600} value={form.description} onChange={update('description')} className={`${FIELD_STYLE} py-2`} /></label>
        <p className="text-xs text-slate-500">Progress is calculated from linked tasks marked Done. {initialProject ? 'Original creation time and assigned department are preserved.' : 'New projects start at 0%.'}</p>
        <AttachmentPicker files={form.attachments} onChange={attachments => setForm(current => ({ ...current, attachments }))} onBusy={setUploading} />
        {error && <InlineMessage tone="negative">{error}</InlineMessage>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" disabled={uploading} className="min-h-9 rounded-lg bg-[#1E4DFF] px-4 text-sm font-semibold text-white hover:bg-[#9A1D14]">{initialProject ? 'Save changes' : 'Create project'}</button></div>
      </form>
    </div>
  </div>
}

export default function TaskLinkedProjects({ embedded = false }) {
  const { user } = useAuth()
  const [, setVersion] = useState(0)
  const [adding, setAdding] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const triggerRef = useRef(null)
  const editTriggerRef = useRef(null)
  const closeDialog = useCallback(() => setAdding(false), [])
  const closeEditDialog = useCallback(() => setEditingProject(null), [])
  useEffect(() => subscribeToTasks(() => setVersion((value) => value + 1)), [])
  const isDepartmentView = Boolean(user.departmentId && (user.role === 'Dept Head' || user.role === 'Staff'))
  const projects = isDepartmentView ? listDepartmentProjects(user) : listCompanyProjects(user, departments)
  const canCreate = user.role === 'GM' || user.role === 'Dept Head'

  return <section className="space-y-4" aria-label="Task-linked projects">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-semibold text-slate-900">{embedded ? 'Task-linked projects' : 'Projects'}</h2><p className="text-sm text-slate-500">Progress follows completed tasks linked to each project.</p></div>
      {canCreate && <button ref={triggerRef} type="button" onClick={() => setAdding(true)} aria-haspopup="dialog" aria-expanded={adding} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1E4DFF] px-4 text-sm font-semibold text-white"><Plus size={16} />New project</button>}
    </div>
    {adding && <NewProjectDialog user={user} onClose={closeDialog} triggerRef={triggerRef} />}
    {editingProject && <NewProjectDialog user={user} initialProject={editingProject} onClose={closeEditDialog} triggerRef={editTriggerRef} />}
    <div className="grid gap-3 lg:grid-cols-2">
      {projects.map((project) => <Card key={project.id}><CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{project.title}</h3>{project.departmentName && <p className="text-xs text-slate-500">{project.departmentName}</p>}</div><div className="flex items-center gap-2"><strong className="text-lg tabular-nums text-[#1E4DFF]">{project.progress}%</strong>{canCreate && <button type="button" aria-label={`Edit ${project.title}`} title="Edit project" onClick={(event) => { editTriggerRef.current = event.currentTarget; setEditingProject(project) }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"><Pencil size={16} /></button>}</div></div>
        {project.description && <p className="mt-2 text-sm text-slate-600">{project.description}</p>}
        <div className="mt-2"><AttachmentList files={project.attachments} /></div>
        <div role="progressbar" aria-label={`${project.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1E4DFF] transition-[width]" style={{ width: `${project.progress}%` }} /></div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{project.completedTasks} of {project.taskCount} linked tasks done</span>{project.due && <span>Due {new Date(project.due).toLocaleDateString([], { dateStyle: 'medium' })}</span>}</div>
      </CardContent></Card>)}
    </div>
    {projects.length === 0 && <Card><CardContent className="py-8 text-center text-sm text-slate-500">No projects have been created for {isDepartmentView ? 'this department' : 'the company'} yet.</CardContent></Card>}
    {!embedded && <p className="text-center text-xs text-slate-400">Development preview: projects and linked tasks are stored in this browser only.</p>}
  </section>
}
