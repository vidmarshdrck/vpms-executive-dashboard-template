import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyBooks } from './books.js'
import { emptyActivities } from './activities.js'
import { findAccount } from './directory.js'
import { COPY, buildWorkspace } from './veData.js'
import { CORE_BUSINESS_IDS, buildAdapterModel } from './businessSources.js'
import { SECTION_EMPTY } from './workspaceCharts.js'

const bundle = await build({
  stdin: { contents: "export { BusinessHome } from './src/vhpms/BusinessHome.jsx'\nexport { default as BusinessWorkspace } from './src/vhpms/BusinessWorkspace.jsx'\nexport { default as VeWorkspace, FamilyModal } from './src/vhpms/VeWorkspace.jsx'\nexport { default as ActivitiesBoard } from './src/vhpms/ActivitiesBoard.jsx'\nexport { default as Shell } from './src/vhpms/Shell.jsx'\nexport { TimeframePopover } from './src/vhpms/TimeframePopover.jsx'", resolveDir: process.cwd() },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  packages: 'external',
  loader: { '.css': 'empty' },
})
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const code = bundle.outputFiles[0].text.replace(/from "([^"]+)"/g, (_, name) => {
  if (name.startsWith('react') || name.startsWith('@supabase/') || name === 'lucide-react') return `from "file://${require.resolve(name)}"`
  return `from "${name}"`
})
const { BusinessHome, BusinessWorkspace, VeWorkspace, FamilyModal, ActivitiesBoard, Shell, TimeframePopover } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const TODAY = '2026-11-08'
const SECRET = 'super-secret-value'

function workspaceModel() {
  return buildWorkspace({
    familyAccounts: { access: 'ok', rows: [
      { fid: 7, aaid: 'AG1', product: 'Netflix', due_date: '2026-12-05', paid_status: 'Unpaid', slots_total: 5, slots_taken: 1, slot_1: 'C1', password: SECRET },
      { fid: 8, product: 'Spotify', due_date: '2026-04-05', paid_status: 'Unpaid', slots_total: 5, slots_taken: 0 },
    ] },
    accountAgents: { access: 'ok', rows: [{ aaid: 'AG1', name: 'Twaambo Banda' }] },
    customers: { access: 'ok', rows: [
      { cid: 'C1', name: 'Amara Banda', phone: '0977000111', products: ['Netflix'], status: 'CONNECTED', total_spent: 1500, due_date: '2026-12-01' },
      { cid: 'C2', name: 'Lombe Phiri', phone: '', products: ['Spotify'], status: 'DISCONNECTED', total_spent: 40, due_date: '2026-04-01' },
    ] },
    orders: { access: 'ok', rows: [{ oid: 'O1', date: '2026-11-08', amount: 120, product: 'Netflix', months: 1, cid: 'C1', status: 'CONNECTED' }] },
    expenses: { access: 'ok', rows: [{ id: 4, date: '2026-11-04', amount: 30, category: 'Airtime', status: 'Paid', payee: 'Airtel' }] },
    marketing: { access: 'ok', rows: [{ id: 3, date: '2026-12-01', channel: 'Meta', campaign: 'December renewals', hook_used: 'Renew before Friday', cta_used: '' }] },
    marketingSpend: { access: 'ok', rows: [{ id: 1, date: '2026-10-01', channel: 'Meta', campaign: 'October', amount: 200, conversions: 4, cac: '' }] },
    products: { access: 'ok', rows: [{ id: 'p1', name: 'Netflix', category: 'streaming', is_shared_plan: true, slots_per_account: 5, price_zmw: null, is_active: true }] },
    bankAccounts: { access: 'ok', rows: [
      { id: 'acct-1', label: 'FNB Lifestart Student (ZMW)', bank: 'FNB Zambia', currency: 'ZMW', account_last4: '1583', opening_balance: 488.7 },
    ] },
    bankTransactions: { access: 'ok', rows: [
      { id: 1, account_id: 'acct-1', txn_date: '2026-11-04', description: 'NETFLIX.COM', reference: 'NF1', amount: -399.75, balance: 88.95, category: 've_provider_subscription', orig_amount_usd: 15.99, fx_rate: 25 },
      { id: 2, account_id: 'acct-1', txn_date: '2026-11-08', description: 'Transfer in', reference: 'IN1', amount: 200, balance: 288.95, category: 'transfer_in' },
    ] },
  }, TODAY)
}

