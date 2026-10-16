// Browser-local Activities preview. Production needs equivalent API scoping
// and server-side priority calculation before tasks can be shared between users.

import { validateAttachments } from './attachments.js'
import { hasPermission } from '../auth/permissions.js'
import { priorityFor } from './ticketPriority.js'

const STORE_KEY = 'vpms-department-tasks'
const PROJECTS_KEY = 'vpms-department-projects'
const CHANGE_EVENT = 'vpms:tasks-changed'

export const TASK_STATUSES = ['To do', 'In progress', 'Blocked', 'Done']

const DAY = 86400000

function readStore(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(key, store) {
  try { localStorage.setItem(key, JSON.stringify(store)) } catch { throw new Error('Changes could not be saved in this browser. Check available storage and try again.') }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

const read = () => readStore(STORE_KEY)
const write = (store) => writeStore(STORE_KEY, store)
const readProjects = () => readStore(PROJECTS_KEY)
const writeProjects = (store) => writeStore(PROJECTS_KEY, store)

function scope(user) {
  if (!hasPermission(user, 'support.department') || !user.departmentId) throw new Error('No department tasks for this account.')
  return user.departmentId
}

export function subscribeToTasks(onChange) {
  const onStorage = (e) => { if (e.key === STORE_KEY || e.key === PROJECTS_KEY) onChange() }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener('storage', onStorage) }
}

export function listTasks(user) {
  const dept = scope(user)
  return (read()[dept] ?? []).slice().sort((a, b) => a.due - b.due)
}

export function listCompanyTasks(user, departments) {
  if (user?.role !== 'GM') throw new Error('Only the GM can view company activities.')
  const store = read()
  return departments.flatMap(({ id, name }) => (store[id] ?? []).map((task) => ({ ...task, departmentId: id, departmentName: name })))
    .sort((a, b) => a.due - b.due)
}

function withProgress(project, tasks) {
  const linked = tasks.filter((task) => task.projectId === project.id)
  const completedTasks = linked.filter((task) => task.status === 'Done').length
  return { ...project, taskCount: linked.length, completedTasks, progress: linked.length ? Math.round(completedTasks / linked.length * 100) : 0 }
}

export function listDepartmentProjects(user) {
  const dept = scope(user)
  const tasks = read()[dept] ?? []
  return (readProjects()[dept] ?? []).map((project) => withProgress(project, tasks))
}

export function listCompanyProjects(user, departments) {
  if (!hasPermission(user, 'dashboard.org')) throw new Error('No company projects for this account.')
  const projectStore = readProjects()
  const taskStore = read()
  return departments.flatMap(({ id, name }) => (projectStore[id] ?? []).map((project) => ({ ...withProgress(project, taskStore[id] ?? []), departmentId: id, departmentName: name })))
}

function insertProject(user, dept, { title, description, due, attachments }) {
  const name = String(title ?? '').trim()
  if (!name || name.length > 160) throw new Error('Enter a project name of up to 160 characters.')
  const dueAt = due ? new Date(`${due}T12:00:00`).getTime() : null
  if (due && !Number.isFinite(dueAt)) throw new Error('Enter a valid due date.')
  const createdAt = Date.now()
  const store = readProjects()
  const list = store[dept] ?? []
  list.push({ id: `${dept}-p${createdAt}-${Math.random().toString(36).slice(2, 8)}`, title: name, description: String(description ?? '').trim().slice(0, 600), due: dueAt, attachments: validateAttachments(attachments), createdAt, createdBy: user.id })
  store[dept] = list
  writeProjects(store)
}

export function addDepartmentProject(user, body) {
  if (user?.role !== 'Dept Head') throw new Error('Only a department head can create a department project.')
  return insertProject(user, scope(user), body)
}

export function addCompanyProject(user, departmentId, body, departments) {
  if (user?.role !== 'GM') throw new Error('Only the GM can route a company project.')
  if (!departments.some(({ id }) => id === departmentId)) throw new Error('Select a valid destination department.')
  return insertProject(user, departmentId, body)
}

function reviseProject(user, dept, projectId, { title, description, due, attachments }) {
  const store = readProjects()
  const list = store[dept] ?? []
  const index = list.findIndex((project) => project.id === projectId)
  if (index < 0) throw new Error('Project not found in this department.')
  const name = String(title ?? '').trim()
  if (!name || name.length > 160) throw new Error('Enter a project name of up to 160 characters.')
  const dueAt = due ? new Date(`${due}T12:00:00`).getTime() : null
  if (due && !Number.isFinite(dueAt)) throw new Error('Enter a valid due date.')
  list[index] = { ...list[index], title: name, description: String(description ?? '').trim().slice(0, 600), due: dueAt, attachments: validateAttachments(attachments ?? list[index].attachments), updatedAt: Date.now(), updatedBy: user.id }
  store[dept] = list
  writeProjects(store)
}

export function updateDepartmentProject(user, projectId, body) {
  if (user?.role !== 'Dept Head') throw new Error('Only a department head can edit a department project.')
  return reviseProject(user, scope(user), projectId, body)
}

export function updateCompanyProject(user, departmentId, projectId, body, departments) {
  if (user?.role !== 'GM') throw new Error('Only the GM can edit a company project.')
  if (!departments.some(({ id }) => id === departmentId)) throw new Error('Select a valid destination department.')
  if (body.departmentId && body.departmentId !== departmentId) throw new Error('A project cannot be moved after creation.')
  return reviseProject(user, departmentId, projectId, body)
}

function insertTask(user, dept, { title, description, affectedDepartment, category, due, projectId, attachments, assistantRequestId }) {
  const t = String(title ?? '').trim()
  if (!t) throw new Error('A task title is required.')
  if (t.length > 160) throw new Error('Title is too long.')
  const priority = priorityFor(affectedDepartment, category)
  if (!priority) throw new Error('Select a valid affected department and issue category.')
  if (projectId && !(readProjects()[dept] ?? []).some((project) => project.id === projectId)) throw new Error('Select a project assigned to this department.')
  const createdAt = Date.now()
  const dueAt = due ? new Date(`${due}T12:00:00`).getTime() : createdAt + 7 * DAY
  if (!Number.isFinite(dueAt)) throw new Error('Enter a valid due date.')
  const store = read()
  const list = store[dept] ?? []
  list.push({
    id: `${dept}-t${createdAt}-${Math.random().toString(36).slice(2, 8)}`, title: t, description: String(description ?? '').trim().slice(0, 600),
    affectedDepartment, category, attachments: validateAttachments(attachments), projectId: projectId || null, priority, status: 'To do',
    due: dueAt, createdBy: user.id, createdAt, assistantRequestId: assistantRequestId || null,
  })
  store[dept] = list
  write(store)
}

export function addTask(user, body) {
  return insertTask(user, scope(user), body)
}

export function addCompanyTask(user, departmentId, body, departments) {
  if (user?.role !== 'GM') throw new Error('Only the GM can route company activities.')
  if (!departments.some(({ id }) => id === departmentId)) throw new Error('Select a valid destination department.')
  return insertTask(user, departmentId, body)
}

function reviseTask(user, dept, taskId, { title, description, affectedDepartment, category, due, projectId, attachments }) {
  const store = read()
  const list = store[dept] ?? []
  const index = list.findIndex((task) => task.id === taskId)
  if (index < 0) throw new Error('Task not found in this department.')
  const name = String(title ?? '').trim()
  if (!name || name.length > 160) throw new Error('Enter a task title of up to 160 characters.')
  const priority = priorityFor(affectedDepartment, category)
  if (!priority) throw new Error('Select a valid affected department and issue category.')
  if (projectId && !(readProjects()[dept] ?? []).some((project) => project.id === projectId)) throw new Error('Select a project assigned to this department.')
  const dueAt = due ? new Date(`${due}T12:00:00`).getTime() : list[index].due
  if (!Number.isFinite(dueAt)) throw new Error('Enter a valid due date.')
  list[index] = { ...list[index], attachments: validateAttachments(attachments ?? list[index].attachments), title: name, description: String(description ?? '').trim().slice(0, 600), affectedDepartment, category, priority, projectId: projectId || null, due: dueAt, updatedAt: Date.now(), updatedBy: user.id }
  store[dept] = list
  write(store)
}

export function updateTask(user, taskId, body) {
  return reviseTask(user, scope(user), taskId, body)
}

export function updateCompanyTask(user, departmentId, taskId, body, departments) {
  if (user?.role !== 'GM') throw new Error('Only the GM can edit company activities.')
  if (!departments.some(({ id }) => id === departmentId)) throw new Error('Select a valid destination department.')
  if (body.departmentId && body.departmentId !== departmentId) throw new Error('A task cannot be moved after creation.')
  return reviseTask(user, departmentId, taskId, body)
}

export function setTaskStatus(user, taskId, status) {
  const dept = scope(user)
  if (!TASK_STATUSES.includes(status)) throw new Error('Invalid status.')
  const store = read()
  const list = store[dept] ?? []
  const task = list.find((x) => x.id === taskId)
  if (!task) throw new Error('Task not found.')
  task.status = status
  store[dept] = list
  write(store)
}

export function createAssistantTask(user, body, departments) {
  if (!['GM', 'Dept Head', 'Staff', 'Admin'].includes(user?.role)) throw new Error('This account can view tasks but cannot create requests.')
  if (!departments.some(department => department.id === body.departmentId)) throw new Error('Choose the receiving department.')
  const existing = (read()[body.departmentId] ?? []).find(task => body.assistantRequestId && task.assistantRequestId === body.assistantRequestId && task.createdBy === user.id)
  if (existing) return existing
  return insertTask(user, body.departmentId, body)
}
