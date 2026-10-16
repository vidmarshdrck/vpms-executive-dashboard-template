import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'
import {createSupabaseStore} from './supabase-store.js'
import {ApiError,createTaskHandler} from './task-api.js'
export function runtimeHandler(env) {
 const ready=env.SUPABASE_URL==='https://bbpfkjucsabdfcmusqzu.supabase.co'&&
  env.SUPABASE_PUBLISHABLE_KEY&&env.SUPABASE_SERVICE_KEY&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.VHPMS_OWNER_UUID||'')&&
  ['bags-telegram','bags-mark'].includes(env.VHPMS_COMMAND_CHANNEL)
 if(!ready) return createTaskHandler({authenticate:async()=>{throw new ApiError(503,'prerequisites_missing')}})
 const adapter=createSupabaseStore({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,serviceKey:env.SUPABASE_SERVICE_KEY,ownerId:env.VHPMS_OWNER_UUID})
 return createTaskHandler({...adapter,channel:env.VHPMS_COMMAND_CHANNEL})
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const port=Number(process.env.VHPMS_COMMAND_PORT||8096)
 if(!Number.isInteger(port)||port<1||port>65535) throw Error('invalid_port')
 const server=createServer({requestTimeout:15000,headersTimeout:10000},runtimeHandler(process.env))
 server.maxRequestsPerSocket=100
 server.listen(port,'127.0.0.1',()=>console.log(`VHPMS task API listening on loopback:${port}; configuration is not proof of live readiness`))
}
