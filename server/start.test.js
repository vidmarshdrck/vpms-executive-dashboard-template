import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {runtimeHandler} from './start.js'
test('missing or wrong production prerequisites fail closed with no datastore fallback',async()=>{
 for(const env of [{},{SUPABASE_URL:'https://wrong.supabase.co',VHPMS_OWNER_UUID:'invalid'}]) {
 const server=createServer(runtimeHandler(env));await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try {const response=await fetch(`http://127.0.0.1:${server.address().port}/api/tasks?business=BSG`,{headers:{authorization:'Bearer invalid'}});assert.equal(response.status,503);assert.equal((await response.json()).error,'prerequisites_missing')}
 finally{await new Promise(r=>server.close(r))}
 }
})
