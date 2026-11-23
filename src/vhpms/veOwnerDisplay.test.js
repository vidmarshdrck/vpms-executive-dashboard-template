import test from 'node:test'
import assert from 'node:assert/strict'
import { VE_RECONCILIATION_DISPLAY } from './veReconciliationDisplay.js'
import { projectBudget } from './bankBudget.js'
import { buildWorkspace, emptySources } from './veData.js'
import { ownerDisplayFor } from './veOwnerDisplay.js'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const bundle = await build({stdin:{contents:"export {default as VeWorkspace} from './src/vhpms/VeWorkspace.jsx'; export {BusinessHome} from './src/vhpms/BusinessHome.jsx'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external',loader:{'.css':'empty'}})
const code = bundle.outputFiles[0].text.replace(/from "([^"]+)"/g, (_,n)=>`from "file://${require.resolve(n)}"`)
const { VeWorkspace, BusinessHome } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const render = model => renderToStaticMarkup(createElement(VeWorkspace,{business:{id:'ve',name:'Vidmar Entertainment (VE)'},model,today:'2026-11-16'}))
const active = [1,2,3,4,5,6,8,9,10,11,13,14,16,18]
const inactive = [7,12,15,17]
// Synthetic unit-test rows use only the approved public snapshot anchors; no customer data.
const family = VE_RECONCILIATION_DISPLAY.accounts.map(row => ({fid:row.fid,product:row.product,due_date:row.due_date_unchanged,paid_status:'Unpaid',slots_total:5,slots_taken:1,slot_1:'test-member'}))
function sources() { const s = emptySources('empty'); s.familyAccounts = {access:'ok',rows:structuredClone(family)}; return s }
test('owner display fallback gives exact14/4 with dated display provenance and unchanged upstream records', () => {
  const s = sources(), before = structuredClone(s), m = buildWorkspace(s, '2026-11-16')
  assert.deepEqual(m.activeAccounts.map(r => +r.id).sort((a,b)=>a-b), active)
  assert.deepEqual(m.inactiveAccounts.map(r => +r.id).sort((a,b)=>a-b), inactive)
  assert.equal(m.displaySnapshot.asOf, '2026-11-14')
  assert.ok(m.accounts.every(r => r.activitySource.includes('Display only')))
  assert.deepEqual(s, before)
  for (const r of family) {
    const a = m.accounts.find(a => +a.id === r.fid)
    assert.equal(a.dueDate, r.due_date || 'Not dated'); assert.equal(a.paidStatus, r.paid_status)
    assert.deepEqual(a.members.map(x => x.cid), [1,2,3,4,5].map(n=>r[`slot_${n}`]).filter(Boolean))
  }
  assert.equal(m.reconciliation, null)
})
test('complete workspace keeps the account list and leaves reconciliation prose off the page', () => {
  const html = render(buildWorkspace(sources(), '2026-11-16'))
  assert.match(html, /Family accounts/)
  for (const text of ['Monthly provider reconciliation','Owner-confirmed snapshot','Display only','56 expected cycles','Activity evidence','Date-derived','Source: owner instruction','actual Boaz','FID 6']) assert.equal(html.includes(text), false, text)
})

test('malformed same-date operational evidence cannot suppress the honest display fallback', () => {
  const s = sources()
  s.reconciliation = {access:'ok',rows:[{id:'malformed',business_id:'VE',event:'ve_family_reconciliation_v1',created_at:'2026-11-16',after_value:{version:1,as_of:'2026-11-14',accounts:{length:18},cycles:null}}]}
  const m = buildWorkspace(s, '2026-11-16')
  assert.equal(m.displaySnapshot?.asOf, '2026-11-14')
  assert.equal(m.activeAccounts.length,14)
  const html = render(m)
  assert.equal(html.includes('Reconciliation unavailable'), false)
  assert.equal(html.includes('Display only'), false)
  assert.equal(html.includes('Boaz supplement consumed'), false)
  assert.match(html, /Family accounts/)
})
test('snapshot is absent for denied, signed-out, empty, partial, duplicate and malformed family reads', () => {
  for (const access of ['signed-out','blocked','unconfigured','error','empty']) {
    const s = sources(); s.familyAccounts.access = access
    assert.equal(ownerDisplayFor(s,null),null)
    assert.equal(render(buildWorkspace(s)).includes('56 expected cycles'),false)
  }
  for (const rows of [[],family.slice(0,17),[...family.slice(0,17),family[0]],{length:18},null]) {
    const s = sources(); s.familyAccounts.rows = rows
    assert.equal(ownerDisplayFor(s,null),null)
  }
})
test('same-date and newer complete operational evidence is not overwritten by display configuration', () => {
  // Complete nonfinancial TEST-ONLY event proves precedence, not real finance evidence.
  const accounts = VE_RECONCILIATION_DISPLAY.accounts.map(a => ({...a,expected_cycle_count:a.expected_cycle_dates.length}))
  const cycles = accounts.flatMap(a => a.expected_cycle_dates.map(date => ({fid:a.fid,expected_date:date,cycle_key:`${a.fid}:${date}`,ledger_candidate_expense_ids:[],unallocated_bank_candidate_handles:[]})))
  const data = {version:1,as_of:'2026-11-14',accounts,cycles,confirmed_activity:Object.fromEntries([...active.map(id=>[id,'Active']),...inactive.map(id=>[id,'Inactive'])]),preserved_activity:{},summary:{active_fids:14,expected_cycles:56,cycles_with_candidate_evidence:0,unreconciled_cycles:56,cycles_with_verified_payment:0}}
  assert.equal(ownerDisplayFor(sources(),data),null)
  data.as_of = '2026-11-15'
  assert.equal(ownerDisplayFor(sources(),data),null)
})
test('other-business routing never renders VE display configuration', () => {
  for (const id of ['vai','rez','bsg','vt','eunique','digital']) {
    const html = renderToStaticMarkup(createElement(BusinessHome,{books:{businesses:[{id,name:'Test business'}]},businessId:id}))
    assert.equal(html.includes('Owner-confirmed snapshot'),false)
    assert.equal(html.includes('56 expected cycles'),false)
  }
})
test('display fallback preserves source-date provider projection and recorded finance', () => {
  const after = buildWorkspace(sources(),'2026-11-16')
  const sourceActive = family.filter(row => row.due_date && row.due_date >= '2026-11-16').map(row => ({plan:row.product}))
  assert.deepEqual(after.budget,projectBudget({activeAccounts:sourceActive,transactions:[]}))
  assert.deepEqual(after.overview.finance,{income:0,expenses:0,balance:0,profit:0})
  assert.deepEqual(after.income,[])
  assert.deepEqual(after.expenses,[])
  assert.deepEqual(after.bankTransactions,[])
})
