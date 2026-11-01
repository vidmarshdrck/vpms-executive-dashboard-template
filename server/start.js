import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'
import {createSupabaseStore} from './supabase-store.js'
import {ApiError,createTaskHandler} from './task-api.js'
import {createBsgHandler,createBsgReader} from './bsg-read.js'
import {createBsgPlHandler,createBsgPlRpc} from './bsg-pl.js'
import {createFinancesHandler,createFinanceRpc} from './finances.js'
import {bsgPlConfig} from '../src/vhpms/bsg/plConfig.js'
export function runtimeHandler(env) {
 const ready=env.SUPABASE_URL==='https://bbpfkjucsabdfcmusqzu.supabase.co'&&
  env.SUPABASE_PUBLISHABLE_KEY&&env.SUPABASE_SERVICE_KEY&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.VHPMS_OWNER_UUID||'')&&
  ['bags-telegram','bags-mark'].includes(env.VHPMS_COMMAND_CHANNEL)
 const unavailable=async()=>{throw new ApiError(503,'prerequisites_missing')}
 const adapter=ready?createSupabaseStore({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,serviceKey:env.SUPABASE_SERVICE_KEY,ownerId:env.VHPMS_OWNER_UUID}):null
 const tasks=ready?createTaskHandler({...adapter,channel:env.VHPMS_COMMAND_CHANNEL}):createTaskHandler({authenticate:unavailable})
 let reader=null
 const bsg=createBsgHandler({authenticate:ready?adapter.authenticate:unavailable,reader:()=>reader??=createBsgReader({dataDir:env.BSG_DATA_DIR,knowledgeDir:env.BSG_KNOWLEDGE_DIR})})
 const bsgPl=createBsgPlHandler({authenticate:ready?adapter.authenticate:unavailable,rpc:ready&&Number.isFinite(bsgPlConfig.riskUsdPerR)?createBsgPlRpc({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,riskUsdPerR:bsgPlConfig.riskUsdPerR}):null})
 const financeReady=env.SUPABASE_URL==='https://bbpfkjucsabdfcmusqzu.supabase.co'&&env.SUPABASE_PUBLISHABLE_KEY&&env.SUPABASE_SERVICE_KEY&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.VHPMS_OWNER_UUID||'')
 const financeStore=financeReady?(ready?adapter:createSupabaseStore({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,serviceKey:env.SUPABASE_SERVICE_KEY,ownerId:env.VHPMS_OWNER_UUID})):null
 const finances=createFinancesHandler({authenticate:financeStore?financeStore.authenticate:unavailable,rpc:financeStore&&env.FINANCES_FIXTURE!=='true'?createFinanceRpc({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,serviceKey:env.SUPABASE_SERVICE_KEY}):null,forceFixture:env.FINANCES_FIXTURE==='true'})
 return (req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(path==='/api/bsg/pl-calendar')return bsgPl(req,res);if(path.startsWith('/api/bsg/'))return bsg(req,res);if(path==='/api/finances'||path.startsWith('/api/finances/'))return finances(req,res);return tasks(req,res)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const port=Number(process.env.VHPMS_COMMAND_PORT||8096)
 if(!Number.isInteger(port)||port<1||port>65535) throw Error('invalid_port')
 const server=createServer({requestTimeout:15000,headersTimeout:10000},runtimeHandler(process.env))
 server.maxRequestsPerSocket=100
 server.listen(port,'127.0.0.1',()=>console.log(`VHPMS task API listening on loopback:${port}; configuration is not proof of live readiness`))
}
