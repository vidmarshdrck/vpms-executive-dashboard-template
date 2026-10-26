import { useEffect, useRef, useState } from 'react'
import { isStale } from './live.js'
import { supabase as client } from './supabaseClient.js'
const empty={businesses:[],projects:[],tasks:[]}
export default function LiveWorkspace() {
 const [session,setSession]=useState(null), [data,setData]=useState(empty), [error,setError]=useState(''), [busy,setBusy]=useState(false), [business,setBusiness]=useState(''), [clock,setClock]=useState(()=>Date.now()), [ve,setVe]=useState(null)
 const generation=useRef(0)
 useEffect(()=>{
  if(!client)return
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{generation.current++;setSession(next);setData(empty);setVe(null);setError('')})
  return ()=>subscription.unsubscribe()
 },[])
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer)},[])
 async function login(e){
  e.preventDefault();setBusy(true);setError('')
  const form=e.currentTarget, fields=new FormData(form)
  try {const {error}=await client.auth.signInWithPassword({email:String(fields.get('email')),password:String(fields.get('password'))});if(error)throw error;form.reset()}
  catch {setError('Supabase sign-in failed. Check your existing account credentials; no local or demo login is accepted.')}
  finally{setBusy(false)}
 }
 async function refresh(){
  const requestGeneration=generation.current
  setBusy(true);setError('');setData(empty)
  try {
   const result=await Promise.all(['vhpms_businesses','vhpms_projects','vhpms_task_priorities'].map(table=>client.from(table).select('*').limit(1000)))
   if(requestGeneration!==generation.current)return
   const failed=result.find(r=>r.error);if(failed)throw failed.error
   if(result.some(r=>r.data.length>=1000))throw new Error('LIMIT')
   setData({businesses:result[0].data,projects:result[1].data,tasks:result[2].data});setClock(Date.now())
  } catch(error){setError(error.message==='LIMIT'?'Result limit reached. No partial dashboard is displayed; a paginated adapter is required.':'Live read unavailable. Migration, business membership or API access is not provisioned. No local preview data was substituted.')}
  finally{setBusy(false)}
 }
 async function logout(){generation.current++;setData(empty);setVe(null);setSession(null);await client.auth.signOut({scope:'local'})}
 async function readVe(){
  const requestGeneration=generation.current;setBusy(true);setError('');setVe(null)
  try {const result=await client.rpc('vhpms_ve_summary');if(result.error)throw result.error;if(requestGeneration===generation.current)setVe(result.data)}
  catch {setError('VE aggregate unavailable: second SQL migration and explicit VE membership required. No administrative dashboard or customer rows are exposed.')}
  finally {setBusy(false)}
 }
 const tasks=data.tasks.filter(t=>!business||t.business_id===business)
 const projects=data.projects.filter(p=>!business||p.business_id===business)
 return <>
 <section className="vh-panel"><h2>Authorised live workspace</h2><p>This is the existing VHPMS shell, not a second app. Live reads use Supabase Auth and business-scoped SQL RLS. Local planner records are never merged into this register.</p>
 {!client?<p role="status">Not connected: public Supabase build configuration is missing.</p>:!session?<form className="vh-form" onSubmit={login}><label>Email<input type="email" name="email" autoComplete="username" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" required/></label><button disabled={busy}>Sign in with Supabase</button></form>:<><p>Authenticated Supabase session · memory only. Reload signs out.</p><div className="vh-actions"><button onClick={refresh} disabled={busy}>{busy?'Reading…':'Read authorised records'}</button><button onClick={logout}>Sign out</button></div><label>Live business<select aria-label="Live business" value={business} onChange={e=>setBusiness(e.target.value)}><option value="">All authorised businesses</option>{data.businesses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></>}
 <p role="status" aria-live="polite">{error}</p><p className="vh-muted">Read-only increment. No task dispatch, financial balance, execution or cross-device write claim. Migration and owner provisioning remain required.</p></section>
 {session&&<><section className="vh-panel"><h2>Source projects</h2>{projects.length?<ul className="vh-list">{projects.map(p=><li key={`${p.business_id}:${p.external_id}`}><div><strong>{p.title}</strong><small>{p.business_id} · source status: {p.source_status} · {isStale(p.synced_at,clock)?'Stale':'Recent sync'} · {p.synced_at}</small></div></li>)}</ul>:<p>No authorised project records loaded. This does not mean no projects exist.</p>}</section>
 <section className="vh-panel"><h2>Tasks & automatic priority</h2><p>Approved business + category rule → source priority fallback. Audited manual overrides take precedence. Owner identity never affects priority; severity is not financial focus.</p>{tasks.length?<ul className="vh-list">{tasks.map(t=><li key={`${t.business_id}:${t.external_id}`}><div><strong>{t.identifier} · {t.title}</strong><small>{t.business_id} · {t.owner_name||'Unassigned'} · source status: {t.source_status} (not proof of execution)</small><small>Priority: {t.effective_priority||'Unspecified'} · {t.priority_source} · {t.priority_rationale}</small><small>Due: {t.due_at||'Unspecified'} · {isStale(t.synced_at,clock)?'Stale / do not rely on current state':'Recent sync'} · last sync {t.synced_at}</small></div></li>)}</ul>:<p>No authorised task records loaded. Unprovisioned membership never falls back to public records.</p>}</section></>}
 <section className="vh-panel"><h2>VE operations · existing integration</h2><p>Existing source: VE’s running local FastAPI dashboard and Supabase public family_accounts / customer_account_dashboard. Keep renewal operations here; do not embed an administrative dashboard or expose customer contact data.</p><p><strong>{ve?'Authorised aggregate received.':'Not connected.'}</strong> Existing VE source tables are reused, not copied. Google consent is a separate dependency.</p>{session&&<button disabled={busy} onClick={readVe}>Read authorised VE summary</button>}{ve&&<><dl className="vh-evidence"><div><dt>Family account rows</dt><dd>{ve.family_accounts}</dd></div><div><dt>Due date within 7 days</dt><dd>{ve.due_within_7_days}</dd></div><div><dt>Past due date</dt><dd>{ve.past_due_date}</dd></div><div><dt>Missing due date</dt><dd>{ve.missing_due_date}</dd></div></dl><p>Source: {ve.source} · queried {ve.queried_at}. Source last updated: unavailable. Due-date counts are not verified renewal failures, active subscriptions or revenue.</p></>}</section>
 <section className="vh-panel"><h2>AI chat</h2><p><strong>Not connected.</strong> Chat is retained as an integration module, but no authenticated, scoped AI endpoint has been verified. TPPL’s quick-reply helper is scripted; it is not reused as an AI claim. No provider requests or task writes are sent from this module.</p><label className="vh-field">Message<textarea aria-label="AI chat message" disabled placeholder="AI endpoint not connected"/></label><button disabled>Send · not connected</button></section>
 </>
}
