import test from 'node:test'
import assert from 'node:assert/strict'
import { readKpiSetup, saveKpiDefinition, activateKpis, getKpiActivation, automaticKpiValue } from './kpiSetup.js'
import { createDraft, saveDraft, submitForReview, approveSubmission, returnSubmission, getPublishedKpiValue } from './kpiSubmissions.js'
import { activatedKpiScore, departmentsWithPublishedKpis } from './departmentsWithPublishedKpis.js'
import { periodAchievement } from './scorecard.js'
import { saveBookEntry, reviewBookEntry, readBooks } from './entryBooks.js'
const gm = { id: 'gm', name: 'GM', role: 'GM' }
const head = { id: 'finance_head', name: 'Finance Head', role: 'Dept Head', departmentId: 'finance' }
const ops = { id: 'operations_head', name: 'Operations Head', role: 'Dept Head', departmentId: 'operations' }
function isolated(fn) {
  const storage = globalThis.localStorage, win = globalThis.window, data = new Map()
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  globalThis.window = { dispatchEvent() {} }
  try { fn(data) } finally { globalThis.localStorage = storage; globalThis.window = win }
}
function single(extra = {}) {
  const definitions = readKpiSetup().definitions.finance
  definitions.slice(1).forEach(kpi => saveKpiDefinition(gm, 'finance', { ...kpi, included: false }))
  return saveKpiDefinition(gm, 'finance', { ...definitions[0], target: 100, ...extra })
}
function publish(period, code, actual) {
  const draft = createDraft(head, 'finance', period)
  saveDraft(draft.id, { [code]: actual }, head); submitForReview(draft.id, head); approveSubmission(draft.id, gm)
  return draft
}
test('only GM defines and activates KPIs; departments cannot enter before activation or enter another department', () => isolated(() => {
  const kpi = readKpiSetup().definitions.finance[0]
  for (const role of ['Staff', 'Dept Head', 'Admin', 'Board']) {
    assert.throws(() => saveKpiDefinition({ ...head, role }, 'finance', kpi), /Only the GM/)
    assert.throws(() => activateKpis({ ...head, role }, ['finance'], 2026, 'Q4'), /Only the GM/)
  }
  assert.throws(() => createDraft(head, 'finance', '2026-Q4'), /not activated/)
  assert.throws(() => createDraft(head, 'operations', '2026-Q4'), /own department/)
  assert.throws(() => activateKpis(gm, ['finance'], 2026, 'Q5'), /valid year/)
  assert.throws(() => saveKpiDefinition(gm, 'finance', { ...kpi, target: null }), /target/)
}))
test('activation snapshots survive target edits, reuse across years, and repeat activation', () => isolated(() => {
  const kpi = single(); activateKpis(gm, ['finance'], 2026, 'Q4')
  saveKpiDefinition(gm, 'finance', { ...kpi, target: 200 })
  activateKpis(gm, ['finance'], 2027, 'Q1')
  assert.equal(getKpiActivation('finance', '2026-Q4').kpis[0].target, 100)
  assert.equal(getKpiActivation('finance', '2027-Q1').kpis[0].target, 200)
  assert.throws(() => activateKpis(gm, ['finance'], 2026, 'Q4'), /already activated/)
  const detached = getKpiActivation('finance', '2026-Q4'); detached.kpis[0].target = 999
  assert.equal(getKpiActivation('finance', '2026-Q4').kpis[0].target, 100)
}))
test('all assigned actuals required, unknown codes rejected, approved values isolated by year, corrections retain published values', () => isolated(() => {
  const kpi = single(); activateKpis(gm, ['finance'], 2026, 'Q4'); activateKpis(gm, ['finance'], 2027, 'Q4')
  const draft = createDraft(head, 'finance', '2026-Q4')
  assert.throws(() => submitForReview(draft.id, head), /non-negative actual/)
  assert.throws(() => saveDraft(draft.id, { invalid: 100 }, head), /activated KPI set/)
  saveDraft(draft.id, { [kpi.code]: -1 }, head); assert.throws(() => submitForReview(draft.id, head), /non-negative/)
  saveDraft(draft.id, { [kpi.code]: 50 }, head); submitForReview(draft.id, head)
  assert.equal(activatedKpiScore(2026, [9, 10, 11]).overall, null)
  returnSubmission(draft.id, gm, 'Check actual'); saveDraft(draft.id, { [kpi.code]: 80 }, head); submitForReview(draft.id, head); approveSubmission(draft.id, gm, 'Confirmed')
  assert.equal(activatedKpiScore(2026, [9, 10, 11]).overall, 80)
  assert.equal(getPublishedKpiValue('finance', kpi.code, '2027-Q4'), null)
  const revision = createDraft(head, 'finance', '2026-Q4'); saveDraft(revision.id, { [kpi.code]: 90 }, head)
  assert.equal(getPublishedKpiValue('finance', kpi.code, '2026-Q4').value, 80)
  submitForReview(revision.id, head); approveSubmission(revision.id, gm)
  assert.equal(activatedKpiScore(2026, [9, 10, 11]).overall, 90)
}))
test('quarter scoring uses historical targets and excludes other departments baseline figures', () => isolated(() => {
  const kpi = single(); activateKpis(gm, ['finance'], 2027, 'Q1'); publish('2027-Q1', kpi.code, 50)
  saveKpiDefinition(gm, 'finance', { ...kpi, target: 200 }); activateKpis(gm, ['finance'], 2027, 'Q2'); publish('2027-Q2', kpi.code, 200)
  const result = departmentsWithPublishedKpis(2027, [0, 1, 2, 3, 4, 5]).find(dept => dept.id === 'finance').kpis[0]
  assert.equal(periodAchievement(result, [0, 1, 2]), 50)
  assert.equal(periodAchievement(result, [3, 4, 5]), 100)
  assert.equal(activatedKpiScore(2027, [0, 1, 2, 3, 4, 5]).overall, 75)
  assert.equal(activatedKpiScore(2026, [9, 10, 11]), null)
}))
test('automatic Finance actuals use approved books only, ignore forged actuals and freeze on submission', () => isolated(() => {
  const kpi = single({ source: 'finance.revenue', unit: 'ZMW', target: 2000 }); activateKpis(gm, ['finance'], 2026, 'Q4')
  const form = { frequency: 'weekly', start: '2026-10-05', end: '2026-10-11', values: { revenue: 1000, target: 1200, expenditure: 500 } }
  const book = saveBookEntry(head, form, true), draft = createDraft(head, 'finance', '2026-Q4')
  assert.equal(automaticKpiValue(kpi, '2026-Q4'), null)
  assert.throws(() => submitForReview(draft.id, head), /source book/)
  reviewBookEntry(gm, book.id, true)
  assert.equal(saveDraft(draft.id, { [kpi.code]: 99999 }, head).values[kpi.code], 1000)
  submitForReview(draft.id, head)
  saveBookEntry(head, { ...form, id: book.id, values: { ...form.values, revenue: 2000 } }, true); reviewBookEntry(gm, book.id, true)
  approveSubmission(draft.id, gm)
  assert.equal(getPublishedKpiValue('finance', kpi.code, '2026-Q4').value, 1000)
  assert.equal(automaticKpiValue(kpi, '2027-Q4'), null)
}))
test('Operations automatic totals combine approved products; missing denominator stays unreported', () => isolated(() => {
  const kpi = { source: 'operations.distributionRate' }
  assert.equal(automaticKpiValue(kpi, '2026-Q4'), null)
  for (const product of ['LSG', 'PMS']) { const book = saveBookEntry(ops, { frequency: 'daily', start: '2026-10-05', end: '2026-10-05', product, values: { received: 100, distributed: 80 } }, true); reviewBookEntry(gm, book.id, true) }
  assert.equal(automaticKpiValue(kpi, '2026-Q4'), 80)
  assert.equal(automaticKpiValue({ source: 'operations.received' }, '2026-Q4'), 200)
}))
test('batch activation validates all departments before saving and storage errors preserve prior data', () => isolated(data => {
  single(); const before = data.get('vpms-kpi-setup-v1')
  assert.throws(() => activateKpis(gm, ['finance', 'invalid'], 2026, 'Q4'), /valid department/)
  assert.equal(data.get('vpms-kpi-setup-v1'), before)
  globalThis.localStorage.setItem = () => { throw new Error('quota') }
  assert.throws(() => activateKpis(gm, ['finance'], 2026, 'Q4'), /could not be saved/)
  assert.equal(data.get('vpms-kpi-setup-v1'), before)
}))
test('book document attachments survive draft edits and approved snapshots', () => isolated(() => {
  const attachment = { id: 'file-1', name: 'report.pdf', type: 'application/pdf', size: 3, data: 'data:application/pdf;base64,YWJj' }
  const form = { frequency: 'daily', start: '2026-10-05', end: '2026-10-05', values: { revenue: 100, target: 100, expenditure: 20 }, attachments: [attachment] }
  const book = saveBookEntry(head, form)
  saveBookEntry(head, { ...form, id: book.id, attachments: undefined }, true); reviewBookEntry(gm, book.id, true)
  assert.equal(readBooks().published[book.id].attachments[0].name, 'report.pdf')
}))
