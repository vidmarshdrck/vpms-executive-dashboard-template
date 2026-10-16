import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createTaskClient} from './task-client.js'
test('client sends narrow requests, reads canonical task back and never accepts queued as completion',async()=>{
 let task={business_id:'BSG',external_id:'cmd-1',title:'Task',category_id:null,revision:1};let queued=false;const calls=[]
 const server=createServer(async(req,res)=>{
 let body='';for await(const chunk of req)body+=chunk
 calls.push({method:req.method,url:req.url,headers:req.headers,body})
 res.setHeader('content-type','application/json')
 if(req.method==='GET')return res.end(JSON.stringify({task}))
 if(queued)return res.end(JSON.stringify({id:'queue-1',status:'queued'}))
 if(req.method==='PATCH')task={...task,...JSON.parse(body),revision:2}
 res.end(JSON.stringify({task,verified:true,replayed:false}))
 });await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try {
 const client=createTaskClient({baseUrl:`http://127.0.0.1:${server.address().port}`,accessToken:async()=> 'test-only-token'})
 const result=await client.create('BSG',{title:'Task',category_id:null},'turn-1')
 assert.equal(result.task.external_id,'cmd-1');assert.equal(calls.at(-1).method,'GET')
 assert.equal(calls[0].headers.authorization,'Bearer test-only-token');assert.equal(calls[0].headers['idempotency-key'],'turn-1')
 await client.update('BSG','cmd-1',{title:'Updated'},1,'turn-2')
 assert.equal(calls.at(-2).headers['if-match'],'1')
 queued=true
 await assert.rejects(client.create('BSG',{title:'Task',category_id:null},'turn-3'),/unverified_write/)
 await assert.rejects(client.create('BSG',{title:'Task',category_id:null,sql:'DROP'},'turn-4'),/invalid_field/)
 }finally{await new Promise(r=>server.close(r))}
})


test('write verification rejects unrelated task, wrong business, invalid revisions and mismatched intent',async()=>{
 let task
 const server=createServer(async(req,res)=>{for await(const chunk of req){void chunk}res.setHeader('content-type','application/json');res.end(JSON.stringify(req.method==='GET'?{task}:{task,verified:true}))})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try{
 const client=createTaskClient({baseUrl:`http://127.0.0.1:${server.address().port}`,accessToken:async()=> 'test-only'})
 const baseline={business_id:'BSG',external_id:'cmd-expected',title:'Wanted',category_id:null,revision:2}
 for(const change of [{business_id:'VE'},{external_id:'cmd-unrelated'},{revision:0},{revision:-1},{revision:3},{title:'Unrelated'}]){
 task={...baseline,...change}
 await assert.rejects(client.update('BSG','cmd-expected',{title:'Wanted'},1,'turn'),/unverified_write/)
 }
 await assert.rejects(async()=>client.read(undefined),/invalid_identifier/)
 await assert.rejects(client.update('BSG','cmd-expected',{title:'Wanted'},2147483648,'overflow'),/revision_required/)
 }finally{await new Promise(r=>server.close(r))}
})
