import test from 'node:test'
import assert from 'node:assert/strict'
import { readChats, saveChats, prepareTaskRequest, quickTazaiReply, scheduleTazaiNoteEmail, TAZAI_NOTE_EMAIL_DELAY } from './tazai.js'
import { validateAttachments } from './attachments.js'
import { createAssistantTask, listTasks, updateTask, addDepartmentProject, listDepartmentProjects, updateDepartmentProject } from './departmentTasks.js'
import { importBookEntries, readBooks } from './entryBooks.js'
import { importDate, importNumber } from './excelImport.js'
const finance = { id: 'finance_head', role: 'Dept Head', departmentId: 'finance', name: 'Finance Head' }
const ict = { id: 'ict_head', role: 'Dept Head', departmentId: 'ict', name: 'ICT Head' }
const departments = [{ id: 'finance', name: 'Finance' }, { id: 'ict', name: 'ICT' }, { id: 'operations', name: 'Operations' }]
const file = { id: 'doc1', name: 'Brief.pdf', type: 'application/pdf', size: 5, data: 'data:application/pdf;base64,aGVsbG8=' }
function isolated(fn) {
  const previousStorage = globalThis.localStorage, previousWindow = globalThis.window
  const map = new Map()
  globalThis.localStorage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }
  globalThis.window = { dispatchEvent() {} }
  try { fn(map) } finally { globalThis.localStorage = previousStorage; globalThis.window = previousWindow }
}
test('Bagheera chat histories are scoped to the signed-in user', () => isolated(() => {
  saveChats(finance, [{ id: 'c1', title: 'Private task request', messages: [] }])
  assert.equal(readChats(finance)[0].title, 'Private task request')
  assert.deepEqual(readChats(ict), [])
}))
test('quick Bagheera answers in page context and directs complex requests to the full assistant', () => {
  assert.match(quickTazaiReply('Where are my KPI targets?', finance, 'KPI'), /KPI entry/)
  assert.match(quickTazaiReply('My printer is broken', finance, 'Executive overview'), /full Bagheera/)
  assert.match(quickTazaiReply('Hello', finance, 'Finance'), /Hello, Finance/)
})
test('Bagheera queues note email ten minutes after the last edit', () => {
  const schedule = scheduleTazaiNoteEmail('Check the revenue variance', { ...finance, email: 'finance_head@vpms.demo' }, 'Executive overview', 1000)
  assert.equal(schedule.dueAt, 1000 + TAZAI_NOTE_EMAIL_DELAY)
  assert.equal(schedule.email, 'finance_head@vpms.demo')
  assert.equal(schedule.page, 'Executive overview')
  assert.equal(scheduleTazaiNoteEmail('  ', { ...finance, email: 'finance_head@vpms.demo' }, 'KPI', 1000), null)
})
test('task preparation recognises issue type and preserves attachments', () => {
  const draft = prepareTaskRequest('Create a task for Operations: printer is broken', finance, departments, [file])
  assert.equal(draft.departmentId, 'operations'); assert.equal(draft.category, 'Printer Issues'); assert.equal(draft.affectedDepartment, 'Finance'); assert.deepEqual(draft.attachments, [file])
})
test('assistant task requests route to the receiving department, preserve priority rules and avoid duplicates', () => isolated(() => {
  const user = { ...finance, role: 'Staff' }
  const body = { title: 'Finance network outage', departmentId: 'ict', affectedDepartment: 'Finance', category: 'Network', assistantRequestId: 'request1', attachments: [file] }
  createAssistantTask(user, body, departments); createAssistantTask(user, body, departments)
  assert.equal(listTasks(ict).length, 1); assert.equal(listTasks(ict)[0].priority, 'Critical'); assert.deepEqual(listTasks(ict)[0].attachments, [file])
  assert.throws(() => createAssistantTask({ id: 'board', role: 'Board' }, body, departments), /view access|view tasks/)
  assert.throws(() => createAssistantTask(user, { ...body, departmentId: 'unknown' }, departments), /receiving department/)
}))
test('editing tasks and projects retains documents unless explicitly replaced', () => isolated(() => {
  const body = { title: 'Attached task', departmentId: 'ict', affectedDepartment: 'Finance', category: 'Network', attachments: [file] }
  createAssistantTask(finance, body, departments)
  const task = listTasks(ict)[0]; updateTask(ict, task.id, { ...body, title: 'Updated', attachments: undefined })
  assert.deepEqual(listTasks(ict)[0].attachments, [file])
  addDepartmentProject(finance, { title: 'Budget project', attachments: [file] })
  const project = listDepartmentProjects(finance)[0]; updateDepartmentProject(finance, project.id, { title: 'Updated project' })
  assert.deepEqual(listDepartmentProjects(finance)[0].attachments, [file])
}))
test('unsupported and oversized attachments are rejected', () => {
  assert.throws(() => validateAttachments([{ ...file, name: 'run.html', data: 'data:text/html;base64,aGVsbG8=' }]), /supported/)
  assert.throws(() => validateAttachments([{ ...file, size: 3 * 1024 * 1024 }]), /2 MB/)
  assert.throws(() => validateAttachments([{ ...file, data: 'data:application/pdf-unsafe;base64,aGVsbG8=' }]), /supported/)
})
test('Excel import is atomic and imports drafts rather than publishing', () => isolated(() => {
  const entry = { frequency: 'daily', start: '2026-10-05', end: '2026-10-05', values: { revenue: 100, target: 150, expenditure: 50 } }
  assert.throws(() => importBookEntries(finance, [entry, { ...entry, start: '2026-10-06', end: '2026-10-06', values: { revenue: -1 } }]), /Entry 2/)
  assert.equal(readBooks().entries.length, 0)
  importBookEntries(finance, [entry, { ...entry, start: '2026-10-06', end: '2026-10-06' }])
  assert.equal(readBooks().entries.length, 2); assert.ok(readBooks().entries.every(row => row.status === 'DRAFT')); assert.deepEqual(readBooks().published, {})
}))
test('Excel dates and numbers parse without silently guessing ambiguous dates', () => {
  assert.equal(importDate('2026-10-05'), '2026-10-05')
  assert.throws(() => importDate('10/05/2026'), /YYYY-MM-DD/)
  assert.equal(importNumber('K 1,234.56'), 1234.56)
  assert.throws(() => importNumber(''), /empty/)
})
