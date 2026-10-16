import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createTaskHandler, taskMatches, validateTask } from './task-api.js'

test('validation rejects authority injection, ambiguous dates and invalid values',()=>{
 const good={title:'Keep source text',category_id:null,due_at:'2026-11-01T10:00:00+02:00'}
 assert.deepEqual(validateTask(good,true),good)
 for(const data of [null,[],{}, {title:'Missing category'}, {title:' ',category_id:null}, {...good,actor_id:'owner'}, {...good,channel:'bags-telegram'}, {...good,source_status:null}, {...good,source_priority:'urgent'}, {...good,due_at:'next Friday'}, {...good,project_external_id:'a/b'}, {...good,owner_name:'a'.repeat(121)}]) assert.throws(()=>validateTask(data,true))
})
import { createTaskClient } from '../clients/task-client.js'

test('readback compares timestamp instants, not transport formatting; rejects missing or changed fields',()=>{
 assert.equal(taskMatches({due_at:'2026-11-01T10:00:00+00:00',revision:1},{due_at:'2026-11-01T10:00:00.000Z',revision:1}),true)
 assert.equal(taskMatches({due_at:'bad'},{due_at:'bad'}),false)
 assert.equal(taskMatches({title:'Task',revision:1},{title:'Task',revision:2}),false)
 assert.equal(taskMatches({title:'Task'},null),false)
})
import { fixture } from './fixtures.js'

const owner='00000000-0000-0000-0000-000000000001'
test('authenticated HTTP create/read/update uses real PostgreSQL with readback and conflicts', async()=>{
 const db=await fixture()
 const store={
  async read(actor,business,id){
   const allowed=(await db.query('SELECT 1 FROM vhpms_memberships WHERE user_id=$1 AND business_id=$2',[actor.id,business])).rows.length
   if(!allowed) return id?null:[]
   return (await db.query('SELECT to_jsonb(t) AS task FROM vhpms_task_priorities t WHERE business_id=$1 AND ($2::text IS NULL OR external_id=$2) ORDER BY external_id LIMIT 100',[business,id])).rows.map(r=>r.task)
  },
  async command(actor,input){return (await db.query('SELECT vhpms_task_command($1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8) AS result',[actor.id,input.business,input.operation,input.id,input.key,input.revision,JSON.stringify(input.data),input.channel])).rows[0].result}
 }
 const server=createServer(createTaskHandler({authenticate:async h=>h==='Bearer test-only-owner'?{id:owner}:null,store,channel:'bags-mark'}))
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const base=`http://127.0.0.1:${server.address().port}/api/tasks`
 const headers={authorization:'Bearer test-only-owner','content-type':'application/json','idempotency-key':'http-1'}
 try {
 let response=await fetch(base+'?business=BSG',{method:'POST',headers,body:JSON.stringify({title:'HTTP task',category_id:'safety',due_at:'2026-11-01T10:00:00Z'})})
 assert.equal(response.status,201)
 const created=await response.json()
 assert.equal(created.verified,true)
 assert.equal(created.task.revision,1)
 assert.equal(created.task.effective_priority,'critical')
 const item=base+'/'+created.task.external_id+'?business=BSG'
 response=await fetch(item,{headers});assert.equal(response.status,200)
 assert.deepEqual((await response.json()).task,created.task)
 response=await fetch(item,{method:'PATCH',headers:{...headers,'idempotency-key':'http-2','if-match':'1'},body:JSON.stringify({title:'Changed'})})
 assert.equal(response.status,200);assert.equal((await response.json()).task.revision,2)
 response=await fetch(item,{method:'PATCH',headers:{...headers,'idempotency-key':'http-3','if-match':'1'},body:JSON.stringify({title:'Stale'})})
 assert.equal(response.status,409)
 response=await fetch(base+'?business=BSG',{method:'POST',headers:{...headers,'idempotency-key':'bad'},body:JSON.stringify({title:'Injection',category_id:'safety',sql:'DROP TABLE tasks'})})
 assert.equal(response.status,400)
 response=await fetch(base+'?business=VE',{method:'POST',headers,body:JSON.stringify({title:'No access',category_id:'safety'})})
 assert.equal(response.status,403)
 response=await fetch(item,{method:'DELETE',headers});assert.equal(response.status,405)
 const client=createTaskClient({baseUrl:base.replace('/api/tasks',''),accessToken:async()=> 'test-only-owner'})
 const clientResult=await client.create('BSG',{title:'Client integration',category_id:'safety'},'client-e2e')
 assert.equal(clientResult.verified,true)
 assert.equal(clientResult.task.business_id,'BSG')
 assert.equal((await db.query('SELECT * FROM vhpms_activities')).rows.length,3)
 } finally {await new Promise(r=>server.close(r));await db.close()}
})

test('unauthenticated requests cannot reach storage', async () => {
 const server=createServer(createTaskHandler({ authenticate:async()=>null, store:{command(){throw Error('storage reached')}} }))
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try { const response=await fetch(`http://127.0.0.1:${server.address().port}/api/tasks`,{method:'POST',body:'{}'}); assert.equal(response.status,401) }
 finally { await new Promise(r=>server.close(r)) }
})


test('JSON body preserves UTF-8 when a character crosses stream chunks',async()=>{
 const title='Résumé 🧳'
 const bytes=Buffer.from(JSON.stringify({title,category_id:null}))
 const boundary=bytes.indexOf(Buffer.from('é'))+1
 let saved
 const req={method:'POST',url:'/api/tasks?business=BSG',headers:{'idempotency-key':'utf8'},async *[Symbol.asyncIterator](){yield bytes.subarray(0,boundary);yield bytes.subarray(boundary)}}
 let result
 const res={writeHead(){},end(value){result=JSON.parse(value)}}
 const handler=createTaskHandler({authenticate:async()=>({id:owner}),channel:'bags-mark',store:{async command(actor,input){saved=input.data;return {task:{...saved,external_id:'cmd-test',business_id:'BSG',revision:1}}},async read(){return [{...saved,external_id:'cmd-test',business_id:'BSG',revision:1}]}}})
 await handler(req,res)
 assert.equal(saved.title,title)
 assert.equal(result.verified,true)
})
