import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
async function cli(input,env={}){
 const child=spawn(process.execPath,['clients/task-tool.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,...env},stdio:['pipe','pipe','pipe']})
 let output='';child.stdout.on('data',c=>output+=c);child.stdin.end(JSON.stringify(input))
 const code=await new Promise(r=>child.on('exit',r));return {code,result:JSON.parse(output)}
}
test('stdio tool fails closed without owner session and refuses unapproved actions',async()=>{
 assert.equal((await cli({action:'create',business:'BSG',data:{title:'Task',category_id:null},key:'turn-1'})).code,1)
 const bad=await cli({action:'delete',business:'BSG'},{VHPMS_TASK_API_URL:'http://127.0.0.1:1',VHPMS_OWNER_ACCESS_TOKEN:'fixture-only'})
 assert.equal(bad.code,1);assert.equal(bad.result.error,'action_not_allowed')
})
test('stdio tool executes actual HTTP create and GET verification',async()=>{
 const task={business_id:'BSG',external_id:'cmd-test',title:'Task',category_id:null,revision:1};const calls=[]
 const server=createServer(async(req,res)=>{for await(const chunk of req){void chunk} calls.push(req.method);res.setHeader('content-type','application/json');res.end(JSON.stringify(req.method==='GET'?{task}:{task,verified:true}))})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try{
 const result=await cli({action:'create',business:'BSG',data:{title:'Task',category_id:null},key:'turn-1'},{VHPMS_TASK_API_URL:`http://127.0.0.1:${server.address().port}`,VHPMS_OWNER_ACCESS_TOKEN:'fixture-only'})
 assert.equal(result.code,0);assert.equal(result.result.task.external_id,'cmd-test');assert.deepEqual(calls,['POST','GET'])
 }finally{await new Promise(r=>server.close(r))}
})
