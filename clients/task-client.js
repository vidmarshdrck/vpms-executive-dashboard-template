import {validateTask,taskMatches} from '../server/task-api.js'
export function createTaskClient({baseUrl,accessToken}) {
 const url=new URL(baseUrl)
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))) throw Error('https_required')
 if(url.username||url.password||url.search||url.hash) throw Error('invalid_base_url')
 const identifier=/^[a-zA-Z0-9_-]{1,128}$/
 function path(business,id) {
  if(typeof business!=='string'||!identifier.test(business)||id!=null&&(typeof id!=='string'||!identifier.test(id)))throw Error('invalid_identifier')
  return '/api/tasks'+(id?'/'+id:'')+'?business='+encodeURIComponent(business)
 }
 async function request(method,path,data,headers={}) {
  const token=await accessToken()
  if(!token) throw Error('owner_session_required')
  const response=await fetch(baseUrl.replace(/\/$/,'')+path,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...headers},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)})
  const result=await response.json()
  if(!response.ok){const error=new Error(result.error||'request_failed');error.status=response.status;throw error}
  return result
 }
 async function write(method,business,id,data,revision,key) {
  validateTask(data,method==='POST')
  if(typeof key!=='string'||!/^[a-zA-Z0-9:_.-]{1,128}$/.test(key)) throw Error('idempotency_key_required')
  if(method==='PATCH'&&(!Number.isSafeInteger(revision)||revision<1||revision>=2147483647))throw Error('revision_required')
  const result=await request(method,path(business,id),data,{'idempotency-key':key,...(revision?{'if-match':String(revision)}:{})})
  if(result.verified!==true||typeof result.task?.external_id!=='string'||!identifier.test(result.task.external_id)||result.task.business_id!==business||!Number.isSafeInteger(result.task.revision)||result.task.revision<1||result.task.revision!==(method==='POST'?1:revision+1)||(method==='PATCH'&&result.task.external_id!==id)||!taskMatches(data,result.task))throw Error('unverified_write')
  const readback=await request('GET',path(business,result.task.external_id))
  if(!taskMatches(result.task,readback.task))throw Error('readback_conflict')
  return {...result,verified:true}
 }
 return {
  read:(business,id=null)=>request('GET',path(business,id)),
  create:(business,data,key)=>write('POST',business,null,data,null,key),
  update:(business,id,data,revision,key)=>write('PATCH',business,id,data,revision,key)
 }
}
