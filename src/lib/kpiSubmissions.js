// KPI submission workflow: Draft -> Submitted -> Approved (= Published), with
// a Returned branch back to Draft for revision.
//
//   DRAFT -> SUBMITTED -> APPROVED (approval IS publish, no extra step)
//   SUBMITTED -> RETURNED -> DRAFT (revise) -> SUBMITTED -> APPROVED
//
// Storage is localStorage because this sanitized copy has no backend — see
// the repo-level IMPLEMENTATION_REPORT.md. The function signatures here are
// written to be backend-agnostic (take a `currentUser`, return/throw plain
// data) so swapping the body of each function for a `fetch()` call later is
// a small, local change; UI components must only ever call these functions
// and must never read `localStorage` directly.
//
// SECURITY NOTE: every authorization check below (department ownership,
// GM-only approval) is enforced in this module because there is no server
// to enforce it for us. A client can still edit localStorage directly or
// call these functions with a forged `currentUser` object — none of this is
// a real security boundary. When this is wired to a live backend/API, these
// same checks MUST be re-implemented server-side against a signed session
// (e.g. a JWT or server session cookie), and this client-side copy should be
// treated as a UX convenience (fast feedback, disabled buttons) only.

const STORE_KEY = 'vpms-kpi-submissions'
const CHANGE_EVENT = 'vpms:kpi-submissions-changed'

export const STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  RETURNED: 'RETURNED',
  APPROVED: 'APPROVED',
}

const ACTIVE_STATUSES = [STATUS.DRAFT, STATUS.SUBMITTED, STATUS.RETURNED]

function periodKey(departmentId, period) {
  return `${departmentId}::${period}`
}

// Exported so dashboard code can key its own lookups into
// getAllPublishedValues() without this module leaking its storage shape.
export function publishedKey(departmentId, kpiCode, period) {
  return `${departmentId}::${kpiCode}::${period}`
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      submissions: parsed?.submissions ?? [],
      published: parsed?.published ?? {},
    }
  } catch {
    return { submissions: [], published: {} }
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — the workflow
    // simply won't persist; callers already hold the in-memory result.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function actorOf(user) {
  return { id: user?.id, name: user?.name, role: user?.role }
}

function appendHistory(submission, status, user, comment) {
  submission.history = [...(submission.history ?? []), { status, by: actorOf(user), at: new Date().toISOString(), comment: comment || undefined }]
}

function requireDeptUser(user, departmentId) {
  if (!user || !['Dept Head', 'Staff'].includes(user.role)) {
    throw new Error('Only a Dept Head or Staff member can do this.')
  }
  if (user.departmentId !== departmentId) {
    throw new Error('You can only act on your own department\'s submissions.')
  }
}

function requireGM(user) {
  if (!user || user.role !== 'GM') {
    throw new Error('Only the GM can do this.')
  }
}

function findSubmission(store, submissionId) {
  const submission = store.submissions.find((s) => s.id === submissionId)
  if (!submission) throw new Error('Submission not found.')
  return submission
}

function cloneSubmission(submission) {
  return submission ? JSON.parse(JSON.stringify(submission)) : submission
}

/**
 * Validates a submission's values map: every value must be a finite number,
 * and at least one KPI must be filled in (reject an entirely empty submission).
 */
export function validateValues(values) {
  const entries = Object.entries(values ?? {}).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  if (entries.length === 0) return 'Enter at least one KPI value before submitting.'
  for (const [code, value] of entries) {
    if (!Number.isFinite(Number(value))) return `"${code}" must be a number.`
  }
  return null
}

/**
 * Returns the department's current working submission for a period: the
 * existing DRAFT/SUBMITTED/RETURNED one if there is one (continue editing /
 * view status), otherwise null — the caller should call createDraft().
 */
export function getActiveSubmission(user, departmentId, period) {
  requireDeptUser(user, departmentId)
  const store = readStore()
  const submission = store.submissions.find((s) => s.departmentId === departmentId && s.period === period && ACTIVE_STATUSES.includes(s.status))
  return cloneSubmission(submission) ?? null
}

/**
 * Starts a new draft for department/period. If an active (non-approved)
 * submission already exists for that department+period, returns it instead
 * of creating a duplicate. If the only existing submission is APPROVED,
 * this deliberately starts a new revision on top of it.
 */
export function createDraft(user, departmentId, period) {
  requireDeptUser(user, departmentId)
  const existingActive = getActiveSubmission(user, departmentId, period)
  if (existingActive) return existingActive

  const store = readStore()
  const previousApproved = store.submissions.find((s) => s.departmentId === departmentId && s.period === period && s.status === STATUS.APPROVED)

  const submission = {
    id: `${periodKey(departmentId, period)}::${Date.now()}`,
    departmentId,
    period,
    status: STATUS.DRAFT,
    values: {},
    reviewComment: null,
    revisionOf: previousApproved?.id ?? null,
    createdBy: actorOf(user),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  }
  appendHistory(submission, STATUS.DRAFT, user, previousApproved ? 'Revision started' : 'Draft created')

  store.submissions.push(submission)
  writeStore(store)
  return cloneSubmission(submission)
}

/**
 * Saves KPI values onto a DRAFT (or RETURNED, to begin revising) submission
 * without changing its status or touching the published record.
 */
