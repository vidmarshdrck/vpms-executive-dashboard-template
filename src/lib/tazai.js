import { ISSUE_CATEGORIES } from './ticketPriority.js'
export const TAZAI_NOTE_EMAIL_DELAY = 10 * 60 * 1000
export function readChats(user) {
  const raw = localStorage.getItem(`vpms-tazai-${user.id}`)
  if (!raw) return []
  const chats = JSON.parse(raw)
  if (!Array.isArray(chats)) throw new Error('Chat history could not be read.')
  return chats
}
export function saveChats(user, chats) {
  try { localStorage.setItem(`vpms-tazai-${user.id}`, JSON.stringify(chats)) }
  catch { throw new Error('This chat could not be saved. Free some browser storage and try again.') }
}
export function quickTazaiReply(text, user, currentPage = 'the dashboard') {
  const question = String(text || '').trim()
  const firstName = user?.name?.split(' · ')[0]?.split(' ')[0] || 'there'
  if (/\b(hello|hi|hey|good morning|good afternoon)\b/i.test(question)) return `Hello, ${firstName}. I’m here while you review ${currentPage}. What would you like help with?`
  if (/\b(kpi|goal|target)\b/i.test(question)) return user?.role === 'GM'
    ? 'Open KPI → KPI setup to define department KPIs and activate them for a year and quarter. KPI register shows the activated targets and approved actuals.'
    : 'Open KPI to view the KPIs activated for your department. Department heads can enter actuals under KPI entry, then submit them for review.'
  if (/\b(task|ticket|printer|network|password|issue|error|broken|not working|outage|laptop)\b/i.test(question)) return 'I can help prepare that request. Open full Tazai below to add details, files or a voice note and create the task for the right department.'
  if (/\b(project|activity|activities)\b/i.test(question)) return 'Open Activities to review tasks and projects. You can also open full Tazai and ask it to show your tasks.'
  if (/\b(forum|post|announcement|event)\b/i.test(question)) return 'Open Forum to read staff posts, announcements and events, or to create a post.'
  return `I can answer quick questions about this PMS while you stay on ${currentPage}. For task creation, attachments, voice controls and chat history, open full Tazai.`
}
export function scheduleTazaiNoteEmail(notes, user, currentPage, now = Date.now()) {
  const body = String(notes || '').trim()
  if (!body || !user?.email) return null
  return { body, email: user.email, userId: user.id, page: currentPage, dueAt: now + TAZAI_NOTE_EMAIL_DELAY }
}
export function prepareTaskRequest(text, user, departments, attachments = []) {
  const mentioned = departments.find(department => new RegExp(`(?:to|for|assign(?:ed)? to) (?:the )?${department.name}|\\b${department.id} department\\b`, 'i').test(text))
  const categories = [[/print|toner/i, 'Printer Issues'], [/email|mailbox|outlook/i, 'Email Issues'], [/network|wi-?fi|internet|connection/i, 'Network'], [/password|login|log in|account|access/i, 'Account Access'], [/security|malware|virus/i, 'Security Issues'], [/laptop|computer|screen|keyboard|hardware/i, 'Hardware'], [/software|app|system|error/i, 'Software']]
  const own = departments.find(department => department.id === user.departmentId)?.name
  const affected = { Engineering: 'Maintenance', ICT: 'Administration', Procurement: 'Commercial', 'Product Monitoring': 'Operations', Safety: 'Operations' }[own] || own || ''
  return { title: text.trim().slice(0, 160), description: text.trim().slice(0, 600), departmentId: mentioned?.id || 'ict', affectedDepartment: affected, category: ISSUE_CATEGORIES.find(category => text.toLowerCase().includes(category.toLowerCase())) || categories.find(([pattern]) => pattern.test(text))?.[1] || '', attachments }
}
