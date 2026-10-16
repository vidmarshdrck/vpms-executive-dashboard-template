import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createSupabaseStore} from './supabase-store.js'

test('Supabase adapter validates bearer via Auth, binds configured owner and uses separate service RPC',async()=>{
 const owner='00000000-0000-0000-0000-000000000001';const seen=[]
 const server=createServer(async(req,res)=>{
 let body='';for await(const chunk of req) body+=chunk
 seen.push({path:req.url,auth:req.headers.authorization,key:req.headers.apikey,body:body?JSON.parse(body):null})
 res.setHeader('content-type','application/json')
 if(req.url==='/auth/v1/user') {
  if(req.headers.authorization==='Bearer expired'){res.writeHead(401);return res.end('{"error":"expired"}')}
  return res.end(JSON.stringify({id:req.headers.authorization==='Bearer other'?'00000000-0000-0000-0000-000000000002':owner}))
 }
 if(req.url.startsWith('/rest/v1/vhpms_task_priorities')) return res.end('[]')
 if(req.url==='/rest/v1/rpc/vhpms_task_command') return res.end('{"task":{"external_id":"cmd-test"},"replayed":false}')
 res.writeHead(404);res.end('{"code":"PGRST202"}')
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try{
 const adapter=createSupabaseStore({url:`http://127.0.0.1:${server.address().port}`,publishableKey:'fixture-public',serviceKey:'fixture-service',ownerId:owner})
 assert.equal(await adapter.authenticate(),null)
 assert.equal(await adapter.authenticate('Bearer expired'),null)
 assert.equal(await adapter.authenticate('Bearer other'),null)
 const actor=await adapter.authenticate('Bearer valid')
 assert.equal(actor.id,owner)
 await adapter.store.read(actor,'BSG',null)
 assert.equal(seen.at(-1).auth,'Bearer valid');assert.equal(seen.at(-1).key,'fixture-public')
 await adapter.store.command(actor,{business:'BSG',operation:'create',id:null,key:'test',revision:null,data:{title:'Test',category_id:null},channel:'bags-mark'})
 assert.equal(seen.at(-1).auth,'Bearer fixture-service')
 assert.equal(seen.at(-1).body.p_actor,owner)
 assert.equal(seen.at(-1).body.p_channel,'bags-mark')
 }finally{await new Promise(r=>server.close(r))}
})
