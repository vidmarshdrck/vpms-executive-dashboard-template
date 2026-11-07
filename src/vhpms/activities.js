export const ACTIVITY_KEY = 'vhpms-activities-v1'
export const STATUSES = ['To do', 'In progress', 'Blocked', 'Done']
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

export function emptyActivities() {
  return { version: 1, tasks: [], initiatives: [], force: [] }
}

export function parseActivities(raw) {
  try {
    const state = JSON.parse(raw)
    if (state?.version !== 1 || !Array.isArray(state.tasks) || !Array.isArray(state.initiatives) || !Array.isArray(state.force)) return emptyActivities()
    return state
  } catch {
    return emptyActivities()
  }
}

function titleOf(input) {
  const title = String(input.title || '').trim()
  if (!title) throw new Error('Enter a title.')
  return title
}

export function addActivity(state, input) {
  const task = {
    id: crypto.randomUUID(),
    title: titleOf(input),
    description: String(input.description || '').trim(),
    status: STATUSES.includes(input.status) ? input.status : 'To do',
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'Medium',
    due: String(input.due || ''),
    initiativeId: String(input.initiativeId || ''),
    createdAt: new Date().toISOString(),
  }
  return { ...state, tasks: [task, ...state.tasks] }
}

export function setActivityStatus(state, id, status) {
  if (!STATUSES.includes(status)) throw new Error('Select a status.')
  return { ...state, tasks: state.tasks.map((task) => task.id === id ? { ...task, status } : task) }
}

export function addInitiative(state, input) {
  const initiative = {
    id: crypto.randomUUID(),
    title: titleOf(input),
    description: String(input.description || '').trim(),
    due: String(input.due || ''),
    createdAt: new Date().toISOString(),
  }
  return { ...state, initiatives: [initiative, ...state.initiatives] }
}

export function initiativeProgress(state, id) {
  const linked = state.tasks.filter((task) => task.initiativeId === id)
  const done = linked.filter((task) => task.status === 'Done').length
  return { done, total: linked.length, pct: linked.length ? Math.round((done / linked.length) * 100) : null }
}

export function addForceItem(state, input) {
  const item = {
    id: crypto.randomUUID(),
    title: titleOf(input),
    members: String(input.members || '').trim(),
    description: String(input.description || '').trim(),
    status: STATUSES.includes(input.status) ? input.status : 'To do',
    due: String(input.due || ''),
    createdAt: new Date().toISOString(),
  }
  if (!item.members) throw new Error('Enter who is on the task force.')
  return { ...state, force: [item, ...state.force] }
}

export function setForceStatus(state, id, status) {
  if (!STATUSES.includes(status)) throw new Error('Select a status.')
  return { ...state, force: state.force.map((item) => item.id === id ? { ...item, status } : item) }
}

export function statusCounts(items) {
  return STATUSES.map((status) => [status, items.filter((item) => item.status === status).length])
}
