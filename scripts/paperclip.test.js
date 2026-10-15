import test from 'node:test'
import assert from 'node:assert/strict'
import { projectSnapshot, readbackMatches } from './paperclip.js'
test('readback compares timestamp instants but not changed statuses',()=>{
 assert.equal(readbackMatches({synced_at:'2026-10-15T00:00:00Z',source_status:'blocked'},{synced_at:'2026-10-15T00:00:00+00:00',source_status:'blocked'}),true)
 assert.equal(readbackMatches({source_status:'blocked'},{source_status:'done'}),false)
})
test('projects only explicitly bound source records; preserves status, omits descriptions and adapter credentials',()=>{
 const data=projectSnapshot({projects:[{id:'p',name:'Paper study',status:'planned'}],issues:[{id:'t',projectId:'p',title:'Risk gate',status:'in_progress',priority:'high',description:'private',executionRunId:null},{id:'private',projectId:'unknown',title:'Private'}],agents:[]}, {p:'BSG'},'2026-10-15T00:00:00Z')
 assert.equal(data.tasks.length,1)
 assert.equal(data.tasks[0].source_status,'in_progress')
 assert.equal(data.tasks[0].external_id,'t')
 assert.equal(data.tasks[0].category_id,undefined)
 assert.equal(data.tasks[0].description,undefined)
 assert.equal(data.projects[0].business_id,'BSG')
 assert.equal(JSON.stringify(data).includes('executing'),false)
})
