import test from 'node:test'
import assert from 'node:assert/strict'
import {buildWorkspace,emptySources} from './veData.js'
import {validReconciliation} from './veEvidence.js'
import {VE_RECONCILIATION_DISPLAY as display} from './veReconciliationDisplay.js'
function sources(){
 const s=emptySources('empty')
 s.familyAccounts={access:'ok',rows:display.accounts.map(a=>({fid:a.fid,product:a.product,due_date:a.due_date_unchanged,paid_status:'Unpaid'}))}
 s.bankTransactions={access:'ok',rows:[...new Set(display.accounts.map(a=>a.product))].map((plan,i)=>({id:i+1,txn_date:'2026-11-01',description:plan,amount:-100,category:'ve_provider_subscription'}))}
 return s
}
const payload={version:1,as_of:'2026-11-14',confirmed_activity:Object.fromEntries(display.accounts.map(a=>[a.fid,'Active'])),accounts:{length:18},cycles:null}
function attach(s){s.reconciliation={access:'ok',rows:[{business_id:'VE',event:'ve_family_reconciliation_v1',created_at:'2026-11-16',after_value:payload}]};return s}
test('malformed reconciliation cannot rewrite source-date finance projection',()=>{
 const baseline=buildWorkspace(sources(),'2026-11-16')
 const malformed=buildWorkspace(attach(sources()),'2026-11-16')
 assert.equal(validReconciliation(payload),false)
 assert.deepEqual(malformed.budget,baseline.budget)
 assert.deepEqual(malformed.bankTransactions,baseline.bankTransactions)
})
test('partial family read cannot apply owner confirmation from invalid evidence',()=>{
 const partial=sources();partial.familyAccounts.rows=partial.familyAccounts.rows.slice(0,1)
 const model=buildWorkspace(attach(partial),'2026-11-16')
 assert.equal(model.displaySnapshot,null)
 assert.equal(model.accounts[0].activity,'Inactive')
 assert.equal(model.accounts[0].activitySource.includes('Owner-confirmed'),false)
})
