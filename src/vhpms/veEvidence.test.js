import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {build} from 'esbuild'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const bundle=await build({stdin:{contents:"export {ProviderReconciliation} from './src/vhpms/VeWorkspace.jsx'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external',loader:{'.css':'empty'}})
const code=bundle.outputFiles[0].text.replace(/from "([^"]+)"/g,(_,n)=>`from "file://${require.resolve(n)}"`)
const {ProviderReconciliation}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const D='/home/shadrickvidmar/paperclip-handoffs/ve-reconciliation-20261114'
const payload=JSON.parse(fs.readFileSync(D+'/ve-update-proposed-event.json')).after_value
function render(data){const before=JSON.stringify(data);const html=renderToStaticMarkup(createElement(ProviderReconciliation,{model:{reconciliation:data}}));assert.equal(JSON.stringify(data),before);return html}
const cases={
  'actual Bags malformed 397 rows':p=>{p.finance_supplement.customer_cash_links=p.finance_supplement.customer_cash_links.map(()=>({verified:false,historical_connection_proven:false}))},
  'actual Bags non-array links':p=>{p.finance_supplement.customer_cash_links={length:397}},
  'null detail':p=>{p.finance_supplement.customer_cash_links[0]=null},
  'non-array orders':p=>{p.finance_supplement.customer_cash_links[0].orders={length:0}},
  'malformed order':p=>{p.finance_supplement.customer_cash_links.find(x=>x.orders.length).orders[0]={}},
  'non-array slots':p=>{p.finance_supplement.customer_cash_links[0].current_slots={}},
  'malformed slot':p=>{p.finance_supplement.customer_cash_links.find(x=>x.current_slots.length).current_slots[0]={}},
  'duplicate evidence identity':p=>{p.finance_supplement.customer_cash_links[1].key=p.finance_supplement.customer_cash_links[0].key},
  'inconsistent summary':p=>{p.finance_supplement.summary.groups_matching_exact_order_tid=999},
  'shape-valid but unattested detail':p=>{p.finance_supplement.customer_cash_links[0].key='unattested:replacement'},
  'missing supplement':p=>{delete p.finance_supplement},
  'wrong declared hash':p=>{p.finance_supplement.sha256='stale'},
  'non-array accounts':p=>{p.accounts={length:18}},
  'non-array cycles':p=>{p.cycles={length:56}},
  'null account':p=>{p.accounts[0]=null},
  'null cycle':p=>{p.cycles[0]=null},
  'non-string expected date':p=>{p.cycles[0].expected_date={}},
  'non-array cycle candidates':p=>{p.cycles[0].ledger_candidate_expense_ids={}},
  'inconsistent cycle summary':p=>{p.summary.cycles_with_candidate_evidence=999},
  'malformed as-of date':p=>{p.as_of={}},
  'inconsistent active summary':p=>{p.summary.active_fids=999},
  'malformed activity collection':p=>{p.confirmed_activity=[]},
  'malformed membership collection':p=>{p.finance_supplement.current_slot_memberships={}},
  'stale date':p=>{p.as_of='2026-11-13'},
}
for(const [name,mutate]of Object.entries(cases))test(name+' fails closed without counts, consumption or owner continuity',()=>{const p=structuredClone(payload);mutate(p);const html=render(p);for(const claim of ['Boaz supplement consumed','201 exact-TID candidates','181 amount-concordant','Original eleven continuously active from stored anchors: owner-confirmed'])assert.equal(html.includes(claim),false,claim);assert.match(html,/unavailable|absent or stale/i)})
test('actual valid projection retains qualified finance and original eleven continuity',()=>{const html=render(structuredClone(payload));for(const claim of ['14 owner-confirmed active','4 owner-confirmed inactive','56 expected cycles','Boaz supplement consumed','201 exact-TID candidates','181 amount-concordant','20 amount mismatches','67 current links','64 active','Original eleven continuously active from stored anchors: owner-confirmed','Actual paid count: Unknown','Historical allocation: unproven'])assert.ok(html.includes(claim),claim)})
