import assert from 'node:assert/strict'
import test from 'node:test'
import { addTask, addCompanyTask, addDepartmentProject, listCompanyTasks, listDepartmentProjects, listTasks, setTaskStatus, updateTask, updateCompanyTask, updateDepartmentProject, updateCompanyProject } from './departmentTasks.js'

test('task creation recalculates priority and ignores a forged client value', () => {
  const previousStorage = globalThis.localStorage
  const previousWindow = globalThis.window
  const records = new Map()
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  }
  globalThis.window = { dispatchEvent: () => {} }

  try {
    const user = { id: 'ict_head', role: 'Dept Head', departmentId: 'ict' }
    records.set('vpms-department-tasks', JSON.stringify({ ict: [{ id: 'historical', title: 'Historical task', priority: 'Low', status: 'Done', due: 0 }] }))
    assert.throws(() => addTask(user, { title: 'Missing category', affectedDepartment: 'Finance' }), /department and issue category/)
    addTask(user, { title: 'Network outage', affectedDepartment: 'Finance', category: 'Network', priority: 'Low' })
    const saved = listTasks(user)
    const task = saved.find((item) => item.title === 'Network outage')
    assert.equal(task.priority, 'Critical')
    assert.equal(task.affectedDepartment, 'Finance')
    assert.equal(task.category, 'Network')
    assert.equal(saved.find((item) => item.id === 'historical').priority, 'Low')
  } finally {
    globalThis.localStorage = previousStorage
    globalThis.window = previousWindow
  }
})

test('GM routes a task to the selected PMS department and creation time is automatic', () => {
  const previousStorage = globalThis.localStorage
  const previousWindow = globalThis.window
  const records = new Map()
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  }
  globalThis.window = { dispatchEvent: () => {} }
  try {
    const gm = { id: 'gm', role: 'GM' }
    const ict = { id: 'ict_head', role: 'Dept Head', departmentId: 'ict' }
    const departments = [{ id: 'ict', name: 'ICT' }, { id: 'finance', name: 'Finance' }]
    const before = Date.now()
    assert.throws(() => addCompanyTask(ict, 'ict', { title: 'Fake' }, departments), /Only the GM/)
    assert.throws(() => addCompanyTask(gm, 'other', { title: 'Fake' }, departments), /valid destination/)
    addCompanyTask(gm, 'ict', { title: 'Finance network outage', affectedDepartment: 'Finance', category: 'Network', priority: 'Low', createdAt: 1 }, departments)
    const [task] = listCompanyTasks(gm, departments)
    assert.equal(task.departmentId, 'ict')
    assert.equal(task.priority, 'Critical')
    assert.ok(task.createdAt >= before && task.createdAt <= Date.now())
    assert.equal(listTasks(ict)[0].id, task.id)
  } finally {
    globalThis.localStorage = previousStorage
    globalThis.window = previousWindow
  }
})

test('department project progress follows its linked tasks and stays department-scoped', () => {
  const previousStorage = globalThis.localStorage
  const previousWindow = globalThis.window
  const records = new Map()
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  }
  globalThis.window = { dispatchEvent: () => {} }
  try {
    const ict = { id: 'ict_head', role: 'Dept Head', departmentId: 'ict' }
    const finance = { id: 'finance_head', role: 'Dept Head', departmentId: 'finance' }
    addDepartmentProject(ict, { title: 'Network rollout' })
    const [project] = listDepartmentProjects(ict)
    assert.equal(project.progress, 0)
    assert.equal(listDepartmentProjects(finance).length, 0)
    assert.throws(() => addTask(finance, { title: 'Cross-dept', affectedDepartment: 'Finance', category: 'Network', projectId: project.id }), /assigned to this department/)
    addTask(ict, { title: 'Install routers', affectedDepartment: 'Finance', category: 'Network', projectId: project.id })
    addTask(ict, { title: 'Verify network', affectedDepartment: 'Finance', category: 'Network', projectId: project.id })
    addTask(ict, { title: 'Standalone', affectedDepartment: 'Finance', category: 'Network' })
    assert.equal(listDepartmentProjects(ict)[0].progress, 0)
    const linked = listTasks(ict).filter((task) => task.projectId === project.id)
    setTaskStatus(ict, linked[0].id, 'Done')
    assert.equal(listDepartmentProjects(ict)[0].progress, 50)
    setTaskStatus(ict, linked[1].id, 'Done')
    assert.equal(listDepartmentProjects(ict)[0].progress, 100)
    setTaskStatus(ict, linked[0].id, 'In progress')
    assert.equal(listDepartmentProjects(ict)[0].progress, 50)
  } finally {
    globalThis.localStorage = previousStorage
    globalThis.window = previousWindow
  }
})