function renderWorkspace(model) {
  return renderToStaticMarkup(createElement(VeWorkspace, { business: { id: 've', name: 'Vidmar Entertainment (VE)' }, model, today: TODAY }))
}

function renderHome(id = 've', books = emptyBooks()) {
  return renderToStaticMarkup(createElement(BusinessHome, { books, businessId: id, onChange: () => { throw new Error('read only') } }))
}

test('the VE pages render mapped records', () => {
  const html = renderWorkspace(workspaceModel())
  for (const title of ['Overview', 'Family Accounts', 'Customers', 'Funds', 'Accounts', 'Budget', 'Marketing']) {
    assert.match(html, new RegExp(`<span>${title}</span></button>`))
  }
  assert.match(html, /Account owner/)
  assert.doesNotMatch(html, /Account \/ Names/)
  assert.match(html, /Amara Banda/)
  assert.doesNotMatch(html, />Amara Banda<\/button>/)
  assert.match(html, /Twaambo Banda/)
  assert.match(html, /Same as owner/)
  assert.match(html, /Account paid/)
  assert.doesNotMatch(html, /Paid status/)
  assert.match(html, /aria-label="Slots for Twaambo Banda, 1\/5"/)
  assert.match(html, /Active \(1\)/)
  assert.match(html, /Inactive \(1\)/)
  assert.match(html, />1\/5</)
  assert.doesNotMatch(html, /1 of 5/)
  assert.match(html, /Received · Oct – Dec 2026/)
  assert.match(html, /Total received/)
  assert.doesNotMatch(html, /role="dialog"/)
  const dialog = renderToStaticMarkup(createElement(FamilyModal, {
    account: {
      id: '7', owner: 'Amara Banda', plan: 'Netflix', slotsTaken: 2, slotsTotal: 5,
      members: [
        { slot: 1, cid: 'C1', name: 'Amara Banda', lastPayment: { date: '2026-11-08', amount: 120 } },
        { slot: 2, cid: 'C2', name: 'Lombe Phiri', lastPayment: null },
      ],
    },
    onClose: () => {},
  }))
  assert.match(dialog, /role="dialog"/)
  assert.match(dialog, /family-modal-title/)
  assert.match(dialog, /Owner · Amara Banda · 2 of 5 slots/)
  assert.match(dialog, /Lombe Phiri/)
  assert.match(dialog, /Slot 2 · No payment recorded/)
  assert.match(dialog, /8 Nov 2026/)
  assert.match(dialog, /class="num"/)
  assert.match(dialog, /ZMW 120\.00/)
  assert.match(html, />Email</)
  assert.match(html, /aria-label="Email not recorded"/)
  assert.match(html, /Finances/)
  assert.match(html, /aria-label="Month strip"/)
  assert.match(html, /Expenses by category/)
  assert.match(html, /aria-label="Daily bars"/)
  assert.match(html, /aria-label="By account"/)
  assert.match(html, /ZMW 1\.5K|ZMW 289|1583/)
  assert.match(html, /1\.5K|ZMW 289/)
  assert.match(html, /aria-label="Operations"/)
  assert.match(html, /aria-label="Clients"/)
  assert.match(html, /Total spent/)
  assert.match(html, /Balance on hand/)
  assert.match(html, /ZMW 288\.95<\/div><div class="stat-desc">Balance on hand/)
  assert.match(html, /ZMW 90\.00<\/div><div class="stat-desc">Profit generated/)
  assert.match(html, /Profit generated/)
  assert.match(html, /ZMW 120\.00/)
  assert.match(html, /ZMW 30\.00/)
  assert.match(html, /ZMW 1,500\.00/)
  assert.match(html, /aria-label="Search customers"/)
  assert.match(html, /aria-label="Customer status"/)
  assert.match(html, /https:\/\/wa\.me\/260977000111\?text=/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /disabled="">WhatsApp/)
  assert.doesNotMatch(html, />Password</)
  assert.match(html, /Expense overview/)
  assert.match(html, /Income overview/)
  assert.match(html, /Expense flow/)
  assert.match(html, /Income flow/)
  assert.match(html, /aria-label="Funds calendar"/)
  assert.match(html, /October 2026/)
  assert.match(html, /December 2026/)
  assert.doesNotMatch(html, /Previous month/)
  assert.match(html, /Account analysis/)
  assert.match(html, /Last payment/)
  assert.match(html, /FNB Lifestart Student \(ZMW\)/)
  assert.match(html, /1583/)
  assert.match(html, /ZMW 288\.95/)
  assert.match(html, /No USD account was returned/)
  assert.match(html, /aria-label="Search transactions"/)
  assert.match(html, /aria-label="USD plan prices"/)
  assert.match(html, /USD 15\.99/)
  assert.doesNotMatch(html, /ZMW 15\.99/)
  assert.match(html, /FX 25\.00/)
  assert.match(html, /aria-label="Current FX rate"/)
  assert.match(html, /25\.00/)
  assert.match(html, /Projected monthly cost/)
  assert.match(html, /Gap against the latest month/)
  assert.doesNotMatch(html, /The tiles are the totals|Where this comes from|Active means the due date/)
  assert.equal((html.match(/November 2026/g) || []).length >= 2, true)
  assert.match(html, /Weekly expense budget/)
  assert.match(html, /Week of 2026-11-02/)
  assert.match(html, /ZMW 30\.00/)
  assert.match(html, /December renewals/)
  assert.match(html, /No scheduled posts yet|December renewals/)
  assert.match(html, /CAC/)
  assert.match(html, /ZMW 50\.00/)
  assert.match(html, /Powered by/)
  assert.match(html, /Vidmar Holdings · VE/)
  assert.equal(html.includes(SECRET), false)
  assert.equal(html.slice(html.lastIndexOf('page-footer')).includes('Vidmar Holdings'), false)
  assert.doesNotMatch(html, /type="submit"|>Save<|>Delete</)
  assert.equal(/\b(draft|demo|sample|placeholder|coming soon)\b/i.test(html), false)
})

