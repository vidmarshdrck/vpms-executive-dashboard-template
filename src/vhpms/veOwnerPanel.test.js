import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const bundle=await build({stdin:{contents:"export {default as VeWorkspace} from './src/vhpms/VeWorkspace.jsx'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external',loader:{'.css':'empty'}})
const code=bundle.outputFiles[0].text.replace(/from "([^"]+)"/g,(_,n)=>`from "file://${require.resolve(n)}"`)
const {VeWorkspace}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
import {buildWorkspace,emptySources} from './veData.js'

test('historical version1 without supplement never claims current Boaz consumption or continuity',()=>{
  const s=emptySources('empty')
  s.reconciliation={access:'ok',rows:[{id:'historical',business_id:'VE',event:'ve_family_reconciliation_v1',created_at:'2026-11-14T09:00:00Z',after_value:{version:1,as_of:'2026-11-14',confirmed_activity:{1:'Active'},accounts:[],cycles:[],summary:{expected_cycles:56}}}]}
  const html=renderToStaticMarkup(createElement(VeWorkspace,{business:{id:'ve',name:'Vidmar Entertainment (VE)'},model:buildWorkspace(s),today:'2026-11-14'}))
  for(const claim of ['Boaz supplement consumed','201 exact-TID candidates','181 amount-concordant','20 amount mismatches','67 current links','64 active','Original eleven continuously active from stored anchors: owner-confirmed','Finance evidence reviewed by actual Boaz','Both MTN and Airtel CSV exports found','Supplement absent or stale','Continuity confirmation absent or stale']) assert.equal(html.includes(claim),false,`historical event falsely claims: ${claim}`)
  assert.match(html, /No family account rows were returned/)
})
test('incomplete unattested event renders unavailable rather than unvalidated detail or counts',()=>{const s=emptySources('empty');s.reconciliation={access:'ok',rows:[{id:'test',business_id:'VE',event:'ve_family_reconciliation_v1',created_at:'2026-11-14',after_value:{version:1,as_of:'2026-11-14',accounts:[],cycles:[],summary:{expected_cycles:56,cycles_with_candidate_evidence:22,unreconciled_cycles:56},finance_supplement:{summary:{},customer_cash_links:[{key:'literal-test-tid',provider:'Airtel',orders:[{oid:'test-order',cid:'test-cid',product:'Spotify'}],current_slots:[{cid:'test-cid',fid:18,slot:2}],verified:false,historical_connection_proven:false}]}}}]};const html=renderToStaticMarkup(createElement(VeWorkspace,{business:{id:'ve',name:'Vidmar Entertainment (VE)'},model:buildWorkspace(s),today:'2026-11-14'}));assert.equal(html.includes('Reconciliation unavailable'),false);for(const text of ['56 expected cycles','literal-test-tid','test-order','test-cid','Activity evidence'])assert.equal(html.includes(text),false,`unvalidated ${text}`)})
