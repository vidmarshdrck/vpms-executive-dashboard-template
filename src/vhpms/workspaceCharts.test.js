import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { balancesByAccount } from './bankBudget.js'
import { BUSINESS_SEED } from './books.js'
import { EMPTY, accountCaption, emptyDetail, formatAmount, formatDayHeading, formatDisplayDate, isNeedsNote, monthStripRows, sectionDetail, sentenceCase, sourceLine, statusLabel } from './workspaceCharts.js'

const MINUS = '\u2212'

test('money uses one currency format, two decimals, and a real minus sign', () => {
  assert.equal(formatAmount(1500), 'ZMW 1,500.00')
  assert.equal(formatAmount(600.75), 'ZMW 600.75')
  assert.equal(formatAmount(288.95), 'ZMW 288.95')
  assert.equal(formatAmount(-165), `ZMW ${MINUS}165.00`)
  assert.equal(formatAmount(15.99, 'USD'), 'USD 15.99')
  assert.equal(formatAmount(-2400, 'USD'), `USD ${MINUS}2,400.00`)
  assert.equal(formatAmount(-165).includes('-'), false)
})

test('bank captions keep the name and the last four digits', () => {
  const caption = accountCaption({ label: 'FNB current 123456789012', last4: '1583', bank: 'FNB' })
  assert.equal(caption, 'FNB current · 1583')
  assert.equal(caption.includes('123456789012'), false)
  assert.equal(accountCaption({ label: 'Operating', last4: '' }), 'Operating')
})

test('a missing source names the table and does not say it will appear', () => {
  assert.equal(isNeedsNote('No data connected yet. Needs public.vt_income.'), true)
  assert.equal(sourceLine('No data connected yet. Needs public.vt_income.'), 'From public.vt_income.')
  assert.equal(sourceLine('No data connected yet. Needs a VAI expense table (none exists in the vai schema).'), 'From a VAI expense table.')
  assert.equal(sourceLine('Expenses are not visible to this account.'), 'Expenses are not visible to this account.')
  assert.equal(EMPTY.budget.title, 'No expense budget set')
  assert.equal(emptyDetail('budget', 'vai'), 'Set a budget to track VAI spending against it.')
  assert.equal(sectionDetail('No data connected yet. Needs public.vt_income.', 'income', 'vt'), 'Record income to see what VT received in this period.')
  assert.equal(sectionDetail('Expenses are not visible to this account.', 'expenses', 've'), 'Expenses are not visible to this account.')
  assert.equal(formatDayHeading('2026-11-02'), 'Mon 2 Nov')
  assert.equal(/will appear here/i.test(emptyDetail('budget', 'vai')), false)
  assert.equal(/will appear here/i.test(Object.values(EMPTY).map((item) => item.title).join(' ')), false)
  assert.equal(/\b(draft|demo|sample|placeholder|coming soon)\b/i.test(Object.values(EMPTY).map((item) => item.title).join(' ')), false)
})

test('dates and category names use one readable form', () => {
  assert.equal(formatDisplayDate('2026-12-05'), '5 Dec 2026')
  assert.equal(sentenceCase('cash'), 'Cash')
  assert.equal(sentenceCase('Boost Post'), 'Boost post')
  assert.equal(statusLabel('CONNECTED'), 'Connected')
  assert.equal(statusLabel('DISCONNECTED'), 'Disconnected')
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
