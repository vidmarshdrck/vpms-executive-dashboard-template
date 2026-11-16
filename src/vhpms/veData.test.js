import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENT_COLUMNS, BANK_ACCOUNT_COLUMNS, BANK_TXN_COLUMNS, CUSTOMER_COLUMNS, EXPENSE_COLUMNS, FAMILY_COLUMNS, MARKETING_COLUMNS, ORDER_COLUMNS, PRODUCT_COLUMNS, SPEND_COLUMNS,
  buildWorkspace, classifyResult, createVeClient, fetchVeWorkspace, filterCustomers, filterFunds, financeSummary, fundsByMonth, receivedInPeriod, seatedCustomerIds, sumReceived, weekStart, weeklyBudget, whatsappHref, whatsappNumber,
} from './veData.js'

const TODAY = '2026-11-08'
const SECRET = 'super-secret-value'
const OTHER_SECRET = 'second-secret-value'

function sources(overrides = {}) {
  const base = {
    familyAccounts: { access: 'ok', rows: [], message: '' },
    customers: { access: 'ok', rows: [], message: '' },
    orders: { access: 'ok', rows: [], message: '' },
    expenses: { access: 'ok', rows: [], message: '' },
    marketing: { access: 'ok', rows: [], message: '' },
    marketingSpend: { access: 'ok', rows: [], message: '' },
    products: { access: 'ok', rows: [], message: '' },
  }
  return { ...base, ...overrides }
}

const customers = [
  { cid: 'C1', name: 'Amara Banda', products: ['Netflix', 'Spotify'], status: 'CONNECTED', total_spent: '1500.5', due_date: '2026-12-01', phone: '260970000000' },
  { cid: 'C2', name: 'Lombe Phiri', products: 'Prime Video', status: 'DISCONNECTED', total_spent: 40, due_date: null },
]
const accounts = [
  { fid: 7, aaid: 'AG1', product: 'Netflix', due_date: '2026-12-05', paid_status: 'Unpaid', slots_total: 5, slots_taken: 2, slot_1: 'C1', slot_2: 'C2', slot_3: null, slot_4: '', slot_5: null, password: SECRET, account_password: OTHER_SECRET },
  { fid: 8, product: 'Spotify', due_date: '2026-04-05', paid_status: 'Unpaid', slots_total: 5, slots_taken: 0, slot_1: 'C9' },
  { fid: 9, product: 'Apple Music', due_date: null, paid_status: 'Unpaid', slots_total: 5, slots_taken: 0 },
]

test('family accounts map connected names and leave email blank when none is stored', () => {
  const model = buildWorkspace(sources({
    familyAccounts: { access: 'ok', rows: accounts, message: '' },
    customers: { access: 'ok', rows: customers, message: '' },
  }), TODAY)
  assert.equal(model.activeAccounts.length, 1)
  assert.equal(model.inactiveAccounts.length, 2)
  assert.equal(model.activeAccounts[0].plan, 'Netflix')
  assert.equal(model.activeAccounts[0].owner, 'Not recorded')
  assert.equal(model.activeAccounts[0].agent, '')
  assert.equal(model.activeAccounts[0].members[0].name, 'Amara Banda')
  const named = buildWorkspace(sources({
    familyAccounts: { access: 'ok', rows: accounts, message: '' },
    customers: { access: 'ok', rows: customers, message: '' },
    accountAgents: { access: 'ok', rows: [{ aaid: 'AG1', name: 'Twaambo Banda', email: 'agent@example.com' }] },
  }), TODAY)
  assert.equal(named.activeAccounts[0].owner, 'Twaambo Banda')
  assert.equal(named.activeAccounts[0].agent, 'Twaambo Banda')
  assert.notEqual(named.activeAccounts[0].owner, named.activeAccounts[0].members[0].name)
  const blankName = buildWorkspace(sources({
    familyAccounts: { access: 'ok', rows: accounts, message: '' },
    accountAgents: { access: 'ok', rows: [{ aaid: 'AG1', name: 'nan' }] },
  }), TODAY)
  assert.equal(blankName.activeAccounts[0].owner, 'Not recorded')
  assert.equal(blankName.activeAccounts[0].agent, '')
  assert.equal(JSON.stringify(named).includes('agent@example.com'), false)
  assert.equal(model.activeAccounts[0].names, 'Amara Banda, Lombe Phiri')
  assert.equal(model.activeAccounts[0].email, '')
  assert.equal(model.inactiveAccounts.find((account) => account.id === '8').members[0].unmatched, true)
  assert.equal(model.overview.connected, 3)
  const packed = JSON.stringify(model)
  assert.equal(packed.includes(SECRET), false)
  assert.equal(packed.includes(OTHER_SECRET), false)
  assert.equal(packed.includes('password'), false)
  assert.equal(model.customers.find((row) => row.id === 'C1').phone, '260970000000')
})