test('empty and blocked pages use finished copy', () => {
  const empty = buildWorkspace({
    familyAccounts: { access: 'empty', rows: [] },
    customers: { access: 'blocked', rows: [] },
    orders: { access: 'blocked', rows: [] },
    expenses: { access: 'empty', rows: [] },
    marketing: { access: 'empty', rows: [] },
    marketingSpend: { access: 'blocked', rows: [] },
    products: { access: 'ok', rows: [] },
  }, TODAY)
  const html = renderWorkspace(empty)
  assert.match(html, new RegExp(COPY.familyEmpty))
  assert.match(html, /Received · Oct – Dec 2026/)
  assert.match(html, /class="stat-num">—</)
  assert.match(html, new RegExp(COPY.customersBlocked))
  assert.match(html, new RegExp(COPY.ordersBlocked))
  assert.match(html, new RegExp(COPY.expensesEmpty))
  assert.match(html, new RegExp(COPY.postsEmpty))
  assert.match(html, new RegExp(COPY.cacBlocked))
  assert.match(html, /No bank account connected/)
  assert.match(html, /No ZMW account was returned/)
  const blockedBank = renderWorkspace(buildWorkspace({
    familyAccounts: { access: 'empty', rows: [] },
    customers: { access: 'empty', rows: [] },
    orders: { access: 'empty', rows: [] },
    expenses: { access: 'empty', rows: [] },
    marketing: { access: 'empty', rows: [] },
    marketingSpend: { access: 'empty', rows: [] },
    products: { access: 'empty', rows: [] },
    bankAccounts: { access: 'blocked', rows: [], message: 'permission denied' },
    bankTransactions: { access: 'blocked', rows: [], message: 'permission denied' },
  }, TODAY))
  assert.match(blockedBank, /Bank accounts are not visible to this account/)
  assert.match(blockedBank, /Bank transactions are not visible to this account/)
  assert.doesNotMatch(blockedBank, /No bank account connected/)
  assert.match(html, /No USD account was returned/)
  assert.equal(/\b(draft|demo|sample|placeholder|coming soon)\b/i.test(html), false)
})

