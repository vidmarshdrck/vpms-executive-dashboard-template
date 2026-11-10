import test from 'node:test'
import assert from 'node:assert/strict'
import { CORE_BUSINESS_IDS, adapterFor, buildAdapterModel, needsTable } from './businessSources.js'

const TODAY = '2026-11-08'

test('a business with no tables names the tables it needs', () => {
  const transport = buildAdapterModel('vt', {}, TODAY)
  const apparel = buildAdapterModel('eunique', {}, TODAY)
  assert.equal(transport.incomeNote, needsTable('public.vt_income'))
  assert.equal(transport.expenseNote, needsTable('public.vt_expenses'))
  assert.equal(transport.clientsNote, needsTable('public.vt_customers'))
  assert.equal(transport.marketingNote, needsTable('public.vt_marketing'))
  assert.equal(transport.operationsNote, needsTable('public.vt_operations'))
  assert.equal(transport.finance.income, null)
  assert.equal(transport.finance.expenses, null)
  assert.equal(apparel.incomeNote, needsTable('public.eunique_income'))
  assert.equal(adapterFor('vt').reads.length, 0)
})

test('VAI income and clients come from the live tables and expenses stay unconnected', () => {
  const invoiceKey = `finance.invoices.${CORE_BUSINESS_IDS.vai}`
  const model = buildAdapterModel('vai', {
    [invoiceKey]: { access: 'ok', rows: [{ id: 'i1', invoice_number: 'VAI-1', client_name: 'Acme', issue_date: '2026-11-02', due_date: '2026-11-20', total: '250.00', status: 'sent' }], message: '' },
    'vai.clients': { access: 'ok', rows: [{ id: 'c1', business_name: 'Acme', status: 'active', start_date: '2026-09-01' }], message: '' },
    'vai.prospects': { access: 'empty', rows: [], message: '' },
    'vai.contracts': { access: 'ok', rows: [{ id: 'k1', title: 'Support', status: 'active', start_date: '2026-10-01', end_date: '2026-11-18', monthly_value_zmw: 400 }], message: '' },
    'vai.services': { access: 'empty', rows: [], message: '' },
    [`pms.tasks.${CORE_BUSINESS_IDS.vai}`]: { access: 'empty', rows: [], message: '' },
    [`pms.projects.${CORE_BUSINESS_IDS.vai}`]: { access: 'empty', rows: [], message: '' },
  }, TODAY)
  assert.equal(model.finance.income, 250)
  assert.equal(model.finance.expenses, null)
  assert.match(model.expenseNote, /No data connected yet/)
  assert.match(model.expenseNote, /VAI expense table/)
  assert.match(model.marketingNote, /VAI marketing table/)
  assert.equal(model.clients[0].name, 'Acme')
  assert.equal(model.counts.active, 1)
  assert.equal(model.counts.newer, 0)
  assert.equal(model.operations[0].title, 'Support')
  assert.equal(model.upcoming[0].due, '2026-11-18')
  assert.equal(JSON.stringify(model).includes('9999'), false)
})

test('blocked business tables say owner SELECT is missing and do not become zeros', () => {
  const taskKey = `pms.tasks.${CORE_BUSINESS_IDS.bsg}`
  const invoiceKey = `finance.invoices.${CORE_BUSINESS_IDS.bsg}`
  const model = buildAdapterModel('bsg', {
    'public.phone_inventory': { access: 'blocked', rows: [{ id: 1, model: 'Hidden', quantity: 4 }], message: 'permission denied' },
    'public.iphone_price_list': { access: 'blocked', rows: [], message: 'permission denied' },
    [taskKey]: { access: 'blocked', rows: [], message: 'permission denied' },
    [invoiceKey]: { access: 'blocked', rows: [{ id: 'x', total: 50 }], message: 'permission denied' },
  }, TODAY)
  assert.equal(model.finance.income, null)
  assert.equal(model.operations.length, 0)
  assert.match(String(model.operationsNote), /no SELECT policy/)
  assert.match(String(model.incomeNote), /Owner SELECT is missing/)
  assert.match(String(model.clientsNote), /BSG customer table/)
  assert.equal(JSON.stringify(model).includes('Hidden'), false)
})

test('digital sales are income and a missing buyer table stays unconnected', () => {
  const model = buildAdapterModel('digital', {
    'commerce.sales': { access: 'ok', rows: [{ id: 's1', sold_at: '2026-11-03T10:00:00Z', marketplace: 'Etsy', external_order_id: 'E-9', amount_received_zmw: 80, buyer_currency: 'USD' }], message: '' },
    'commerce.digital_products': { access: 'ok', rows: [{ id: 'p1', title: 'Guide', stage: 'live' }], message: '' },
    'commerce.marketplace_listings': { access: 'empty', rows: [], message: '' },
    [`pms.tasks.${CORE_BUSINESS_IDS.digital}`]: { access: 'empty', rows: [], message: '' },
  }, TODAY)
  assert.equal(model.incomeRows[0].amount, 80)
  assert.equal(model.incomeRows[0].category, 'Etsy')
  assert.equal(model.operations[0].title, 'Guide')
  assert.match(model.clientsNote, /Digital Products customer table/)
  assert.equal(model.finance.expenses, null)
})