export function saveDraft(submissionId, values, user) {
  const store = readStore()
  const submission = findSubmission(store, submissionId)
  requireDeptUser(user, submission.departmentId)
  if (submission.status !== STATUS.DRAFT && submission.status !== STATUS.RETURNED) {
    throw new Error(`Cannot edit a submission that is ${submission.status}.`)
  }
  submission.values = { ...values }
  submission.updatedAt = new Date().toISOString()
  if (submission.status === STATUS.RETURNED) submission.status = STATUS.DRAFT
  writeStore(store)
  return cloneSubmission(submission)
}

/**
 * Moves a DRAFT (or RETURNED) submission to SUBMITTED for GM review.
 * Re-checks department ownership server-side-equivalent — see module header.
 */
export function submitForReview(submissionId, user) {
  const store = readStore()
  const submission = findSubmission(store, submissionId)
  requireDeptUser(user, submission.departmentId)
  if (submission.status !== STATUS.DRAFT && submission.status !== STATUS.RETURNED) {
    throw new Error(`Cannot submit a submission that is ${submission.status}.`)
  }
  const validationError = validateValues(submission.values)
  if (validationError) throw new Error(validationError)

  submission.status = STATUS.SUBMITTED
  submission.updatedAt = new Date().toISOString()
  appendHistory(submission, STATUS.SUBMITTED, user)
  writeStore(store)
  return cloneSubmission(submission)
}

/** All submissions currently awaiting GM review, across every department. */
export function listPendingForGM(user) {
  requireGM(user)
  const store = readStore()
  return store.submissions.filter((s) => s.status === STATUS.SUBMITTED).map(cloneSubmission)
}

/** Every submission for a department (any status) — for the entry UI's own history view. */
export function listSubmissionsForDepartment(user, departmentId) {
  requireDeptUser(user, departmentId)
  const store = readStore()
  return store.submissions
    .filter((s) => s.departmentId === departmentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(cloneSubmission)
}

/** Every submission, any department, any status — for the GM's full review list. */
export function listAllSubmissions(user) {
  requireGM(user)
  const store = readStore()
  return store.submissions.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(cloneSubmission)
}

/**
 * Approves a SUBMITTED submission. This is the single publish action: it
 * writes every KPI value onto the published index immediately, so there is
 * no separate "publish" step and no manual copy from a GM's notes onto the
 * dashboard. An optional comment is recorded as the GM's review comment,
 * never as a silent edit of the department's reported figures.
 */
export function approveSubmission(submissionId, user, comment) {
  const store = readStore()
  const submission = findSubmission(store, submissionId)
  requireGM(user)
  if (submission.status !== STATUS.SUBMITTED) {
    throw new Error(`Cannot approve a submission that is ${submission.status}.`)
  }

  submission.status = STATUS.APPROVED
  submission.reviewComment = comment || null
  submission.updatedAt = new Date().toISOString()
  appendHistory(submission, STATUS.APPROVED, user, comment)

  for (const [kpiCode, value] of Object.entries(submission.values)) {
    if (value === '' || value === null || value === undefined) continue
    store.published[publishedKey(submission.departmentId, kpiCode, submission.period)] = {
      value: Number(value),
      submissionId: submission.id,
      approvedBy: actorOf(user),
      approvedAt: submission.updatedAt,
    }
  }

  writeStore(store)
  return cloneSubmission(submission)
}

/**
 * Returns a SUBMITTED submission to the department for revision. The GM's
 * comment is required so the Dept Head/Staff know what to fix; it is stored
 * as a review comment, not as an edit to their values.
 */
export function returnSubmission(submissionId, user, comment) {
  if (!comment || !comment.trim()) throw new Error('A comment is required when returning a submission.')
  const store = readStore()
  const submission = findSubmission(store, submissionId)
  requireGM(user)
  if (submission.status !== STATUS.SUBMITTED) {
    throw new Error(`Cannot return a submission that is ${submission.status}.`)
  }

  submission.status = STATUS.RETURNED
  submission.reviewComment = comment
  submission.updatedAt = new Date().toISOString()
  appendHistory(submission, STATUS.RETURNED, user, comment)
  writeStore(store)
  return cloneSubmission(submission)
}

/** Append-only status history for one submission — the audit trail. */
export function getSubmissionHistory(submissionId) {
  const store = readStore()
  const submission = store.submissions.find((s) => s.id === submissionId)
  return submission ? [...submission.history] : []
}

/**
 * The single source of truth for "official" published KPI data: the most
 * recently approved value for this department+KPI+period, or null if no
 * submission has been approved for it yet (dashboards must fall back to
 * baseline/demo data in that case, not show zero).
 */
export function getPublishedKpiValue(departmentId, kpiCode, period) {
  const store = readStore()
  const entry = store.published[publishedKey(departmentId, kpiCode, period)]
  return entry ? { ...entry } : null
}

/** Every published (department, kpiCode, period) -> value entry, for dashboard wiring. */
export function getAllPublishedValues() {
  const store = readStore()
  return { ...store.published }
}

/**
 * Subscribes to any change made through this module, in this tab (dispatched
 * explicitly) or another tab (the native `storage` event). Returns an
 * unsubscribe function. Used by dashboards to re-render when GM approves a
 * submission in a different tab/session.
 */
export function subscribeToSubmissions(callback) {
  const storageListener = (event) => {
    if (!event.key || event.key === STORE_KEY) callback()
  }
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', storageListener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', storageListener)
  }
}