test('received totals follow a period, and family-seated orders are a separate slice', () => {
  const orders = [
    { date: '2026-03-02', amount: 100, cid: 'C1' },
    { date: '2026-03-18', amount: 40, cid: 'C9' },
    { date: '2026-10-04', amount: 25, cid: 'C1' },
    { date: '2026-11-02', amount: 10, cid: 'C2' },
  ]
  const accounts = [{ members: [{ cid: 'C1' }, { cid: 'C2' }] }]
  const seated = seatedCustomerIds(accounts)
  assert.equal(receivedInPeriod(orders, { year: 2026, from: 3, to: 3 }), 140)
  assert.equal(receivedInPeriod(orders, { year: 2026, from: 10, to: 10 }), 25)
  assert.equal(receivedInPeriod(orders, { year: 2026, from: 10, to: 12 }), 35)
  assert.equal(sumReceived(orders), 175)
  assert.equal(sumReceived(orders, { cids: seated }), 135)
  assert.equal(sumReceived(orders, { cids: seated, start: '2026-03-01', end: '2026-03-31' }), 100)
})

test('customers, orders, and expenses keep the fields the pages show', () => {
  const model = buildWorkspace(sources({
    customers: { access: 'ok', rows: customers, message: '' },
    orders: { access: 'ok', rows: [{ oid: 'O1', date: '2026-11-08', amount: '120.50', product: 'Netflix', months: 1, cid: 'C1', status: 'CONNECTED', payment_method: 'cash', receipt_link: 'https://secret.example/receipt' }] },
    expenses: { access: 'ok', rows: [
      { id: 4, date: '2026-11-04', amount: 30, category: 'Airtime', family_account_id: 7, status: 'Paid', payee: 'Airtel', fnb_transaction_ref: 'REF-SECRET' },
      { id: 5, date: '2026-11-11', amount: 80, category: 'Spotify', status: 'Paid', payee: 'Spotify' },
    ] },
  }), TODAY)
  assert.equal(model.customers[0].products, 'Netflix, Spotify')
  assert.equal(model.customers[0].totalSpent, 1500.5)
  assert.equal(model.customers[1].dueDate, 'Not dated')
  assert.equal(model.income[0].title, 'Amara Banda')
  assert.equal(model.income[0].amount, 120.5)
  assert.equal(model.income[0].kind, 'income')
  assert.deepEqual(financeSummary(model.income, model.expenses, { orders: 'ok', expenses: 'ok' }), { expenses: 110, income: 120.5, balance: 10.5, profit: 10.5 })
  assert.equal(financeSummary([], [], { orders: 'blocked', expenses: 'ok' }).balance, null)
  assert.deepEqual(model.incomeCategories.map((row) => row.name), ['Netflix'])
  assert.equal(weekStart('2026-11-04'), '2026-11-02')
  assert.equal(weekStart('2026-11-11'), '2026-11-09')
  assert.deepEqual(weeklyBudget(model.expenses).map((week) => [week.week, week.total]), [['2026-11-02', 30], ['2026-11-09', 80]])
  const packed = JSON.stringify(model)
  assert.equal(packed.includes('REF-SECRET'), false)
  assert.equal(packed.includes('secret.example'), false)
  assert.equal(packed.includes('cash'), false)
})

