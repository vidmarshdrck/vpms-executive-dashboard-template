import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { findAccount, managementLinks, WORKSPACE_LINKS, invoiceMakerUrl, canSee } from './directory.js'
import { emptyBooks } from './books.js'
import { emptyState } from './model.js'
import { freshScorecard } from './score.js'
import { emptyOwnerScorecards, parseOwnerScorecards, saveOwnerScorecard } from './ownerScorecards.js'
import { OPERATIONS_ROBOTS, robotHttpUrl, robotStatus } from './operationsRobots.js'

const require = createRequire(import.meta.url)
const bundle = await build({
  stdin: {
    contents: [
      "export { default as Shell } from './src/vhpms/Shell.jsx'",
      "export { default as OperationsPage } from './src/vhpms/OperationsPage.jsx'",
      "export { default as ScorecardsPage } from './src/vhpms/ScorecardsPage.jsx'",
      "export { default as SearchField } from './src/vhpms/SearchField.jsx'",
      "export { default as WorkspaceViews } from './src/vhpms/WorkspaceViews.jsx'",
    ].join('\n'),
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  packages: 'external',
  loader: { '.css': 'empty' },
})
const code = bundle.outputFiles[0].text.replace(/from "([^"]+)"/g, (_, name) => {
  if (name.startsWith('react') || name.startsWith('@supabase/') || name === 'lucide-react') return `from "file://${require.resolve(name)}"`
  return `from "${name}"`
})
const { Shell, OperationsPage, ScorecardsPage, SearchField, WorkspaceViews } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const owner = findAccount('shadrickvidmar')

test('management reads Dashboard, Departments, KPI, Scorecards and HR is not a top-level item', () => {
  assert.deepEqual(managementLinks(owner).map((link) => link.label), ['Dashboard', 'Departments', 'KPI', 'Scorecards'])
  assert.equal(managementLinks(owner).some((link) => /GM Dashboard|Human Resources/.test(link.label)), false)
  assert.deepEqual(WORKSPACE_LINKS.map((link) => link.label), ['Operations', 'Calendar'])
  for (const id of ['tasks', 'projects', 'priorities', 'receipts', 'sources']) {
    assert.equal(canSee(owner, id), false)
  }
  assert.equal(canSee(owner, 'operations'), true)
  assert.equal(canSee(owner, 'calendar'), true)
  assert.equal(canSee(owner, 'scorecards'), true)
  assert.equal(canSee(owner, 'kpi'), true)
})

test('invoice maker is an external address and stays hidden when unset', () => {
  assert.equal(invoiceMakerUrl({}), '')
  assert.equal(invoiceMakerUrl({ VITE_VPMS_INVOICE_URL: '   ' }), '')
  assert.equal(invoiceMakerUrl({ VITE_VPMS_INVOICE_URL: 'javascript:alert(1)' }), '')
  assert.equal(invoiceMakerUrl({ VITE_VPMS_INVOICE_URL: ' https://invoices.example/app ' }), 'https://invoices.example/app')
  const hidden = renderToStaticMarkup(createElement(Shell, {
    user: owner, view: 'gm', menu: false, setMenu: () => {}, mode: 'management', books: emptyBooks(), businessId: 've', title: 'Dashboard', invoiceUrl: '',
    onOpen: () => {}, onLive: () => {}, onBack: () => {}, onBusiness: () => {}, onRole: () => {},
  }, createElement('p', null, 'Body')))
  assert.equal(hidden.includes('Invoice maker'), false)
  assert.equal(hidden.includes('Vidmar Holdings'), false)
  assert.equal(hidden.includes('GM Dashboard'), false)
  assert.equal(hidden.includes('VHPMS'), false)
  assert.match(hidden, />VPMS</)
  assert.match(hidden, /class="page-title">Dashboard</)
  const shown = renderToStaticMarkup(createElement(Shell, {
    user: owner, view: 'gm', menu: false, setMenu: () => {}, mode: 'management', books: emptyBooks(), businessId: 've', title: 'Dashboard', invoiceUrl: 'https://invoices.example/app',
    onOpen: () => {}, onLive: () => {}, onBack: () => {}, onBusiness: () => {}, onRole: () => {},
  }, createElement('p', null, 'Body')))
  assert.match(shown, /href="https:\/\/invoices\.example\/app"/)
  assert.match(shown, /target="_blank"/)
  assert.match(shown, /Invoice maker/)
  const labels = [...shown.matchAll(/class="nav-label">([^<]+)/g)].map((match) => match[1])
  assert.deepEqual(labels.slice(0, 4), ['Dashboard', 'Departments', 'KPI', 'Scorecards'])
  assert.deepEqual(labels.filter((label) => label === 'Operations' || label === 'Calendar' || label === 'Invoice maker'), ['Operations', 'Calendar', 'Invoice maker'])
})

