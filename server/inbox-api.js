// VHPMS Inbox API. Decisions are RECORDED ONLY: this module never executes sends, deploys, deletes, trades or payments.
import {createHash,timingSafeEqual} from 'node:crypto'
import {ApiError,readBody} from './task-api.js'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ident=/^[a-zA-Z0-9_-]{1,128}$/
export const KINDS=['approval','decision','task'],ACTIONS=['send','deploy','delete','trade','payment','other'],STATUSES=['pending','approved','rejected','done','cancelled'],LINKS=['project','task','activity','url']
// VHPMS_AGENT_TOKENS="boaz:<sha256 hex of token>,bags:<sha256 hex>" — only hashes live in env.
export function parseAgentTokens(spec='') {
 const out=[]
 for(const part of String(spec).split(',').map(s=>s.trim()).filter(Boolean)) {
  const [agent,hash]=part.split(':')
  if(/^[a-z][a-z0-9_-]{1,63}$/.test(agent||'')&&/^[0-9a-f]{64}$/.test(hash||'')) out.push({agent,hash:Buffer.from(hash,'hex')})
 }
 return out
}
export function authenticateAgent(tokens,header) {
 if(!/^Bearer [^\s]{16,512}$/.test(header||'')) return null
 const digest=createHash('sha256').update(header.slice(7)).digest()
 let found=null
 for(const t of tokens) if(timingSafeEqual(t.hash,digest)) found=t.agent
 return found
}
export function validateItem(d) {
 if(!d||typeof d!=='object'||Array.isArray(d)) throw new ApiError(400,'invalid_body')
 const allowed=new Set(['business_id','kind','action','title','summary','payload','link_type','link_ref'])
 for(const k of Object.keys(d)) if(!allowed.has(k)) throw new ApiError(400,'invalid_field')
 if(!ident.test(d.business_id||'')) throw new ApiError(400,'business_required')
 if(!KINDS.includes(d.kind)) throw new ApiError(400,'invalid_kind')
 if(d.action!=null&&!ACTIONS.includes(d.action)) throw new ApiError(400,'invalid_action')
 if(d.kind==='approval'&&!d.action) throw new ApiError(400,'action_required')
 if(typeof d.title!=='string'||!d.title.trim()||d.title.length>200) throw new ApiError(400,'invalid_title')
 if(d.summary!=null&&(typeof d.summary!=='string'||d.summary.length>4000)) throw new ApiError(400,'invalid_summary')
 if(d.payload!=null&&(typeof d.payload!=='object'||Array.isArray(d.payload)||JSON.stringify(d.payload).length>16000)) throw new ApiError(400,'invalid_payload')
 if(d.link_type!=null&&!LINKS.includes(d.link_type)) throw new ApiError(400,'invalid_link')
 if(d.link_ref!=null&&(typeof d.link_ref!=='string'||d.link_ref.length>500)) throw new ApiError(400,'invalid_link')
 if(d.link_type==='url'&&!/^https:\/\//.test(d.link_ref||'')) throw new ApiError(400,'invalid_link')
 return d
}
function translate(e) {
 if(e instanceof ApiError) return e
 const m=e.message||''
 const map={forbidden:403,not_found:404,not_pending:409,revision_conflict:409,note_required:400,invalid_comment:400,invalid_decision:400}
 if(map[m]) return new ApiError(map[m],m)
 if(['23503','23514','22P02'].includes(e.code)) return new ApiError(400,'invalid_command')
 return new ApiError(503,'prerequisites_or_storage_unavailable')
}
export function createInboxHandler({authenticate,authenticateAgent:agentAuth=()=>null,store}) {
 return async (req,res)=>{
  const send=(s,b)=>{res.writeHead(s,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(b))}
  try {
   const url=new URL(req.url,'http://localhost')
   const m=url.pathname.match(/^\/api\/inbox(?:\/([^/]+)\/(decision|comment))?$/)
   if(!m) throw new ApiError(404,'not_found')
   const [,id,sub]=m
   if(id&&!uuid.test(id)) throw new ApiError(404,'not_found')
   if(!id&&req.method==='POST') { // agent creation
    const agent=agentAuth(req.headers.authorization)
    if(!agent) throw new ApiError(401,'unauthorized')
    const key=req.headers['idempotency-key']
    if(typeof key!=='string'||!/^[a-zA-Z0-9:_.-]{1,128}$/.test(key)) throw new ApiError(400,'idempotency_key_required')
    const r=await store.create(agent,key,validateItem(await readBody(req)))
    return send(r.replayed?200:201,r)
   }
   const actor=await authenticate(req.headers.authorization)
   if(!actor) throw new ApiError(401,'unauthorized')
   if(!id) {
    if(req.method!=='GET') throw new ApiError(405,'method_not_allowed')
    const f={}
    for(const [k,list] of [['kind',KINDS],['status',STATUSES]]) {const v=url.searchParams.get(k);if(v){if(!list.includes(v)) throw new ApiError(400,`invalid_${k}`);f[k]=v}}
    const agent=url.searchParams.get('agent');if(agent){if(!/^[a-z][a-z0-9_-]{1,63}$/.test(agent)) throw new ApiError(400,'invalid_agent');f.agent=agent}
    const business=url.searchParams.get('business');if(business){if(!ident.test(business)) throw new ApiError(400,'invalid_business');f.business=business}
    const items=await store.list(actor,f)
    return send(200,{items,unread:items.filter(i=>i.status==='pending'&&!i.read_at).length,limit:200})
   }
   if(req.method!=='POST') throw new ApiError(405,'method_not_allowed')
   const body=await readBody(req)
   if(sub==='decision') {
    const decision={approve:'approved',reject:'rejected'}[body?.decision]
    if(!decision) throw new ApiError(400,'invalid_decision')
    const note=typeof body.note==='string'?body.note.trim():''
    if(body.note!=null&&typeof body.note!=='string'||note.length>4000) throw new ApiError(400,'invalid_note')
    if(decision==='rejected'&&!note) throw new ApiError(400,'note_required')
    const rev=body.revision==null?null:Number(body.revision)
    if(rev!==null&&(!Number.isSafeInteger(rev)||rev<1)) throw new ApiError(400,'invalid_revision')
    return send(200,{...await store.decide(actor,id,decision,note||null,rev),executed:false})
   }
   const text=typeof body?.body==='string'?body.body.trim():''
   if(!text||text.length>4000) throw new ApiError(400,'invalid_comment')
   send(201,await store.comment(actor,id,text))
  } catch(e) {const s=translate(e);send(s.status,{error:s.code})}
 }
}
export function createInboxStore({url,publishableKey,serviceKey}) {
 async function request(path,token,key,body) {
  const r=await fetch(url+path,{method:body?'POST':'GET',headers:{apikey:key,authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)})
  const data=await r.json()
  if(!r.ok){const e=new Error(data.message||'supabase_unavailable');e.code=data.code;throw e}
  return data
 }
 const rpc=(fn,args)=>request('/rest/v1/rpc/'+fn,serviceKey,serviceKey,args)
 return {
  list(actor,f) { // owner token + publishable key: RLS applies
   const q=new URLSearchParams({select:'*',order:'created_at.desc',limit:'200'})
   if(f.kind) q.set('kind',`eq.${f.kind}`); if(f.status) q.set('status',`eq.${f.status}`)
   if(f.agent) q.set('requested_by_agent',`eq.${f.agent}`); if(f.business) q.set('business_id',`eq.${f.business}`)
   return request('/rest/v1/vhpms_inbox_items?'+q,actor.token,publishableKey)
  },
  create:(agent,key,data)=>rpc('vhpms_inbox_create',{p_agent:agent,p_key:key,p_data:data}),
  decide:(actor,id,decision,note,rev)=>rpc('vhpms_inbox_decide',{p_actor:actor.id,p_item:id,p_decision:decision,p_note:note,p_revision:rev}),
  comment:(actor,id,body)=>rpc('vhpms_inbox_comment',{p_actor:actor.id,p_item:id,p_body:body}),
 }
}
