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

const bundle = await build({
  stdin: { contents: "export { BusinessHome } from './src/vhpms/BusinessHome.jsx'\nexport { default as VeWorkspace } from './src/vhpms/VeWorkspace.jsx'\nexport { default as ActivitiesBoard } from './src/vhpms/ActivitiesBoard.jsx'\nexport { default as Shell } from './src/vhpms/Shell.jsx'", resolveDir: process.cwd() },
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
const { BusinessHome, VeWorkspace, ActivitiesBoard, Shell } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const TODAY = '2026-11-08'
const SECRET = 'super-secret-value'

function workspaceModel() {
  return buildWorkspace({
    familyAccounts: { access: 'ok', rows: [
      { fid: 7, product: 'Netflix', due_date: '2026-12-05', paid_status: 'Unpaid', slots_total: 5, slots_taken: 1, slot_1: 'C1', password: SECRET },
      { fid: 8, product: 'Spotify', due_date: '2026-04-05', paid_status: 'Unpaid', slots_total: 5, slots_taken: 0 },
    ] },
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
  assert.match(html, /Account \/ Names/)
  assert.match(html, /Amara Banda/)
  assert.match(html, />Email</)
  assert.match(html, /aria-label="Email not recorded"/)
  assert.match(html, /Total spent/)
  assert.match(html, /Balance on hand/)
  assert.match(html, /Profit generated/)
  assert.match(html, /ZMW 120\.00/)
  assert.match(html, /ZMW 90\.00/)
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
  assert.match(html, /Gap is actual ve_provider_subscription outflow/)
  assert.match(html, /Where this comes from/)
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
  assert.match(html, new RegExp(COPY.customersBlocked))
  assert.match(html, new RegExp(COPY.ordersBlocked))
  assert.match(html, new RegExp(COPY.expensesEmpty))
  assert.match(html, new RegExp(COPY.postsEmpty))
  assert.match(html, new RegExp(COPY.cacBlocked))
  assert.match(html, /No ZMW account was returned/)
  assert.match(html, /No USD account was returned/)
  assert.equal(/\b(draft|demo|sample|placeholder|coming soon)\b/i.test(html), false)
})

test('VE ignores planner entries and other businesses keep their books', () => {
  const books = emptyBooks()
  books.entries = [
    { id: 'planner', businessId: 've', kind: 'income', title: 'Planner income must not appear', group: 'Local', amount: 10, date: '2026-11-08', status: 'Pending' },
    { id: 'other', businessId: 'vai', kind: 'income', title: 'Other business must not leak', group: 'Local', amount: 999, date: '2026-11-08', status: 'Pending' },
  ]
  const ve = renderHome('ve', books)
  assert.match(ve, /<span>Marketing<\/span><\/button>/)
  assert.match(ve, new RegExp(COPY.signedOut))
  assert.doesNotMatch(ve, /Planner income must not appear|Other business must not leak/)
  const vai = renderHome('vai', books)
  assert.match(vai, /<span>Overview<\/span><\/button>/)
  assert.match(vai, /<span>Funds<\/span><\/button>/)
  assert.match(vai, /<span>Marketing<\/span><\/button>/)
  assert.match(vai, /<span>Budget<\/span><\/button>/)
  assert.match(vai, /<span>Expenses<\/span><\/button>/)
  assert.match(vai, /<span>Income<\/span><\/button>/)
  assert.match(vai, /<span>Counts<\/span><\/button>/)
  assert.match(vai, /No data connected yet/)
  assert.match(vai, /type="submit"/)
  assert.match(vai, /Other business must not leak/)
  assert.doesNotMatch(vai, /Family Accounts|Weekly expense budget|Planner income/)
})

test('activities, inbox, and sms stay on their own screens', () => {
  const data = readFileSync(new URL('./veData.js', import.meta.url), 'utf8')
  assert.equal(data.includes('Vidmar Holdings'), false)
  const activities = renderToStaticMarkup(createElement(ActivitiesBoard, { state: emptyActivities(), onChange: () => {} }))
  assert.doesNotMatch(activities, /Add task/)
  assert.match(activities, /id="new-activity"/)
  assert.match(activities, /hidden=""| hidden/)
  assert.match(activities, /Save activity/)
  assert.match(activities, /Save initiative/)
  assert.match(activities, /Save task force item/)
  const shell = renderToStaticMarkup(createElement(Shell, {
    user: findAccount('shadrickvidmar'), view: 'activities', menu: false, setMenu: () => {}, mode: 'businesses', books: emptyBooks(), businessId: 've', title: 'Activities',
    onOpen: () => {}, onLive: () => {}, onBack: () => {}, onBusiness: () => {}, onLogout: () => {}, onRole: () => {},
    headerAction: createElement('button', { type: 'button', className: 'btn btn-primary' }, 'Add task'),
  }, createElement('p', null, 'Activities body')))
  assert.match(shell, /Add task/)
  assert.match(shell, /aria-label="Profile"/)
  const shellSource = readFileSync(new URL('./Shell.jsx', import.meta.url), 'utf8')
  assert.match(shellSource, /Escape/)
  assert.match(shellSource, /mousedown/)
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
