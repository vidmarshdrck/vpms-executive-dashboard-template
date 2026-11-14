import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkspace, emptySources, fetchVeWorkspace } from './veData.js'

const event = { id: 'test-owner-event', business_id: 'VE', event: 've_family_reconciliation_v1', created_at: '2026-11-14T09:00:00Z', after_value: { version: 1, as_of: '2026-11-14', confirmed_activity: { '1': 'Active', '7': 'Inactive' }, preserved_activity: { '6': 'Active', '18': 'Inactive' }, cycles: [], source: 'owner-instruction.md', finance_source: 'boaz-finance-report.json' } }
function sources() {
 const s = emptySources('empty')
 s.familyAccounts = { access: 'ok', rows: [
  { fid: 1, due_date: '2026-04-16', paid_status: 'Unpaid', slot_1: 'V001', slots_total: 5 },
  { fid: 7, due_date: '2026-12-29', paid_status: 'Paid' },
  { fid: 6, due_date: '2027-01-15', paid_status: 'Unpaid' },
  { fid: 18, due_date: null, paid_status: 'Unpaid' },
 ] }
 s.reconciliation = { access: 'ok', rows: [event] }
 return s
}
test('owner-confirmed current activity overrides due dates but never payment or family data', () => {
 const s = sources(), baseline = structuredClone(s.familyAccounts)
 const model = buildWorkspace(s, '2026-11-14')
 assert.equal(model.accounts.find(a => a.id === '1').activity, 'Active')
 assert.equal(model.accounts.find(a => a.id === '7').activity, 'Inactive')
 assert.equal(model.accounts.find(a => a.id === '1').paidStatus, 'Unpaid')
 assert.equal(model.accounts.find(a => a.id === '7').paidStatus, 'Paid')
 assert.deepEqual(s.familyAccounts, baseline)
 assert.equal(model.accounts.find(a => a.id === '6').activity, 'Active')
 assert.equal(model.accounts.find(a => a.id === '18').activity, 'Inactive')
 assert.equal(model.accounts.find(a => a.id === '1').activitySource, 'Confirmed')
 assert.equal(model.accounts.find(a => a.id === '7').activitySource, 'Confirmed')
 assert.equal(model.accounts.find(a => a.id === '6').activitySource, 'Not confirmed')
 assert.equal(model.accounts.find(a => a.id === '18').activitySource, 'Not confirmed')
})

test('without a reconciliation event, activity follows the due date and stays unlabelled', () => {
 const s = sources()
 s.reconciliation = { access: 'empty', rows: [] }
 const model = buildWorkspace(s, '2026-11-14')
 assert.equal(model.accounts.find(a => a.id === '1').activity, 'Inactive')
 assert.equal(model.accounts.find(a => a.id === '7').activity, 'Active')
 assert.equal(model.accounts.find(a => a.id === '1').activitySource, '')
 assert.equal(model.accounts.find(a => a.id === '1').paidStatus, 'Unpaid')
 assert.equal(model.reconciliation, null)
})

test('authenticated reconciliation read is scoped to existing VE audit events and keeps unknown verification null', async () => {
 const seen = []
 const factory = () => ({
  schema() { return this },
  from(table) {
   const call = { table, filters: [] }; seen.push(call)
   const query = { select(columns) { call.columns = columns; return this }, eq(k, v) { call.filters.push([k, v]); return this }, order() { return this }, async range() { return { data: table === 'vhpms_activities' ? [event] : table === 'family_accounts' ? sources().familyAccounts.rows : [], error: null } } }
   return query
  },
 })
 const model = await fetchVeWorkspace({ token: 'test-only', env: { VITE_SUPABASE_URL: 'https://example.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-only' }, createClient: factory, today: '2026-11-14' })
 assert.deepEqual(seen.find(c => c.table === 'vhpms_activities')?.filters, [['business_id', 'VE'], ['event', 've_family_reconciliation_v1']])
 assert.equal(model.reconciliation?.as_of, '2026-11-14')
 assert.equal(model.reconciliationAccess, 'ok')
 assert.equal(model.accounts.find(a => a.id === '1').activity, 'Active')
 assert.equal(buildWorkspace(emptySources('blocked')).reconciliation, null)
})
