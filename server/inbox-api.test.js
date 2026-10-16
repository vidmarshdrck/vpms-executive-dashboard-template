import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createInboxHandler,parseAgentTokens,authenticateAgent} from './inbox-api.js'
const ID='11111111-1111-4111-8111-111111111111', TOKEN='agent-secret-token-boaz-123'
const tokens=parseAgentTokens(`boaz:${createHash('sha256').update(TOKEN).digest('hex')},bad:xyz`)
function call(handler,{method='GET',path,auth,body,headers={}}) {
  return new Promise(resolve=>{
    const chunks=body?[Buffer.from(JSON.stringify(body))]:[]
    const req={method,url:path,headers:{authorization:auth,...headers},async *[Symbol.asyncIterator](){yield* chunks}}
    const res={writeHead(s){this.s=s},end(b){resolve({status:this.s,body:JSON.parse(b)})}}
    handler(req,res)
  })
}
function setup() {
  const calls=[]
  const store={list:async(a,f)=>{calls.push(['list',f]);return [{status:'pending',read_at:null},{status:'approved'}]},
    create:async(agent,key,data)=>{calls.push(['create',agent,key,data]);return {item:{id:ID},replayed:key==='dup'}},
    decide:async(...a)=>{calls.push(['decide',...a.slice(1)]);return {item:{id:ID,status:a[2]}}},
    comment:async(...a)=>{calls.push(['comment',...a.slice(1)]);return {event:{}}}}
  const h=createInboxHandler({authenticate:async h=>h==='Bearer owner'?{id:'o',token:'owner'}:null,authenticateAgent:h=>authenticateAgent(tokens,h),store})
  return {h,calls}
}
test('agent token parsing and timing-safe auth', ()=>{
  assert.equal(tokens.length,1)
  assert.equal(authenticateAgent(tokens,`Bearer ${TOKEN}`),'boaz')
  assert.equal(authenticateAgent(tokens,'Bearer wrong-token-wrong-token'),null)
})
test('GET requires owner and validates filters', async()=>{
  const {h,calls}=setup()
  assert.equal((await call(h,{path:'/api/inbox'})).status,401)
  assert.equal((await call(h,{path:'/api/inbox',auth:`Bearer ${TOKEN}`})).status,401)
  assert.equal((await call(h,{path:'/api/inbox?kind=bogus',auth:'Bearer owner'})).status,400)
  const r=await call(h,{path:'/api/inbox?kind=approval&status=pending&agent=boaz',auth:'Bearer owner'})
  assert.equal(r.status,200); assert.equal(r.body.unread,1)
  assert.deepEqual(calls[0][1],{kind:'approval',status:'pending',agent:'boaz'})
})
test('agent POST create: token + idempotency key + validation', async()=>{
  const {h,calls}=setup(); const body={business_id:'BSG',kind:'approval',action:'trade',title:'Demo trade'}
  assert.equal((await call(h,{method:'POST',path:'/api/inbox',auth:'Bearer owner',body,headers:{'idempotency-key':'k'}})).status,401)
  assert.equal((await call(h,{method:'POST',path:'/api/inbox',auth:`Bearer ${TOKEN}`,body})).status,400)
  assert.equal((await call(h,{method:'POST',path:'/api/inbox',auth:`Bearer ${TOKEN}`,body:{...body,action:null},headers:{'idempotency-key':'k'}})).body.error,'action_required')
  assert.equal((await call(h,{method:'POST',path:'/api/inbox',auth:`Bearer ${TOKEN}`,body:{...body,link_type:'url',link_ref:'javascript:x'},headers:{'idempotency-key':'k'}})).body.error,'invalid_link')
  assert.equal((await call(h,{method:'POST',path:'/api/inbox',auth:`Bearer ${TOKEN}`,body,headers:{'idempotency-key':'k1'}})).status,201)
  assert.equal((await call(h,{method:'POST',path:'/api/inbox',auth:`Bearer ${TOKEN}`,body,headers:{'idempotency-key':'dup'}})).status,200)
  assert.equal(calls[0][1],'boaz')
})
test('decision: owner only, reject needs note, never executes', async()=>{
  const {h,calls}=setup(); const p=`/api/inbox/${ID}/decision`
  assert.equal((await call(h,{method:'POST',path:p,auth:`Bearer ${TOKEN}`,body:{decision:'approve'}})).status,401)
  assert.equal((await call(h,{method:'POST',path:p,auth:'Bearer owner',body:{decision:'reject',note:'  '}})).body.error,'note_required')
  assert.equal((await call(h,{method:'POST',path:p,auth:'Bearer owner',body:{decision:'execute'}})).status,400)
  const r=await call(h,{method:'POST',path:p,auth:'Bearer owner',body:{decision:'reject',note:'too risky',revision:1}})
  assert.equal(r.status,200); assert.equal(r.body.executed,false)
  assert.deepEqual(calls[0],['decide',ID,'rejected','too risky',1])
  assert.equal((await call(h,{method:'POST',path:'/api/inbox/not-a-uuid/decision',auth:'Bearer owner',body:{decision:'approve'}})).status,404)
})
test('comment requires body; store errors are mapped', async()=>{
  const {h}=setup(); const p=`/api/inbox/${ID}/comment`
  assert.equal((await call(h,{method:'POST',path:p,auth:'Bearer owner',body:{body:''}})).status,400)
  assert.equal((await call(h,{method:'POST',path:p,auth:'Bearer owner',body:{body:'ok'}})).status,201)
  const h2=createInboxHandler({authenticate:async()=>({id:'o'}),store:{decide:async()=>{throw new Error('not_pending')}}})
  assert.equal((await call(h2,{method:'POST',path:`/api/inbox/${ID}/decision`,auth:'x',body:{decision:'approve'}})).status,409)
})
