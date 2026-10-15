import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePriority, isStale } from './live.js'
test('manual priority overrides need an actor and reason; staleness never treats unknown as current',()=>{
 const task={source_priority:'high',override_priority:'low',override_reason:'Owner reviewed',override_by:'owner'}
 assert.equal(resolvePriority(task,[]).priority,'low')
 assert.equal(resolvePriority({...task,override_by:null},[]).priority,'high')
 assert.equal(isStale(null,Date.parse('2026-10-15T01:00:00Z')),true)
 assert.equal(isStale('2026-10-15T00:59:00Z',Date.parse('2026-10-15T01:00:00Z')),false)
 assert.equal(isStale('2026-10-14T00:59:00Z',Date.parse('2026-10-15T01:00:00Z')),true)
})
test('uses only approved exact business/category rules, never task owner weights', () => {
 const task={business_id:'bsg',category_id:'safety',source_priority:'high',owner:'Boaz'}
 const rules=[{business_id:'bsg',category_id:'safety',priority:'critical',approved_by:'owner',rationale:'Paper risk gate',id:'rule-1'}]
 assert.deepEqual(resolvePriority(task,rules),{priority:'critical',source:'business/category',rationale:'Paper risk gate',ruleId:'rule-1'})
 assert.equal(resolvePriority({...task,owner:'Nathan'},rules).priority,'critical')
 assert.equal(resolvePriority({...task,business_id:'ve'},rules).source,'source')
 assert.equal(resolvePriority(task,[{...rules[0],approved_by:null}]).priority,'high')
})
