import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { Card, CardContent } from '../../components/ui/Card.jsx'
import { AttachmentList } from '../../components/ui/Attachments.jsx'
import { InlineMessage } from '../../components/ui/InlineMessage.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import TaskCreateDialog from '../../components/ui/TaskCreateDialog.jsx'
import { departments } from '../../data/scorecardData.js'
import { TASK_STATUSES, addCompanyTask, updateCompanyTask, listCompanyTasks, listCompanyProjects, subscribeToTasks } from '../../lib/departmentTasks.js'

const PRIORITY_TONE = { Low: 'neutral', Medium: 'caution', High: 'warning', Critical: 'negative' }
const STATUS_TONE = { 'To do': 'neutral', 'In progress': 'caution', Blocked: 'negative', Done: 'positive' }

export default function CompanyActivities() {
  const { user } = useAuth()
  const [, setVersion] = useState(0)
  const [adding, setAdding] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const triggerRef = useRef(null)
  const editTriggerRef = useRef(null)
  const closeDialog = useCallback(() => setAdding(false), [])
  const closeEditDialog = useCallback(() => setEditingTask(null), [])
  useEffect(() => subscribeToTasks(() => setVersion((value) => value + 1)), [])
  const tasks = user.role === 'GM' ? listCompanyTasks(user, departments) : []
  const projects = user.role === 'GM' ? listCompanyProjects(user, departments) : []
  const counts = TASK_STATUSES.map((status) => [status, tasks.filter((task) => task.status === status).length])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-slate-900">Activities</h2><p className="text-sm text-slate-500">Company-related tasks routed to departments.</p></div>
        {user.role === 'GM' && <button ref={triggerRef} type="button" onClick={() => setAdding(true)} aria-haspopup="dialog" aria-expanded={adding} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1E4DFF] px-4 text-sm font-semibold text-white"><Plus size={16} />New task</button>}
      </div>
      {user.role !== 'GM' ? <InlineMessage tone="neutral">The company-wide task view is currently available to the GM.</InlineMessage> : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{counts.map(([status, count]) => <Card key={status}><CardContent className="pt-4"><div className="text-2xl font-black tabular-nums text-slate-900">{count}</div><div className="text-xs text-slate-500">{status}</div></CardContent></Card>)}</div>
        {adding && <TaskCreateDialog onClose={closeDialog} onCreate={(form) => addCompanyTask(user, form.departmentId, form, departments)} departments={departments} projects={projects} triggerRef={triggerRef} />}
        {editingTask && <TaskCreateDialog initialTask={editingTask} onClose={closeEditDialog} onCreate={(form) => updateCompanyTask(user, editingTask.departmentId, editingTask.id, form, departments)} departments={departments} projects={projects} triggerRef={editTriggerRef} />}
        <div className="space-y-3">{tasks.map((task) => <Card key={task.id}><CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium text-slate-900">{task.title}</div><div className="flex items-center gap-2"><StatusBadge tone={STATUS_TONE[task.status]} label={task.status} /><button type="button" aria-label={`Edit ${task.title}`} title="Edit task" onClick={(event) => { editTriggerRef.current = event.currentTarget; setEditingTask(task) }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"><Pencil size={16} /></button></div></div>
          {task.description && <p className="mt-1 text-sm text-slate-500">{task.description}</p>}
          <div className="mt-2"><AttachmentList files={task.attachments} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-semibold text-slate-700">Assigned to {task.departmentName}</span><StatusBadge tone={PRIORITY_TONE[task.priority]} label={task.priority} />{task.affectedDepartment && task.category && <span>{task.affectedDepartment} · {task.category}</span>}{task.projectId && <span>Project: {projects.find((project) => project.id === task.projectId)?.title ?? 'Unavailable'}</span>}{task.createdAt && <span>Created {new Date(task.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>}<span>Due {new Date(task.due).toLocaleDateString([], { dateStyle: 'medium' })}</span></div>
        </CardContent></Card>)}{tasks.length === 0 && <Card><CardContent className="py-8 text-center text-sm text-slate-500">No company tasks yet.</CardContent></Card>}</div>
        <p className="text-center text-xs text-slate-400">Development preview: tasks are stored in this browser only.</p>
      </>}
    </div>
  )
}
