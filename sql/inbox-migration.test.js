import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const O = '00000000-0000-0000-0000-000000000001', X = '00000000-0000-0000-0000-000000000002'
test('inbox migration replays; anon denied; RLS by membership; decide/comment rules; audit append-only', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users VALUES ('${O}'),('${X}');`)
    for (const f of ['20261015_vhpms.sql', '20261016_task_commands.sql']) await db.exec(await readFile(new URL(`./${f}`, import.meta.url), 'utf8'))
    const inbox = await readFile(new URL('./20261017_inbox.sql', import.meta.url), 'utf8')
    await db.exec(inbox); await db.exec(inbox)
    await db.exec(`INSERT INTO public.vhpms_businesses(id,name) VALUES ('BSG','BSG'),('VE','VE');
      INSERT INTO public.vhpms_memberships(business_id,user_id,can_write) VALUES ('BSG','${O}',true),('VE','${X}',false);`)
    const mk = async (key, biz = 'BSG') => (await db.query(`SELECT public.vhpms_inbox_create('boaz',$1,$2::jsonb) r`, [key, JSON.stringify({ business_id: biz, kind: 'approval', action: 'trade', title: 'Approve demo trade', link_type: 'project', link_ref: 'p1' })])).rows[0].r
    const a = await mk('k1'); assert.equal(a.replayed, false); assert.equal((await mk('k1')).replayed, true)
    const id = a.item.id; await mk('k2', 'VE')
    await assert.rejects(db.query(`SELECT public.vhpms_inbox_decide('${O}',$1,'rejected','',null)`, [id]), /note_required/)
    await assert.rejects(db.query(`SELECT public.vhpms_inbox_decide('${X}',$1,'approved',null,null)`, [id]), /forbidden/)
    await assert.rejects(db.query(`SELECT public.vhpms_inbox_decide('${O}',$1,'approved',null,5)`, [id]), /revision_conflict/)
    const d = (await db.query(`SELECT public.vhpms_inbox_decide('${O}',$1,'approved','ok',1) r`, [id])).rows[0].r
    assert.equal(d.item.status, 'approved'); assert.equal(d.item.revision, 2)
    await assert.rejects(db.query(`SELECT public.vhpms_inbox_decide('${O}',$1,'rejected','late',null)`, [id]), /not_pending/)
    await db.query(`SELECT public.vhpms_inbox_comment('${O}',$1,'Noted')`, [id])
    await assert.rejects(db.query(`SELECT public.vhpms_inbox_comment('${O}',$1,'  ')`, [id]), /invalid_comment/)
    assert.deepEqual((await db.query(`SELECT event FROM public.vhpms_inbox_events WHERE item_id=$1 ORDER BY id`, [id])).rows.map(r => r.event), ['created', 'approved', 'commented'])
    await assert.rejects(db.exec(`DELETE FROM public.vhpms_inbox_events`), /append_only/)
    await db.exec(`SET ROLE anon;`); await assert.rejects(db.query('SELECT * FROM public.vhpms_inbox_items'), /permission denied/)
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${O}',false);`)
    assert.equal((await db.query('SELECT * FROM public.vhpms_inbox_items')).rows.length, 1)
    await assert.rejects(db.exec(`UPDATE public.vhpms_inbox_items SET status='approved'`), /permission denied/)
    await assert.rejects(db.query(`SELECT public.vhpms_inbox_decide('${O}','${id}','approved',null,null)`), /permission denied/)
    await db.exec('RESET ROLE')
  } finally { await db.close() }
})