test('VE ignores planner entries and every live business uses the same four pages', () => {
  const books = emptyBooks()
  books.entries = [
    { id: 'planner', businessId: 've', kind: 'income', title: 'Planner income must not appear', group: 'Local', amount: 10, date: '2026-11-08', status: 'Pending' },
    { id: 'other', businessId: 'vai', kind: 'income', title: 'Other business must not leak', group: 'Local', amount: 999, date: '2026-11-08', status: 'Pending' },
  ]
  const ve = renderHome('ve', books)
  assert.match(ve, /<span>Marketing<\/span><\/button>/)
  assert.match(ve, new RegExp(COPY.signedOut))
  assert.doesNotMatch(ve, /Planner income must not appear|Other business must not leak/)
  for (const id of ['vai', 'rez', 'bsg', 'vt', 'eunique', 'digital']) {
    const html = renderHome(id, books)
    for (const tab of ['Overview', 'Funds', 'Marketing', 'Budget']) assert.match(html, new RegExp(`<span>${tab}</span></button>`))
    assert.doesNotMatch(html, /<span>Expenses<\/span><\/button>|<span>Income<\/span><\/button>|<span>Counts<\/span><\/button>/)
    assert.doesNotMatch(html, /Planner income must not appear|Other business must not leak|type="submit"/)
    assert.doesNotMatch(html, /No data connected yet|coming soon|placeholder|draft|demo/i)
    assert.match(html, /will appear here/)
    assert.match(html, /Powered by/)
  }
})

test('the shared template paints stubbed rows and a finished empty state', () => {
  const filled = buildAdapterModel('vai', {
    [`finance.invoices.${CORE_BUSINESS_IDS.vai}`]: { access: 'ok', rows: [{ id: 'i1', invoice_number: 'VAI-1', client_name: 'Acme', issue_date: '2026-11-02', due_date: '2026-11-20', total: '2500.00', status: 'sent' }], message: '' },
    'vai.clients': { access: 'ok', rows: [{ id: 'c1', business_name: 'Acme', status: 'active', start_date: '2026-09-01' }], message: '' },
    'vai.prospects': { access: 'empty', rows: [], message: '' },
    'vai.contracts': { access: 'ok', rows: [{ id: 'k1', title: 'Support', status: 'active', end_date: '2026-11-18', monthly_value_zmw: 400 }], message: '' },
    'vai.services': { access: 'empty', rows: [], message: '' },
    [`pms.tasks.${CORE_BUSINESS_IDS.vai}`]: { access: 'empty', rows: [], message: '' },
    [`pms.projects.${CORE_BUSINESS_IDS.vai}`]: { access: 'empty', rows: [], message: '' },
  }, TODAY)
  const html = renderToStaticMarkup(createElement(BusinessWorkspace, { business: { id: 'vai', name: 'Vidmar AI (VAI)', code: 'VAI' }, model: filled, today: TODAY }))
  assert.match(html, /aria-label="Finances"/)
  assert.match(html, /aria-label="Operations"/)
  assert.match(html, /aria-label="Clients"/)
  assert.match(html, /aria-label="Month strip"/)
  assert.match(html, /aria-label="Daily bars"/)
  assert.match(html, /ZMW 2\.5K/)
  assert.match(html, /Acme/)
  assert.match(html, new RegExp(SECTION_EMPTY.budget))
  assert.match(html, new RegExp(SECTION_EMPTY.marketing))
  assert.doesNotMatch(html, /No data connected yet|coming soon|placeholder|\bdemo\b|\bdraft\b/i)
  const empty = renderToStaticMarkup(createElement(BusinessWorkspace, {
    business: { id: 'vt', name: 'Vidmar Transport (VT)', code: 'VT' },
    model: buildAdapterModel('vt', {}, TODAY),
    today: TODAY,
  }))
  for (const sentence of [SECTION_EMPTY.income, SECTION_EMPTY.expenses, SECTION_EMPTY.operations, SECTION_EMPTY.clients, SECTION_EMPTY.funds, SECTION_EMPTY.marketing, SECTION_EMPTY.budget]) {
    assert.match(empty, new RegExp(sentence))
  }
  assert.doesNotMatch(empty, /ZMW 0|No data connected yet|1234/)
  assert.match(empty, /Powered by/)
})

