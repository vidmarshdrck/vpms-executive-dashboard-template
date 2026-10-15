import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
test('migration replays; anon denied; membership isolated; approval and override audit enforced', async () => {
 const db=new PGlite()
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`)
 const sql=await readFile(new URL('./20261015_vhpms.sql',import.meta.url),'utf8')
 await db.exec(sql); await db.exec(sql)
 await db.exec(`INSERT INTO public.vhpms_businesses(id,name) VALUES ('BSG','BSG'),('VE','VE');
 INSERT INTO public.vhpms_memberships VALUES ('BSG','00000000-0000-0000-0000-000000000001');
 INSERT INTO public.vhpms_categories VALUES ('safety','Safety');
 INSERT INTO public.vhpms_projects(business_id,external_id,title,source_status) VALUES ('BSG','p1','Paper study','planned'),('VE','p2','Renewals','planned');
 INSERT INTO public.vhpms_tasks(business_id,external_id,title,source_status,source_priority,category_id) VALUES ('BSG','t1','Risk review','in_progress','high','safety'),('VE','t2','Renewals','blocked','medium',null);`)
 await db.exec(`SET ROLE anon;`)
 await assert.rejects(db.query('SELECT * FROM public.vhpms_tasks'),/permission denied/)
 await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`)
 assert.equal((await db.query('SELECT * FROM public.vhpms_tasks')).rows.length,1)
 assert.equal((await db.query('SELECT * FROM public.vhpms_projects')).rows.length,1)
 await assert.rejects(db.exec("INSERT INTO public.vhpms_memberships VALUES ('VE','00000000-0000-0000-0000-000000000001')"),/permission denied/)
 await db.exec(`SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`)
 assert.equal((await db.query('SELECT * FROM public.vhpms_tasks')).rows.length,0)
 await db.exec('RESET ROLE')
 await assert.rejects(db.exec("INSERT INTO public.vhpms_priority_rules(business_id,category_id,priority,rationale) VALUES ('BSG','safety','critical','Safety gate')"),/null value/)
 await db.exec(`INSERT INTO public.vhpms_priority_rules(business_id,category_id,priority,rationale,approved_by) VALUES ('BSG','safety','critical','Safety gate','00000000-0000-0000-0000-000000000001');`)
 await assert.rejects(db.exec("UPDATE public.vhpms_tasks SET override_priority='low' WHERE external_id='t1'"),/override requires/)
 await db.exec(`UPDATE public.vhpms_tasks SET override_priority='low',override_reason='Human reviewed',override_by='00000000-0000-0000-0000-000000000001' WHERE external_id='t1'`)
 assert.equal((await db.query('SELECT * FROM public.vhpms_activities')).rows.length,1)
 assert.equal((await db.query("SELECT effective_priority FROM public.vhpms_task_priorities WHERE external_id='t1'")).rows[0].effective_priority,'low')
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)")
 assert.equal((await db.query('SELECT * FROM public.vhpms_task_priorities')).rows.length,0)
 await db.exec('RESET ROLE')
 await db.exec("CREATE TABLE public.family_accounts(fid text PRIMARY KEY,due_date date); INSERT INTO public.family_accounts VALUES ('fixture-1',current_date),('fixture-2',null)")
 await db.exec(await readFile(new URL('./20261015_ve_readonly.sql',import.meta.url),'utf8'))
 await db.exec('SET ROLE anon')
 await assert.rejects(db.query('SELECT public.vhpms_ve_summary()'),/permission denied/)
 await db.exec("RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)")
 await assert.rejects(db.query('SELECT public.vhpms_ve_summary()'),/VE membership required/)
 await db.exec("RESET ROLE; INSERT INTO public.vhpms_memberships VALUES ('VE','00000000-0000-0000-0000-000000000002'); SET ROLE authenticated")
 const summary=(await db.query('SELECT public.vhpms_ve_summary() AS value')).rows[0].value
 assert.equal(summary.family_accounts,2)
 assert.equal(summary.due_within_7_days,1)
 assert.equal(summary.missing_due_date,1)
 await db.exec('RESET ROLE')
 await assert.rejects(db.exec("INSERT INTO public.vhpms_tasks(business_id,external_id,title,source_status,override_priority,override_reason,override_by) VALUES ('BSG','t4','Imported override','planned','low','Untracked','00000000-0000-0000-0000-000000000001')"),/initialize overrides/)
 await assert.rejects(db.exec("INSERT INTO public.vhpms_tasks(business_id,external_id,title,source_status,project_external_id) VALUES ('VE','t3','Invalid','planned','p1')"),/foreign key/)
 } finally { await db.close() }
})
