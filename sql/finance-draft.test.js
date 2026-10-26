import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const file = new URL('./draft/20261026_finance_option_a.NOT_APPLIED.sql', import.meta.url)

test('finance note is not executable DDL and does not create a second ledger', async () => {
  const sql = await readFile(file, 'utf8')
  assert.match(sql, /NOT APPLIED/)
  assert.match(sql, /finance\.vhpms_finances_summary/)
  assert.match(sql, /finance\.vhpms_finances_entries/)
  assert.match(sql, /ledger_bucket/)
  assert.equal(sql.includes('CREATE TABLE'), false)
  assert.equal(sql.includes('vhpms_finance_entries'), false)
  const db = new PGlite()
  try {
    await assert.rejects(db.exec(sql), /NOT APPLIED/)
  } finally { await db.close() }
})