test('activities, inbox, and sms stay on their own screens', () => {
  const data = readFileSync(new URL('./veData.js', import.meta.url), 'utf8')
  assert.equal(data.includes('Vidmar Holdings'), false)
  const activities = renderToStaticMarkup(createElement(ActivitiesBoard, { state: emptyActivities(), onChange: () => {} }))
  assert.match(activities, /Add task/)
  assert.match(activities, /slide-tabs-action/)
  assert.match(activities, /id="new-activity"/)
  assert.match(activities, /hidden=""| hidden/)
  assert.match(activities, /Save activity/)
  assert.match(activities, /Cancel/)
  assert.match(activities, /Save initiative/)
  assert.match(activities, /Save task force item/)
  const shell = renderToStaticMarkup(createElement(Shell, {
    user: findAccount('shadrickvidmar'), view: 'activities', menu: false, setMenu: () => {}, mode: 'businesses', books: emptyBooks(), businessId: 've', title: 'Activities',
    onOpen: () => {}, onLive: () => {}, onBack: () => {}, onBusiness: () => {}, onRole: () => {},
    }, createElement('p', null, 'Activities body')))
  assert.doesNotMatch(shell, /side-user-name/)
  assert.doesNotMatch(shell, /Select reporting period/)
  const businessShell = renderToStaticMarkup(createElement(Shell, {
    user: findAccount('shadrickvidmar'), view: 'business', menu: false, setMenu: () => {}, mode: 'businesses', books: emptyBooks(), businessId: 've', title: 'Vidmar Entertainment (VE)', today: '2026-11-10',
    onOpen: () => {}, onLive: () => {}, onBack: () => {}, onBusiness: () => {}, onRole: () => {},
  }, createElement('p', null, 'Business body')))
  assert.match(businessShell, /Select reporting period/)
  assert.match(businessShell, /Oct – Dec 2026/)
  assert.doesNotMatch(businessShell, /Reporting period · Vidmar Entertainment/)
  const openPeriod = renderToStaticMarkup(createElement(TimeframePopover, { pageTitle: 'Vidmar Entertainment (VE)', today: '2026-11-10', initiallyOpen: true }))
  assert.match(openPeriod, /Reporting period · Vidmar Entertainment \(VE\)/)
  assert.match(openPeriod, /From/)
  assert.match(openPeriod, /<option[^>]*>Dec<\/option>/)
  assert.match(openPeriod, />Cancel</)
  assert.match(openPeriod, />Apply</)
  assert.equal(readFileSync(new URL('./Shell.jsx', import.meta.url), 'utf8').includes('onLogout'), false)
  assert.match(readFileSync(new URL('./Vhpms.jsx', import.meta.url), 'utf8'), /LIVE_VIEWS = new Set\(\[[^\]]*profile/)
  assert.match(shell, /aria-label="Current role"/)
  assert.match(shell, /aria-label="Profile"/)
  assert.match(shell, /aria-label="Collapse sidebar"/)
  assert.match(shell, /aria-controls="sidebar"/)
  assert.match(shell, /aria-expanded="true"/)
  const board = readFileSync(new URL('./ActivitiesBoard.jsx', import.meta.url), 'utf8')
  assert.equal(board.includes('VeWorkspace'), false)
  assert.equal(board.includes('family_accounts'), false)
  for (const name of ['InboxSms.jsx', 'activities.js', 'sms.js', 'smsClient.js']) {
    const source = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
    assert.equal(source.includes('VeWorkspace'), false)
    assert.equal(source.includes('ve-workspace'), false)
    assert.equal(source.includes('family_accounts'), false)
    assert.equal(source.includes('Add task'), false)
  }
})

test('the sign-in slideshow stays sharp and the credentials card is frosted', () => {
  const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
  assert.match(css, /\.login-slides img[\s\S]*object-fit: cover/)
  assert.match(css, /-webkit-backdrop-filter: blur\(18px\) saturate\(140%\)/)
  assert.match(css, /backdrop-filter: blur\(18px\) saturate\(140%\)/)
  assert.equal(css.includes('blur(28px)'), false)
  assert.equal(css.includes('scale(1.12)'), false)
  assert.equal(css.includes('inset: -12%'), false)
})