test('funds filter, month graph, posts, and CAC use only returned rows', () => {
  const model = buildWorkspace(sources({
    orders: { access: 'ok', rows: [{ oid: 'O1', date: '2026-11-08', amount: 100, product: 'Spotify', cid: '', status: '' }] },
    expenses: { access: 'ok', rows: [{ id: 1, date: '2026-10-02', amount: 40, category: 'Airtime', status: 'Paid', payee: 'Airtel' }] },
    marketing: { access: 'ok', rows: [{ id: 3, date: '2026-12-01', channel: 'Meta', campaign: 'December renewals', hook_used: 'Renew before Friday', cta_used: 'Pay now' }] },
    marketingSpend: { access: 'ok', rows: [
      { id: 1, date: '2026-10-01', channel: 'Meta', campaign: 'October', amount: 200, conversions: 4, cac: '', notes: 'private note' },
      { id: 2, date: 'DECEMBER 2025 TOTAL', channel: '', campaign: 'Total', amount: 10, conversions: null, cac: '~K34.19' },
    ] },
  }), TODAY)
  assert.equal(filterFunds(model.income, model.expenses, 'income').every((row) => row.kind === 'income'), true)
  assert.equal(filterFunds(model.income, model.expenses, 'expense').some((row) => row.kind === 'income'), false)
  assert.deepEqual(fundsByMonth(filterFunds(model.income, model.expenses, 'all')).map((row) => row.month), ['2026-10', '2026-11'])
  assert.equal(model.posts[0].status, 'Scheduled')
  assert.equal(model.posts[0].post, 'December renewals · Renew before Friday · Pay now')
  assert.equal(model.acquisition.value, 50)
  assert.equal(model.spend[1].cacLabel, '~K34.19')
  assert.equal(JSON.stringify(model).includes('private note'), false)
})

test('empty marketing and blocked reads stay distinct', () => {
  const empty = buildWorkspace(sources(), TODAY)
  assert.equal(empty.posts.length, 0)
  assert.equal(empty.access.marketing, 'ok')
  const blocked = buildWorkspace(sources({
    customers: { access: 'blocked', rows: [], message: 'permission denied' },
    orders: { access: 'blocked', rows: [{ oid: 'hidden' }], message: 'permission denied' },
    familyAccounts: { access: 'empty', rows: [], message: '' },
  }), TODAY)
  assert.equal(blocked.customers.length, 0)
  assert.equal(blocked.income.length, 0)
  assert.equal(classifyResult({ data: null, error: { code: '42501', message: 'permission denied for table customers' } }).access, 'blocked')
  assert.equal(classifyResult({ data: [], error: null }).access, 'empty')
})

test('customer search and WhatsApp links use the stored phone', () => {
  const rows = [
    { id: 'C1', name: 'Amara Banda', phone: '0977000111', products: 'Netflix', status: 'CONNECTED', dueDate: '2026-12-05' },
    { id: 'C2', name: 'Lombe Phiri', phone: '', products: 'Spotify', status: 'DISCONNECTED', dueDate: 'Not dated' },
    { id: 'V200', name: 'Chipo Mwale', phone: '+260 97 700 0222', products: 'Prime Video', status: 'CONNECTED', dueDate: '2026-11-01' },
  ]
  assert.deepEqual(filterCustomers(rows, { status: 'CONNECTED', query: 'netflix, V200' }).map((row) => row.id), ['C1', 'V200'])
  assert.deepEqual(filterCustomers(rows, { query: '0977000111' }).map((row) => row.id), ['C1'])
  assert.equal(whatsappNumber('0977000111'), '260977000111')
  assert.equal(whatsappNumber('+260 97 700 0222'), '260977000222')
  assert.equal(whatsappNumber(''), '')
  const href = whatsappHref(rows[0])
  assert.match(href, /^https:\/\/wa\.me\/260977000111\?text=/)
  assert.match(decodeURIComponent(href), /Amara Banda/)
  assert.match(decodeURIComponent(href), /Netflix/)
  assert.match(decodeURIComponent(href), /2026-12-05/)
  assert.equal(whatsappHref(rows[1]), '')
})

