import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { AttachmentList } from '../../components/ui/Attachments.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
import TaskCreateDialog from '../../components/ui/TaskCreateDialog.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { departments } from '../../data/scorecardData.js'
import { TASK_STATUSES, subscribeToTasks, listTasks, listDepartmentProjects, addTask, updateTask, setTaskStatus } from '../../lib/departmentTasks.js'

const PRIORITY_TONE = { Low: 'neutral', Medium: 'caution', High: 'warning', Critical: 'negative' }
const STATUS_TONE = { 'To do': 'neutral', 'In progress': 'caution', Blocked: 'negative', Done: 'positive' }

// Support for HOD/staff: the tasks of their own department only.
export default function DepartmentSupport() {
  const { user } = useAuth()
  const department = departments.find((d) => d.id === user.departmentId)
  const [version, setVersion] = useState(0)
  useEffect(() => subscribeToTasks(() => setVersion((v) => v + 1)), [])
  const tasks = useMemo(() => listTasks(user), [user, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const projects = useMemo(() => listDepartmentProjects(user), [user, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const triggerRef = useRef(null)
  const editTriggerRef = useRef(null)
  const closeDialog = useCallback(() => setAdding(false), [])
  const closeEditDialog = useCallback(() => setEditingTask(null), [])
  const [error, setError] = useState('')
  const act = (fn) => { try { fn(); setError(''); return true } catch (e) { setError(e.message); return false } }
  const counts = TASK_STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Activities · {department?.name}</h2>
          <p className="text-sm text-slate-500">Company-related tasks and work your department is doing.</p>
        </div>
        <button ref={triggerRef} type="button" onClick={() => setAdding(true)} aria-haspopup="dialog" aria-expanded={adding} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1E4DFF] px-4 text-sm font-semibold text-white"><Plus size={16} />New task</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map(([s, n]) => <Card key={s}><CardContent className="pt-4"><div className="text-2xl font-black tabular-nums text-slate-900">{n}</div><div className="text-xs text-slate-500">{s}</div></CardContent></Card>)}
      </div>

      {adding && <TaskCreateDialog onClose={closeDialog} onCreate={(form) => addTask(user, form)} projects={projects} triggerRef={triggerRef} />}
      {editingTask && <TaskCreateDialog initialTask={editingTask} onClose={closeEditDialog} onCreate={(form) => updateTask(user, editingTask.id, form)} projects={projects} triggerRef={editTriggerRef} />}
      {!adding && <InlineMessage tone="negative">{error}</InlineMessage>}

      <div className="space-y-3">
        {tasks.map((t) => (
          <Card key={t.id}><CardContent className="pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{t.title}</div>
                {t.description && <p className="mt-0.5 text-sm text-slate-500">{t.description}</p>}
                <div className="mt-2"><AttachmentList files={t.attachments} /></div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <StatusBadge tone={PRIORITY_TONE[t.priority]} label={t.priority} />
                  {t.affectedDepartment && t.category && <span>{t.affectedDepartment} · {t.category}</span>}
                  {t.projectId && <span>Project: {projects.find((project) => project.id === t.projectId)?.title ?? 'Unavailable'}</span>}
                  {t.createdAt && <span>Created {new Date(t.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                  <span>Due {new Date(t.due).toLocaleDateString([], { dateStyle: 'medium' })}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <button type="button" aria-label={`Edit ${t.title}`} title="Edit task" onClick={(event) => { editTriggerRef.current = event.currentTarget; setEditingTask(t) }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"><Pencil size={16} /></button>
                <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
                  <select value={t.status} onChange={(e) => act(() => setTaskStatus(user, t.id, e.target.value))} aria-label={`Status for ${t.title}`} className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
                    {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <StatusBadge tone={STATUS_TONE[t.status]} label={t.status} />
                </div>
              </div>
            </div>
          </CardContent></Card>
        ))}
        {tasks.length === 0 && <Card><CardContent className="py-8 text-center text-sm text-slate-500">No tasks yet for this department.</CardContent></Card>}
      </div>
      <p className="text-center text-xs text-slate-400">Development preview: tasks are stored in this browser only.</p>
    </div>
  )
}
