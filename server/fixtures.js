import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const owner='00000000-0000-0000-0000-000000000001'
export async function fixture(path) {
 const db=new PGlite(path)
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 INSERT INTO auth.users VALUES ('${owner}'),('00000000-0000-0000-0000-000000000002');`)
 await db.exec(await readFile(new URL('../sql/20261015_vhpms.sql',import.meta.url),'utf8'))
 const sql=await readFile(new URL('../sql/20261016_task_commands.sql',import.meta.url),'utf8')
 await db.exec(sql); await db.exec(sql)
 await db.exec(`INSERT INTO vhpms_businesses VALUES ('BSG','BSG'),('VE','VE');
 INSERT INTO vhpms_memberships(business_id,user_id,can_write) VALUES ('BSG','${owner}',true);
 INSERT INTO vhpms_categories VALUES ('safety','Safety');
 INSERT INTO vhpms_priority_rules(business_id,category_id,priority,rationale,approved_by) VALUES ('BSG','safety','critical','Approved fixture only','${owner}');
 INSERT INTO vhpms_projects(business_id,external_id,title,source_status) VALUES ('BSG','p1','Project','planned');`)
 return db
}
export async function command(db,{actor=owner,op='create',id=null,key='request-1',revision=null,data={title:'Review',category_id:'safety',source_priority:'low'}}={}) {
 return (await db.query('SELECT public.vhpms_task_command($1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8) AS result',[actor,'BSG',op,id,key,revision,JSON.stringify(data),'bags-telegram'])).rows[0].result
}