test('the authenticated read lists safe columns and drops a secret if one is returned', async () => {
  const seen = []
  function from(table) {
    const state = { table, columns: '' }
    const builder = {
      select(columns) { state.columns = columns; return builder },
      order() { return builder },
      async range() {
        seen.push({ ...state })
        if (table === 'customers') return { data: null, error: { code: '42501', message: 'permission denied for table customers' } }
        if (table === 'family_accounts') return { data: [{ fid: 1, product: 'Spotify', due_date: '2026-12-01', paid_status: 'Unpaid', slots_total: 5, slots_taken: 0, password: SECRET }], error: null }
        if (table === 'products') return { data: [{ id: 'p1', name: 'Spotify', category: 'music', is_shared_plan: true, slots_per_account: 5, price_zmw: null, is_active: true }], error: null }
        return { data: [], error: null }
      },
    }
    return builder
  }
  const client = { from, schema() { return { from } } }
  let options
  const model = await fetchVeWorkspace({
    env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable' },
    token: 'owner-token',
    today: TODAY,
    createClient: (url, key, next) => { options = { url, key, next }; return client },
  })
  assert.equal(options.url, 'https://example.supabase.co')
  assert.equal(await options.next.accessToken(), 'owner-token')
  assert.equal(options.next.global.headers.Authorization, 'Bearer owner-token')
  assert.deepEqual(seen.map((item) => item.columns), [FAMILY_COLUMNS, CUSTOMER_COLUMNS, ORDER_COLUMNS, EXPENSE_COLUMNS, MARKETING_COLUMNS, SPEND_COLUMNS, PRODUCT_COLUMNS, BANK_ACCOUNT_COLUMNS, BANK_TXN_COLUMNS, AGENT_COLUMNS, 'id,business_id,task_id,event,after_value,created_at'])
  for (const columns of seen.map((item) => item.columns)) {
    assert.equal(/\b(password|receipt|notes|fnb_transaction_ref)\b/i.test(columns), false)
  }
  assert.match(CUSTOMER_COLUMNS, /\bphone\b/)
  assert.equal(model.access.customers, 'blocked')
  assert.equal(model.access.familyAccounts, 'ok')
  assert.equal(model.accounts[0].email, '')
  assert.equal(model.accounts[0].names, '')
  assert.equal(JSON.stringify(model).includes(SECRET), false)
  assert.equal(JSON.stringify(model).includes('password'), false)
  assert.equal(model.products[0].price, null)
  assert.equal(createVeClient({}, 'token'), null)
})

test('bank projection uses transaction prices and leaves an inactive plan out', () => {
  const model = buildWorkspace(sources({
    familyAccounts: { access: 'ok', rows: [
      { fid: 1, product: 'Netflix', due_date: '2026-12-01', paid_status: 'Unpaid', slots_total: 1, slots_taken: 1 },
      { fid: 2, product: 'Spotify', due_date: '2026-01-01', paid_status: 'Unpaid', slots_total: 1, slots_taken: 0 },
    ], message: '' },
    products: { access: 'ok', rows: [{ id: 'p1', name: 'Netflix', price_zmw: 9999, is_active: true }], message: '' },
    bankAccounts: { access: 'ok', rows: [
      { id: '9e0c1583-0000-4000-8000-00000000f1b1', label: 'FNB Lifestart Student (ZMW)', bank: 'FNB Zambia', currency: 'ZMW', account_last4: '1583', opening_balance: '488.70' },
    ], message: '' },
    bankTransactions: { access: 'ok', rows: [
      { id: 1, account_id: '9e0c1583-0000-4000-8000-00000000f1b1', txn_date: '2026-09-30', description: 'NETFLIX.COM', reference: 'R1', amount: '-399.75', balance: '36.67', category: 've_provider_subscription', orig_amount_usd: '15.99', fx_rate: '25' },
    ], message: '' },
  }), TODAY)
  assert.equal(model.bankAccounts[0].label, 'FNB Lifestart Student (ZMW)')
  assert.equal(model.bankAccounts[0].last4, '1583')
  assert.equal(model.bankAccounts[0].openingBalance, 488.7)
  assert.equal(model.bankTransactions[0].balance, 36.67)
  assert.equal(model.bankTransactions[0].origAmountUsd, 15.99)
  assert.equal(model.products[0].price, 9999)
  assert.deepEqual(model.budget.lines.map((line) => line.plan), ['Netflix'])
  assert.equal(model.budget.lines[0].unitUsd, 15.99)
  assert.equal(model.budget.fx.rate, 25)
  assert.equal(model.budget.projection, 399.75)
  assert.equal(JSON.stringify(model.budget).includes('9999'), false)
})