test('live workspace lists Inbox, Activities, then Mobile Money', () => {
  const html = renderToStaticMarkup(createElement(Shell, {
    user: owner, view: 'activities', menu: false, setMenu: () => {}, mode: 'businesses', books: emptyBooks(), businessId: 've', title: 'Activities', invoiceUrl: '',
    onOpen: () => {}, onLive: () => {}, onBack: () => {}, onBusiness: () => {}, onRole: () => {},
  }, createElement('p', null, 'Activities body')))
  const labels = [...html.matchAll(/class="nav-label">([^<]+)/g)].map((match) => match[1])
  assert.deepEqual(labels.slice(0, 3), ['Inbox', 'Activities', 'Mobile Money'])
  assert.equal(html.includes('SMS Transactions'), false)
  const source = readFileSync(new URL('./Vhpms.jsx', import.meta.url), 'utf8')
  assert.equal((source.match(/<ActivitiesBoard/g) || []).length, 1)
})

test('operations robots stay disconnected until a watch or start address is set', () => {
  assert.equal(OPERATIONS_ROBOTS.length, 5)
  assert.deepEqual(OPERATIONS_ROBOTS.map((robot) => robot.status), ['Not connected', 'Not connected', 'Not connected', 'Not connected', 'Not connected'])
  assert.equal(robotHttpUrl(''), '')
  assert.equal(robotHttpUrl('not a url'), '')
  assert.equal(robotStatus({ status: '' }), 'Not connected')
  const html = renderToStaticMarkup(createElement(OperationsPage))
  assert.equal((html.match(/Not connected/g) || []).length, 5)
  assert.equal((html.match(/disabled="">Watch/g) || []).length, 5)
  assert.equal((html.match(/disabled="">Start/g) || []).length, 5)
  assert.equal(/\b(draft|demo|sample|placeholder|preview|will appear here)\b/i.test(html), false)
  const ready = renderToStaticMarkup(createElement(OperationsPage, { robots: [{ name: 'Valet', status: 'Ready', watchUrl: 'https://watch.example/valet', startAction: 'https://start.example/valet' }] }))
  assert.match(ready, /href="https:\/\/watch\.example\/valet"/)
  assert.match(ready, /href="https:\/\/start\.example\/valet"/)
  assert.match(ready, />Ready</)
})

test('scorecards persist a department or user with metric targets', () => {
  assert.deepEqual(parseOwnerScorecards('nope'), emptyOwnerScorecards())
  const saved = saveOwnerScorecard(emptyOwnerScorecards(), {
    name: 'Quarter targets',
    subjectType: 'department',
    subjectId: 'hr',
    metrics: [{ name: 'Retention', target: '95%' }],
  })
  assert.equal(saved.cards.length, 1)
  assert.equal(saved.cards[0].name, 'Quarter targets')
  assert.equal(saved.cards[0].metrics[0].target, '95%')
  const edited = saveOwnerScorecard(saved, {
    name: 'Quarter targets',
    subjectType: 'user',
    subjectId: 'nehemiah',
    metrics: [{ id: saved.cards[0].metrics[0].id, name: 'Retention', target: '97%' }],
  }, saved.cards[0].id)
  assert.equal(edited.cards.length, 1)
  assert.equal(edited.cards[0].subjectType, 'user')
  assert.equal(parseOwnerScorecards(JSON.stringify(edited)).cards[0].subjectId, 'nehemiah')
  assert.throws(() => saveOwnerScorecard(emptyOwnerScorecards(), { name: '', subjectType: 'department', subjectId: 'hr', metrics: [{ name: 'Retention', target: '95%' }] }))
  const empty = renderToStaticMarkup(createElement(ScorecardsPage, {
    departments: freshScorecard().departments.filter((department) => department.code !== 'gm'),
    users: [findAccount('nehemiah')],
    cards: emptyOwnerScorecards(),
    onChange: () => {},
  }))
  assert.match(empty, /No scorecards yet/)
  assert.match(empty, /Create scorecard/)
  assert.equal(/\b(draft|demo|sample|placeholder|preview|will appear here)\b/i.test(empty), false)
  const filled = renderToStaticMarkup(createElement(ScorecardsPage, {
    departments: [{ code: 'hr', name: 'Human Resource' }],
    users: [findAccount('nehemiah')],
    cards: edited,
    onChange: () => {},
  }))
  assert.match(filled, /Quarter targets/)
  assert.match(filled, /Nehemiah/)
  assert.match(filled, /Target 97%/)
})

test('calendar keeps weekly priorities and search fields use one control', () => {
  const html = renderToStaticMarkup(createElement(WorkspaceViews, { view: 'calendar', state: emptyState(), save: () => {} }))
  assert.match(html, /Weekly priorities/)
  assert.match(html, /aria-label="Weekly priorities"/)
  assert.match(html, /aria-label="Monthly calendar"/)
  assert.equal(html.includes('Vidmar Holdings'), false)
  const search = renderToStaticMarkup(createElement(SearchField, { id: 'find-customers', label: 'Search customers', placeholder: 'Search customers', value: 'Amina', onChange: () => {} }))
  assert.match(search, /placeholder="Search customers"/)
  assert.match(search, /aria-label="Search customers"/)
  assert.match(search, /aria-label="Clear search"/)
  assert.match(search, /search-field/)
  const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
  assert.match(css, /\.search-field input\[type="search"\]:focus[\s\S]*#1454c0/)
})
