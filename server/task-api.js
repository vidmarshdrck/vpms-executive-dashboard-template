const fields=new Set(['title','project_external_id','category_id','owner_name','source_status','source_priority','due_at'])
const identifier=/^[a-zA-Z0-9_-]{1,128}$/
export class ApiError extends Error { constructor(status,code){super(code);this.status=status;this.code=code} }
export function validateTask(data,create=false) {
 if(!data||Array.isArray(data)||typeof data!=='object') throw new ApiError(400,'invalid_body')
 if(!Object.keys(data).length) throw new ApiError(400,'empty_update')
 for(const [key,value] of Object.entries(data)) {
  if(!fields.has(key)||!(value===null||typeof value==='string')) throw new ApiError(400,'invalid_field')
  if(typeof value==='string'&&value.length>(key==='title'?300:128)) throw new ApiError(400,'field_too_long')
 }
 if(create&&(!Object.hasOwn(data,'title')||!Object.hasOwn(data,'category_id'))) throw new ApiError(400,'title_and_category_required')
 if(Object.hasOwn(data,'title')&&(!data.title?.trim()||data.title.length>300)) throw new ApiError(400,'invalid_title')
 if(Object.hasOwn(data,'source_status')&&!['backlog','todo','in_progress','blocked','done','cancelled'].includes(data.source_status)) throw new ApiError(400,'invalid_status')
 if(data.source_priority!=null&&!['critical','high','medium','low'].includes(data.source_priority)) throw new ApiError(400,'invalid_priority')
 for(const key of ['project_external_id','category_id']) if(data[key]!=null&&!identifier.test(data[key])) throw new ApiError(400,'invalid_identifier')
 if(data.owner_name?.length>120) throw new ApiError(400,'field_too_long')
 if(data.due_at!=null&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(data.due_at)||!Number.isFinite(Date.parse(data.due_at)))) throw new ApiError(400,'explicit_due_timestamp_required')
 return data
}
async function readBody(req) {
 const chunks=[];let size=0
 for await(const chunk of req){size+=chunk.length;if(size>16384) throw new ApiError(413,'body_too_large');chunks.push(chunk)}
 const bytes=new Uint8Array(size);let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new ApiError(400,'invalid_json')}
}
function translate(error) {
 if(error instanceof ApiError) return error
 const text=error.message||''
 for(const [code,status] of Object.entries({forbidden:403,not_found:404,revision_conflict:409,idempotency_conflict:409,source_read_only:409})) if(text===code) return new ApiError(status,code)
 if(['23503','23514','22003','22007','22008'].includes(error.code)||/^invalid_|_required$|^empty_update$/.test(text)) return new ApiError(400,'invalid_command')
 return new ApiError(503,'prerequisites_or_storage_unavailable')
}
export function taskMatches(expected,actual) {
 return !!actual&&Object.entries(expected).every(([key,value])=>{
  if(key.endsWith('_at')&&value!==null) return Number.isFinite(Date.parse(value))&&Date.parse(value)===Date.parse(actual[key])
  return JSON.stringify(actual[key])===JSON.stringify(value)
 })
}
export function createTaskHandler({authenticate,store,channel}) {
 return async (req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body))}
  try {
   const actor=await authenticate(req.headers.authorization)
   if(!actor) throw new ApiError(401,'unauthorized')
   const url=new URL(req.url,'http://localhost')
   const route=url.pathname.match(/^\/api\/tasks(?:\/([a-zA-Z0-9_-]{1,128}))?$/)
   if(!route) throw new ApiError(404,'not_found')
   if(!['GET','POST','PATCH'].includes(req.method)) throw new ApiError(405,'method_not_allowed')
   const business=url.searchParams.get('business');const id=route[1]||null
   if(!identifier.test(business||'')) throw new ApiError(400,'business_required')
   if(req.method==='GET') {
    const rows=await store.read(actor,business,id)
    if(id&&!rows?.length) throw new ApiError(404,'not_found')
    return send(200,id?{task:rows[0]}:{tasks:rows,limit:100})
   }
   if((req.method==='POST'&&id)||(req.method==='PATCH'&&!id)) throw new ApiError(405,'method_not_allowed')
   if(!['bags-telegram','bags-mark'].includes(channel)) throw new ApiError(503,'channel_not_configured')
   const key=req.headers['idempotency-key']
   if(typeof key!=='string'||!/^[a-zA-Z0-9:_.-]{1,128}$/.test(key)) throw new ApiError(400,'idempotency_key_required')
   const revision=req.method==='PATCH'?Number(req.headers['if-match']):null
   if(req.method==='PATCH'&&(!Number.isSafeInteger(revision)||revision<1)) throw new ApiError(428,'revision_required')
   if(req.method==='PATCH'&&revision>=2147483647) throw new ApiError(400,'invalid_revision')
   const data=validateTask(await readBody(req),req.method==='POST')
   const result=await store.command(actor,{business,id,key,revision,data,operation:req.method==='POST'?'create':'update',channel})
   // A committed write is not a successful task until exact canonical readback.
   const rows=await store.read(actor,business,result.task.external_id)
   if(!taskMatches(result.task,rows?.[0])) throw new ApiError(409,'readback_conflict')
   send(req.method==='POST'&&!result.replayed?201:200,{...result,verified:true})
  } catch(error) {const safe=translate(error);send(safe.status,{error:safe.code})}
 }
}
