import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { balancesByAccount } from './bankBudget.js'
import { BUSINESS_SEED } from './books.js'
import { accountCaption, displayNote, formatThousands, isNeedsNote, monthStripRows, SECTION_EMPTY } from './workspaceCharts.js'

test('chart amounts use the currency and K from one thousand', () => {
  assert.equal(formatThousands(1500), 'ZMW 1.5K')
  assert.equal(formatThousands(12000), 'ZMW 12K')
  assert.equal(formatThousands(288.95), 'ZMW 289')
  assert.equal(formatThousands(30), 'ZMW 30')
  assert.equal(formatThousands(15.99, 'USD'), 'USD 16')
  assert.equal(formatThousands(-2400, 'USD'), 'USD -2.4K')
})

test('bank captions keep the name and the last four digits', () => {
  const caption = accountCaption({ label: 'FNB current 123456789012', last4: '1583', bank: 'FNB' })
  assert.equal(caption, 'FNB current · 1583')
  assert.equal(caption.includes('123456789012'), false)
  assert.equal(accountCaption({ label: 'Operating', last4: '' }), 'Operating')
})

test('a missing source becomes one plain sentence', () => {
  assert.equal(isNeedsNote('No data connected yet. Needs public.vt_income.'), true)
  assert.equal(displayNote('No data connected yet. Needs public.vt_income.', SECTION_EMPTY.income), SECTION_EMPTY.income)
  assert.equal(displayNote('Expenses are not visible to this account.', SECTION_EMPTY.expenses), 'Expenses are not visible to this account.')
  assert.match(SECTION_EMPTY.finances, /will appear here/)
  assert.equal(/\b(draft|demo|sample|placeholder|coming soon)\b/i.test(Object.values(SECTION_EMPTY).join(' ')), false)
})

test('the month strip labels every month in the period', () => {
  const rows = [
    { date: '2026-11-04', kind: 'expense', amount: 2500, category: 'Rent' },
    { date: '2026-11-08', kind: 'income', amount: 800, category: 'Sales' },
  ]
  const strip = monthStripRows(rows, ['2026-10', '2026-11', '2026-12'])
  assert.deepEqual(strip.map((item) => item.label), ['Oct', 'Nov', 'Dec'])
  assert.equal(strip[1].expense, 2500)
  assert.equal(strip[1].income, 800)
  assert.equal(strip[0].income, 0)
})

test('account bars use the closing balance and never a full account number', () => {
  const rows = balancesByAccount([
    { id: 'acct-1', label: 'FNB 001234567890', last4: '4242', currency: 'ZMW', openingBalance: 10 },
  ], [
    { id: 1, accountId: 'acct-1', date: '2026-11-02', balance: 80 },
    { id: 2, accountId: 'acct-1', date: '2026-11-09', balance: 1400 },
  ], '2026-11-08')
  assert.equal(rows[0].amount, 80)
  assert.equal(rows[0].last4, '4242')
  assert.equal(accountCaption(rows[0]).includes('001234567890'), false)
  assert.match(accountCaption(rows[0]), /4242/)
})

test('every live business has a real navigation icon', () => {
  const live = BUSINESS_SEED.filter((business) => business.active)
  assert.deepEqual(live.map((business) => business.id), ['ve', 'vai', 'rez', 'bsg', 'vt', 'eunique', 'digital'])
  const icons = readFileSync(new URL('./icons.jsx', import.meta.url), 'utf8')
  for (const business of live) assert.match(icons, new RegExp(`${business.id}: '`))
  assert.equal(icons.includes('letter-mark'), false)
})
