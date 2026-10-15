// Manual, bounded server-side ingestion. No scheduler. Dry-run by default.
import { readFile } from 'node:fs/promises'
import { projectSnapshot, readbackMatches } from './paperclip.js'
const args=process.argv.slice(2); const bindingPath=args[args.indexOf('--bindings')+1]
if (!args.includes('--bindings')||!bindingPath) throw new Error('--bindings /private/project-business-bindings.json required; no inferred business mapping')
const bindings=JSON.parse(await readFile(bindingPath,'utf8'))
if (!Object.keys(bindings).length || Object.values(bindings).some(v=>typeof v!=='string'||!v.trim())) throw new Error('Bindings must contain explicit nonempty business IDs')
const source='http://127.0.0.1:3100/api/companies/c4050e29-4a13-48ca-9671-7016dbdb11ea/'
const get=async path=>{
 const r=await fetch(source+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Paperclip ${path}: HTTP ${r.status}`);return r.json()
}
const [projects,issues,agents]=await Promise.all([get('projects'),get('issues?limit=1000'),get('agents')])
if(!Array.isArray(issues)||issues.length>=1000)throw new Error('Source pagination incomplete: refusing truncated sync')
const snapshot=projectSnapshot({projects,issues,agents},bindings,new Date().toISOString())
if(Object.keys(bindings).some(id=>!projects.some(p=>p.id===id)))throw new Error('Unknown bound project ID')
if(args.includes('--apply')) {
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_KEY
 if(!url||!key)throw new Error('Server-side Supabase credentials missing')
 const rest=async (path,method='GET',body)=>{
  const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)})
  if(!r.ok)throw new Error(`Supabase ${path.split('?')[0]}: HTTP ${r.status}; migration/access must be provisioned`)
  return r.json()
 }
 // Provisioned businesses/memberships/rules must pre-exist; never self-enroll.
 for(const table of ['projects','tasks']) {
  const rows=snapshot[table]; if(!rows.length)continue
  await rest(`vhpms_${table}?on_conflict=business_id,external_id`,'POST',rows)
  for(const row of rows) {
   const actual=await rest(`vhpms_${table}?business_id=eq.${encodeURIComponent(row.business_id)}&external_id=eq.${encodeURIComponent(row.external_id)}`)
   if(actual.length!==1||!readbackMatches(row,actual[0]))throw new Error(`Readback mismatch: ${table}`)
  }
 }
 for(const business of new Set(Object.values(bindings))) {
  const row={business_id:business,source:'paperclip',record_count:snapshot.tasks.filter(t=>t.business_id===business).length,status:'success'}
  const [written]=await rest('vhpms_sync_runs','POST',row)
  const [actual]=await rest(`vhpms_sync_runs?id=eq.${written.id}`)
  if(!actual||Object.entries(row).some(([k,v])=>actual[k]!==v))throw new Error('Sync metadata readback mismatch')
 }
}
console.log(JSON.stringify({mode:args.includes('--apply')?'applied-and-read-back':'read-only-dry-run',sourceProjects:projects.length,sourceIssues:issues.length,scopedProjects:snapshot.projects.length,scopedTasks:snapshot.tasks.length,businesses:[...new Set(Object.values(bindings))],syncedAt:snapshot.projects[0]?.synced_at||null,remoteWritten:args.includes('--apply')},null,2))
