import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const files = [
  new URL('./FinancesSection.jsx', import.meta.url),
  new URL('./LocalNotes.jsx', import.meta.url),
  new URL('../../pages/dashboard/FinancesPage.jsx', import.meta.url),
]
const banned = /\b(draft|proposed|demo|sample|preview|fixture|backend connected|local preview)\b/i

test('finances screen copy does not use unfinished labels', async () => {
  for (const file of files) {
    const text = (await readFile(file, 'utf8')).replaceAll('VITE_FINANCES_FIXTURE', '')
    assert.equal(banned.test(text), false, file.pathname)
  }
})
