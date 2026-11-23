import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const OWNER = '00000000-0000-0000-0000-000000000001'
const MEMBER = '00000000-0000-0000-0000-000000000002'
const OUTSIDER = '00000000-0000-0000-0000-000000000003'

test('kpi scorecard migration replays and limits rows to the owner or members', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users VALUES ('${OWNER}'), ('${MEMBER}'), ('${OUTSIDER}');`)
    const base = await readFile(new URL('./20261015_vhpms.sql', import.meta.url), 'utf8')
    const sql = await readFile(new URL('./20261123_vhpms_kpi_scorecards.sql', import.meta.url), 'utf8')
    await db.exec(base)
    await db.exec(sql)
    await db.exec(sql)
    await db.exec(`INSERT INTO public.vhpms_memberships VALUES ('VE', '${MEMBER}');`)
    await db.exec(`SET ROLE anon;`)
    await assert.rejects(db.query('SELECT * FROM public.vhpms_owner_scorecards'), /permission denied/)
    await assert.rejects(db.query('SELECT * FROM public.vhpms_kpis'), /permission denied/)
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${OWNER}', false);`)
    const card = '10000000-0000-0000-0000-000000000001'
    await db.exec(`INSERT INTO public.vhpms_owner_scorecards(id, owner_id, name, subject_type, subject_id, business_id, metrics)
      VALUES ('${card}', '${OWNER}', 'VE Scorecard', 'business', 'VE', 'VE', '[{"name":"Cash on hand","target":""}]'::jsonb);`)
    await db.exec(`INSERT INTO public.vhpms_kpis(owner_id, catalogue_id, business_code, measure, perspective)
      VALUES ('${OWNER}', 've-cash-on-hand', 'VE', 'Cash on hand', 'Financial'),
             ('${OWNER}', 'owner-ve-cash-on-hand', 'GROUP', 'VE cash on hand', 'Financial'),
             ('${OWNER}', 'vt-monthly-income', 'VT', 'Monthly income', 'Financial');`)
    const kpi = (await db.query(`SELECT id FROM public.vhpms_kpis WHERE catalogue_id = 've-cash-on-hand'`)).rows[0].id
    await db.exec(`INSERT INTO public.vhpms_kpi_periods(kpi_id, label, year, target, actual) VALUES ('${kpi}', 'NOV', 2026, NULL, 1860);`)
    assert.equal((await db.query('SELECT * FROM public.vhpms_owner_scorecards')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM public.vhpms_kpis')).rows.length, 3)
    assert.equal((await db.query('SELECT actual FROM public.vhpms_kpi_periods')).rows[0].actual, '1860')
    await assert.rejects(db.exec(`INSERT INTO public.vhpms_kpis(owner_id, catalogue_id, business_code, measure, perspective) VALUES ('${MEMBER}', 've-open-slots', 'VE', 'Open slots', 'Customer')`), /row-level security|violates/)
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${MEMBER}', false);`)
    assert.equal((await db.query('SELECT catalogue_id FROM public.vhpms_kpis ORDER BY catalogue_id')).rows.map((row) => row.catalogue_id).join(','), 've-cash-on-hand')
    assert.equal((await db.query('SELECT name FROM public.vhpms_owner_scorecards')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM public.vhpms_kpi_periods')).rows.length, 1)
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${OUTSIDER}', false);`)
    assert.equal((await db.query('SELECT * FROM public.vhpms_kpis')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM public.vhpms_owner_scorecards')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM public.vhpms_kpi_periods')).rows.length, 0)
    await db.exec('RESET ROLE')
  } finally {
    await db.close()
  }
})
