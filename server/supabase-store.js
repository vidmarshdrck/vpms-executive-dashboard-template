import {ApiError} from './task-api.js'
export function createSupabaseStore({url,publishableKey,serviceKey,ownerId}) {
 async function request(path,token,key,body) {
  const response=await fetch(url+path,{method:body?'POST':'GET',headers:{apikey:key,authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)})
  const data=await response.json()
  if(!response.ok) {const error=new Error(data.message||'supabase_unavailable');error.code=data.code;error.httpStatus=response.status;throw error}
  return data
 }
 return {
  async authenticate(header) {
   if(!ownerId||!/^Bearer [^\s]{1,8192}$/.test(header||'')) return null
   const token=header.slice(7)
   try {
    const user=await request('/auth/v1/user',token,publishableKey)
    return user.id===ownerId?{id:user.id,token}:null
   } catch(error) {if([400,401,403].includes(error.httpStatus))return null;throw new ApiError(503,'auth_unavailable')}
  },
  store:{
   async read(actor,business,id) {
    const query=new URLSearchParams({select:'*',business_id:`eq.${business}`,order:'external_id.asc',limit:'100'})
    if(id) query.set('external_id',`eq.${id}`)
    return request('/rest/v1/vhpms_task_priorities?'+query,actor.token,publishableKey)
   },
   async command(actor,input) {
    return request('/rest/v1/rpc/vhpms_task_command',serviceKey,serviceKey,{
     p_actor:actor.id,p_business:input.business,p_operation:input.operation,p_task_id:input.id,
     p_key:input.key,p_revision:input.revision,p_data:input.data,p_channel:input.channel
    })
   }
  }
 }
}