test('saved task and project edits preserve identity and recompute derived values', () => {
  const previousStorage = globalThis.localStorage
  const previousWindow = globalThis.window
  const records = new Map()
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  }
  globalThis.window = { dispatchEvent: () => {} }
  try {
    const ict = { id: 'ict_head', role: 'Dept Head', departmentId: 'ict' }
    const finance = { id: 'finance_head', role: 'Dept Head', departmentId: 'finance' }
    const gm = { id: 'gm', role: 'GM' }
    const departments = [{ id: 'ict', name: 'ICT' }, { id: 'finance', name: 'Finance' }]
    addDepartmentProject(ict, { title: 'Initial project', due: '2026-11-15' })
    addDepartmentProject(ict, { title: 'Second project' })
    const [firstProject, secondProject] = listDepartmentProjects(ict)
    addTask(ict, { title: 'Initial task', affectedDepartment: 'Human Resource', category: 'Hardware', projectId: firstProject.id, due: '2026-11-10' })
    const [task] = listTasks(ict)
    setTaskStatus(ict, task.id, 'Done')
    assert.equal(listDepartmentProjects(ict)[0].progress, 100)

    assert.throws(() => updateTask(finance, task.id, { title: 'Stolen' }), /not found/)
    assert.throws(() => updateCompanyTask(ict, 'ict', task.id, { title: 'Stolen' }, departments), /Only the GM/)
    assert.throws(() => updateCompanyTask(gm, 'ict', task.id, { title: 'Moved', departmentId: 'finance' }, departments), /cannot be moved/)
    updateTask(ict, task.id, { title: 'Revised task', description: 'Ready for review', affectedDepartment: 'Finance', category: 'Network', projectId: secondProject.id, due: '2026-11-20', priority: 'Low', createdAt: 1, status: 'To do' })
    const [savedTask] = listTasks(ict)
    assert.equal(savedTask.id, task.id)
    assert.equal(savedTask.createdAt, task.createdAt)
    assert.equal(savedTask.createdBy, task.createdBy)
    assert.equal(savedTask.status, 'Done')
    assert.equal(savedTask.priority, 'Critical')
    assert.equal(savedTask.title, 'Revised task')
    assert.equal(savedTask.description, 'Ready for review')
    assert.equal(savedTask.projectId, secondProject.id)
    assert.equal(listDepartmentProjects(ict)[0].progress, 0)
    assert.equal(listDepartmentProjects(ict)[1].progress, 100)

    assert.throws(() => updateDepartmentProject(finance, firstProject.id, { title: 'Stolen' }), /not found/)
    assert.throws(() => updateCompanyProject(gm, 'ict', firstProject.id, { title: 'Moved', departmentId: 'finance' }, departments), /cannot be moved/)
    updateDepartmentProject(ict, secondProject.id, { title: 'Revised project', description: 'Delivered by linked tasks', due: '2026-12-01', progress: 5, createdAt: 1 })
    const savedProject = listDepartmentProjects(ict)[1]
    assert.equal(savedProject.id, secondProject.id)
    assert.equal(savedProject.createdAt, secondProject.createdAt)
    assert.equal(savedProject.createdBy, secondProject.createdBy)
    assert.equal(savedProject.progress, 100)
    assert.equal(savedProject.title, 'Revised project')
    assert.equal(savedProject.description, 'Delivered by linked tasks')

    globalThis.localStorage.setItem = () => { throw new Error('Storage full') }
    assert.throws(() => updateTask(ict, task.id, { title: 'Unsaved', affectedDepartment: 'Finance', category: 'Network' }), /could not be saved/)
    assert.equal(listTasks(ict)[0].title, 'Revised task')
  } finally {
    globalThis.localStorage = previousStorage
    globalThis.window = previousWindow
  }
})
