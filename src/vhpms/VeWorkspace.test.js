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
  if (name.startsWith('react') || name.startsWith('@supabase/')) return `from "file://${require.resolve(name)}"`
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
  }, TODAY)
}

function renderWorkspace(model) {
  return renderToStaticMarkup(createElement(VeWorkspace, { business: { id: 've', name: 'Vidmar Entertainment (VE)' }, model, today: TODAY }))
}

function renderHome(id = 've', books = emptyBooks()) {
  return renderToStaticMarkup(createElement(BusinessHome, { books, businessId: id, onChange: () => { throw new Error('read only') } }))
}

test('the six VE pages render mapped records', () => {
  const html = renderWorkspace(workspaceModel())
  for (const title of ['Overview', 'Family Accounts', 'Customers', 'Funds', 'Budget', 'Marketing']) {
    assert.match(html, new RegExp(`role="tab"[^>]*>${title}</button>`))
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
  assert.equal(/\b(draft|demo|sample|placeholder|coming soon)\b/i.test(html), false)
})

test('VE ignores planner entries and other businesses keep their books', () => {
  const books = emptyBooks()
  books.entries = [
    { id: 'planner', businessId: 've', kind: 'income', title: 'Planner income must not appear', group: 'Local', amount: 10, date: '2026-11-08', status: 'Pending' },
    { id: 'other', businessId: 'vai', kind: 'income', title: 'Other business must not leak', group: 'Local', amount: 999, date: '2026-11-08', status: 'Pending' },
  ]
  const ve = renderHome('ve', books)
  assert.match(ve, /role="tab"[^>]*>Marketing<\/button>/)
  assert.match(ve, new RegExp(COPY.signedOut))
  assert.doesNotMatch(ve, /Planner income must not appear|Other business must not leak/)
  const vai = renderHome('vai', books)
  assert.match(vai, />Expenses<\/button>/)
  assert.match(vai, />Income<\/button>/)
  assert.match(vai, />Counts<\/button>/)
  assert.match(vai, /type="submit"/)
  assert.match(vai, /Other business must not leak/)
  assert.doesNotMatch(vai, /Family Accounts|Weekly expense budget/)
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
