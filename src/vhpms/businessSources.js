import { categoryShare } from './fundsMonth.js'
import { COPY, createVeClient, parseAmount, readScopedTable, weeklyBudget } from './veData.js'

export const CORE_BUSINESS_IDS = {
  ve: 'fecb8ec7-3920-479c-9277-eff4ffdbd676',
  vai: '33fdf7a5-cfae-4b2a-9b8c-22e4c5c44e25',
  rez: '11edb642-f28b-4012-885b-518af6523f3e',
  bsg: '562712ff-cfd1-4197-8b65-ea1bacfce31f',
  digital: '948cc95e-2435-4077-9265-a90f352cbfca',
}

const STAFF_ONLY = 'Owner SELECT is missing. Policies allow core.is_staff or core.is_ceo for that business, and this owner has no core.memberships row.'
const NO_POLICY = 'Owner SELECT is missing. Row level security is on and there is no SELECT policy.'

export function needsTable(table) {
  return `No data connected yet. Needs ${table}.`
}

function isoDate(value) {
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

function money(value) {
  const amount = parseAmount(value)
  return amount == null ? 0 : amount
}

function dayDistance(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const start = Date.parse(`${today}T00:00:00Z`)
  const value = Date.parse(`${date}T00:00:00Z`)
  return Math.round((value - start) / 86400000)
}

export function isActiveStatus(status) {
  return /^(active|current|live|connected|signed|won|occupied|in stock|listed)$/i.test(String(status || '').trim())
}

export function isInactiveStatus(status) {
  return /^(inactive|ended|lost|churned|disconnected|cancelled|canceled|void|rejected|sold)$/i.test(String(status || '').trim())
}

export function clientCounts(clients, today) {
  return {
    active: clients.filter((row) => isActiveStatus(row.status)).length,
    inactive: clients.filter((row) => isInactiveStatus(row.status)).length,
    newer: clients.filter((row) => {
      const days = dayDistance(row.joined, today)
      return days != null && days <= 0 && days >= -30
    }).length,
    renewals: clients.filter((row) => {
      const days = dayDistance(row.due, today)
      return days != null && days >= 0 && days <= 30
    }).length,
  }
}

export function upcomingItems(rows, today, horizon = 30) {
  return (rows || []).filter((row) => {
    const days = dayDistance(row.due, today)
    return days != null && days >= 0 && days <= horizon
  }).sort((a, b) => a.due.localeCompare(b.due))
}

function read(schema, table, columns, order, filters = [], rls = STAFF_ONLY) {
  const key = `${schema}.${table}${filters.length ? `.${filters.map((filter) => filter.value).join('.')}` : ''}`
  return { key, schema, table, columns, order, filters, rls }
}

function invoiceRead(businessId) {
  return read('finance', 'invoices', 'id,invoice_number,client_name,issue_date,due_date,total,status', 'issue_date', [{ op: 'eq', column: 'business_id', value: CORE_BUSINESS_IDS[businessId] }])
}

function taskRead(businessId) {
  return read('pms', 'tasks', 'id,title,status,due_at,priority', 'due_at', [{ op: 'eq', column: 'business_id', value: CORE_BUSINESS_IDS[businessId] }])
}

function projectRead(businessId) {
  return read('pms', 'projects', 'id,title,status,due_date,priority', 'due_date', [{ op: 'eq', column: 'business_id', value: CORE_BUSINESS_IDS[businessId] }])
}

function unconnected(id) {
  const table = (slot) => `public.${id}_${slot}`
  return {
    id,
    reads: [],
    income: { needs: table('income') },
    expenses: { needs: table('expenses') },
    customers: { needs: table('customers') },
    marketing: { needs: table('marketing') },
    operations: { needs: table('operations') },
  }
}

const ADAPTERS = {
  vai: {
    id: 'vai',
    reads: [
      read('vai', 'clients', 'id,business_name,status,start_date', 'business_name'),
      read('vai', 'prospects', 'id,business_name,pipeline_stage,created_at', 'created_at'),
      read('vai', 'contracts', 'id,title,status,start_date,end_date,monthly_value_zmw', 'start_date'),
      read('vai', 'services', 'id,name,is_active', 'name'),
      invoiceRead('vai'),
      taskRead('vai'),
      projectRead('vai'),
    ],
    income: { keys: ['finance.invoices.' + CORE_BUSINESS_IDS.vai], map: 'invoices' },
    expenses: { needs: 'a VAI expense table (none exists in the vai schema)' },
    customers: { keys: ['vai.clients', 'vai.prospects'], map: 'vaiClients' },
    marketing: { needs: 'a VAI marketing table (none exists in the vai schema)' },
    operations: { keys: ['vai.contracts', 'vai.services', 'pms.tasks.' + CORE_BUSINESS_IDS.vai, 'pms.projects.' + CORE_BUSINESS_IDS.vai], map: 'vaiOps' },
  },
  rez: {
    id: 'rez',
    reads: [
      read('rez', 'listings', 'id,title,status,leaving_date,city', 'title'),
      read('rez', 'properties', 'id,name,verification_status,verification_expires_at', 'name'),
      read('rez', 'inspection_tasks', 'id,title,status,visit_date', 'visit_date'),
      read('rez', 'enquiries', 'id,name,status,created_at', 'created_at'),
      read('rez', 'applications', 'id,full_name,status,move_in_date', 'move_in_date'),
      invoiceRead('rez'),
      taskRead('rez'),
    ],
    income: { keys: ['finance.invoices.' + CORE_BUSINESS_IDS.rez], map: 'invoices' },
    expenses: { needs: 'a REZ expense table (none exists in the rez schema)' },
    customers: { keys: ['rez.enquiries', 'rez.applications'], map: 'rezClients' },
    marketing: { needs: 'a REZ marketing table (none exists in the rez schema)' },
    operations: { keys: ['rez.listings', 'rez.properties', 'rez.inspection_tasks', 'pms.tasks.' + CORE_BUSINESS_IDS.rez], map: 'rezOps' },
  },
  bsg: {
    id: 'bsg',
    reads: [
      read('public', 'phone_inventory', 'id,model,storage,quantity,sold_status,price', 'model', [], NO_POLICY),
      read('public', 'iphone_price_list', 'id,model,quantity', 'model', [], NO_POLICY),
      invoiceRead('bsg'),
      taskRead('bsg'),
    ],
    income: { keys: ['finance.invoices.' + CORE_BUSINESS_IDS.bsg], map: 'invoices' },
    expenses: { needs: 'a BSG expense table (public.profit_tracking is a VE category rollup, not BSG)' },
    customers: { needs: 'a BSG customer table (public.leads has no business column)' },
    marketing: { needs: 'a BSG marketing table (none exists)' },
    operations: { keys: ['public.phone_inventory', 'public.iphone_price_list', 'pms.tasks.' + CORE_BUSINESS_IDS.bsg], map: 'bsgOps' },
  },
  digital: {
    id: 'digital',
    reads: [
      read('commerce', 'sales', 'id,sold_at,marketplace,external_order_id,amount_received_zmw,buyer_currency', 'sold_at'),
      read('commerce', 'digital_products', 'id,title,stage', 'title'),
      read('commerce', 'marketplace_listings', 'id,title,status,price,currency', 'title'),
      taskRead('digital'),
    ],
    income: { keys: ['commerce.sales'], map: 'sales' },
    expenses: { needs: 'a Digital Products expense table (commerce.digital_products.cost_to_make is a unit cost, not a dated spend)' },
    customers: { needs: 'a Digital Products customer table (commerce.sales has no buyer name)' },
    marketing: { needs: 'a Digital Products marketing table (none exists in commerce)' },
    operations: { keys: ['commerce.digital_products', 'commerce.marketplace_listings', 'pms.tasks.' + CORE_BUSINESS_IDS.digital], map: 'digitalOps' },
  },
}

export function adapterFor(businessId) {
  return ADAPTERS[businessId] || unconnected(businessId)
}

export function listAdapters() {
  return ['ve', 'vai', 'rez', 'bsg', 'vt', 'eunique', 'digital']
}

function sourceFor(sources, key) {
  return sources[key] || { access: 'empty', rows: [], message: '' }
}

function rlsFor(reads, key) {
  return (reads || []).find((item) => item.key === key)?.rls || STAFF_ONLY
}

function resolveSlot(slot, sources, reads = []) {
  if (!slot) return { access: 'needs', rows: [], note: needsTable('a table for this section') }
  if (slot.needs) return { access: 'needs', rows: [], note: needsTable(slot.needs) }
  const parts = slot.keys.map((key) => ({ key, ...sourceFor(sources, key) }))
  const signedOut = parts.filter((part) => part.access === 'signed-out' || part.access === 'unconfigured')
  const blocked = parts.filter((part) => part.access === 'blocked' || part.access === 'error')
  const readable = parts.filter((part) => part.access === 'ok' || part.access === 'empty')
  if (!readable.length && signedOut.length) {
    const access = signedOut[0].access
    return { access, rows: [], note: access === 'unconfigured' ? 'Supabase is not configured for this sign-in.' : 'Sign in with Supabase to load these records.' }
  }
  if (!readable.length && blocked.length) {
    const detail = blocked.find((part) => part.message)?.message
    return { access: blocked.some((part) => part.access === 'blocked') ? 'blocked' : 'error', rows: [], note: `${detail ? `${detail}. ` : ''}${rlsFor(reads, blocked[0].key)}` }
  }
  const rows = readable.flatMap((part) => (part.access === 'ok' ? part.rows : []))
  const hidden = blocked.length ? `Some connected tables are not visible. ${rlsFor(reads, blocked[0].key)}` : ''
  return { access: rows.length ? 'ok' : 'empty', rows, note: hidden }
}

function mapInvoices(rows) {
  return rows.map((row) => ({
    id: `invoice-${row.id}`,
    date: isoDate(row.issue_date),
    due: isoDate(row.due_date),
    kind: 'income',
    title: String(row.invoice_number || row.client_name || 'Invoice'),
    category: String(row.status || '').trim() || 'Invoice',
    amount: money(row.total),
  }))
}

function mapSales(rows) {
  return rows.map((row) => ({
    id: `sale-${row.id}`,
    date: isoDate(row.sold_at),
    kind: 'income',
    title: String(row.external_order_id || row.marketplace || 'Sale'),
    category: String(row.marketplace || '').trim() || 'Sale',
    amount: money(row.amount_received_zmw),
  }))
}

function mapVaiClients(rows, key) {
  if (key === 'vai.prospects') {
    return rows.map((row) => ({
      id: `prospect-${row.id}`,
      name: String(row.business_name || '').trim() || 'Unnamed prospect',
      status: String(row.pipeline_stage || '').trim() || 'Unspecified',
      joined: isoDate(row.created_at),
      due: '',
    }))
  }
  return rows.map((row) => ({
    id: `client-${row.id}`,
    name: String(row.business_name || '').trim() || 'Unnamed client',
    status: String(row.status || '').trim() || 'Unspecified',
    joined: isoDate(row.start_date),
    due: '',
  }))
}

function mapRezClients(rows, key) {
  if (key === 'rez.applications') {
    return rows.map((row) => ({
      id: `application-${row.id}`,
      name: String(row.full_name || '').trim() || 'Unnamed applicant',
      status: String(row.status || '').trim() || 'Unspecified',
      joined: '',
      due: isoDate(row.move_in_date),
    }))
  }
  return rows.map((row) => ({
    id: `enquiry-${row.id}`,
    name: String(row.name || '').trim() || 'Unnamed enquiry',
    status: String(row.status || '').trim() || 'Unspecified',
    joined: isoDate(row.created_at),
    due: '',
  }))
}

function mapOps(rows, key) {
  if (key === 'vai.services') {
    return rows.map((row) => ({ id: `service-${row.id}`, title: String(row.name || 'Service'), status: row.is_active === false ? 'Inactive' : 'Active', due: '', amount: null, unit: '' }))
  }
  if (key === 'vai.contracts') {
    return rows.map((row) => ({ id: `contract-${row.id}`, title: String(row.title || 'Contract'), status: String(row.status || 'Unspecified'), due: isoDate(row.end_date), amount: money(row.monthly_value_zmw), unit: 'ZMW' }))
  }
  if (key.startsWith('pms.tasks')) {
    return rows.map((row) => ({ id: `task-${row.id}`, title: String(row.title || 'Task'), status: String(row.status || 'Unspecified'), due: isoDate(row.due_at), amount: null, unit: '' }))
  }
  if (key.startsWith('pms.projects')) {
    return rows.map((row) => ({ id: `project-${row.id}`, title: String(row.title || 'Project'), status: String(row.status || 'Unspecified'), due: isoDate(row.due_date), amount: null, unit: '' }))
  }
  if (key === 'rez.listings') {
    return rows.map((row) => ({ id: `listing-${row.id}`, title: String(row.title || 'Listing'), status: String(row.status || 'Unspecified'), due: isoDate(row.leaving_date), amount: null, unit: '' }))
  }
  if (key === 'rez.properties') {
    return rows.map((row) => ({ id: `property-${row.id}`, title: String(row.name || 'Property'), status: String(row.verification_status || 'Unspecified'), due: isoDate(row.verification_expires_at), amount: null, unit: '' }))
  }
  if (key === 'rez.inspection_tasks') {
    return rows.map((row) => ({ id: `inspection-${row.id}`, title: String(row.title || 'Inspection'), status: String(row.status || 'Unspecified'), due: isoDate(row.visit_date), amount: null, unit: '' }))
  }
  if (key === 'public.phone_inventory') {
    return rows.map((row) => ({ id: `phone-${row.id}`, title: [row.model, row.storage].filter(Boolean).join(' ') || 'Phone', status: row.sold_status ? 'Sold' : 'In stock', due: '', amount: Number(row.quantity) || 0, unit: 'qty' }))
  }
  if (key === 'public.iphone_price_list') {
    return rows.map((row) => {
      const quantity = Number(String(row.quantity || '').replace(/[^\d.]/g, ''))
      return { id: `price-${row.id}`, title: String(row.model || 'Model'), status: 'Listed', due: '', amount: Number.isFinite(quantity) && quantity > 0 ? quantity : null, unit: 'qty' }
    })
  }
  if (key === 'commerce.digital_products') {
    return rows.map((row) => ({ id: `product-${row.id}`, title: String(row.title || 'Product'), status: String(row.stage || 'Unspecified'), due: '', amount: null, unit: '' }))
  }
  if (key === 'commerce.marketplace_listings') {
    return rows.map((row) => ({ id: `listing-${row.id}`, title: String(row.title || 'Listing'), status: String(row.status || 'Unspecified'), due: '', amount: parseAmount(row.price), unit: String(row.currency || 'ZMW') }))
  }
  return []
}

function mapSlotRows(slot, sources) {
  if (slot.needs) return []
  return slot.keys.flatMap((key) => {
    const source = sourceFor(sources, key)
    if (source.access !== 'ok') return []
    if (slot.map === 'invoices') return mapInvoices(source.rows)
    if (slot.map === 'sales') return mapSales(source.rows)
    if (slot.map === 'vaiClients') return mapVaiClients(source.rows, key)
    if (slot.map === 'rezClients') return mapRezClients(source.rows, key)
    return mapOps(source.rows, key)
  })
}

function financeSide(slot, sources, kind, reads) {
  const resolved = resolveSlot(slot, sources, reads)
  if (resolved.access === 'needs' || resolved.access === 'blocked' || resolved.access === 'error' || resolved.access === 'signed-out' || resolved.access === 'unconfigured') {
    return { access: resolved.access, rows: [], note: resolved.note }
  }
  const rows = mapSlotRows(slot, sources).map((row) => ({ ...row, kind }))
  return { access: rows.length ? 'ok' : 'empty', rows, note: resolved.note }
}

export function buildAdapterModel(businessId, sources = {}, today) {
  const adapter = adapterFor(businessId)
  const income = financeSide(adapter.income, sources, 'income', adapter.reads)
  const expenses = financeSide(adapter.expenses, sources, 'expense', adapter.reads)
  const customers = resolveSlot(adapter.customers, sources, adapter.reads)
  const marketing = resolveSlot(adapter.marketing, sources, adapter.reads)
  const operations = resolveSlot(adapter.operations, sources, adapter.reads)
  const clientRows = adapter.customers.needs ? [] : mapSlotRows(adapter.customers, sources)
  const operationRows = adapter.operations.needs ? [] : mapSlotRows(adapter.operations, sources)
  const spent = expenses.access === 'ok' || expenses.access === 'empty' ? expenses.rows.reduce((sum, row) => sum + row.amount, 0) : null
  const earned = income.access === 'ok' || income.access === 'empty' ? income.rows.reduce((sum, row) => sum + row.amount, 0) : null
  const balance = spent != null && earned != null ? earned - spent : null
  return {
    businessId,
    today,
    finance: { expenses: spent, income: earned, balance, profit: balance },
    incomeNote: income.note,
    expenseNote: expenses.note,
    incomeRows: income.rows,
    expenseRows: expenses.rows,
    clients: clientRows,
    clientsNote: customers.note,
    counts: clientCounts(clientRows, today),
    operations: operationRows,
    operationsNote: operations.note,
    upcoming: upcomingItems([...operationRows, ...clientRows.filter((row) => row.due).map((row) => ({ id: row.id, title: row.name, due: row.due }))], today),
    posts: [],
    spend: [],
    marketingNote: marketing.note || (marketing.access === 'empty' ? 'No marketing rows were returned.' : ''),
    weeks: weeklyBudget(expenses.rows),
    shares: {
      expenses: categoryShare(expenses.rows),
      income: categoryShare(income.rows),
    },
  }
}

export function glanceFromVe(model) {
  const clients = (model.customers || []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    joined: row.joined || '',
    due: row.dueDate && row.dueDate !== 'Not dated' ? row.dueDate : '',
  }))
  const operations = (model.accounts || []).map((row) => ({
    id: row.id,
    title: row.plan,
    status: row.activity,
    due: row.dueDate && row.dueDate !== 'Not dated' ? row.dueDate : '',
    amount: row.slotsTaken,
    unit: 'slots',
  }))
  const incomeNote = veSideNote(model.access?.orders, COPY.ordersBlocked)
  const expenseNote = veSideNote(model.access?.expenses, COPY.expensesBlocked, COPY.expensesEmpty)
  const bankNotes = []
  if (model.access?.bankAccounts === 'blocked') bankNotes.push(COPY.bankAccountsBlocked)
  if (model.access?.bankTransactions === 'blocked') bankNotes.push(COPY.bankTxnsBlocked)
  if (model.access?.bankAccounts === 'error' || model.access?.bankTransactions === 'error') bankNotes.push(COPY.loadError)
  return {
    businessId: 've',
    today: model.today,
    finance: model.overview.finance,
    incomeNote,
    expenseNote,
    incomeRows: model.income || [],
    expenseRows: model.expenses || [],
    clients,
    clientsNote: model.access?.customers === 'blocked' ? 'Customer records are not visible to this account.' : model.access?.customers === 'empty' ? 'No customers yet.' : model.access?.customers === 'signed-out' ? 'Sign in with Supabase to load these records.' : '',
    counts: clientCounts(clients, model.today),
    operations,
    operationsNote: model.access?.familyAccounts === 'blocked' ? 'Family accounts are not visible to this account.' : model.access?.familyAccounts === 'empty' ? 'No family account rows were returned for this account.' : '',
    upcoming: upcomingItems(operations, model.today),
    bankAccounts: model.access?.bankAccounts === 'ok' ? model.bankAccounts : [],
    bankTransactions: model.access?.bankTransactions === 'ok' ? model.bankTransactions : [],
    bankNote: bankNotes.join(' '),
    posts: model.posts || [],
    spend: model.spend || [],
    postsNote: veSideNote(model.access?.marketing, COPY.postsBlocked, COPY.postsEmpty),
    spendNote: veSideNote(model.access?.marketingSpend, COPY.cacBlocked, COPY.cacEmpty),
    marketingNote: '',
    budget: model.budget,
    bankTxnAccess: model.access?.bankTransactions || 'empty',
    weeks: model.weeks || [],
  }
}

function veSideNote(access, blocked, empty = '') {
  if (access === 'blocked') return blocked
  if (access === 'error') return COPY.loadError
  if (access === 'signed-out') return COPY.signedOut
  if (access === 'unconfigured') return COPY.unconfigured
  if (access === 'empty') return empty
  return ''
}

export async function fetchBusinessWorkspace({ businessId, env = {}, token = '', today, createClient: factory } = {}) {
  const adapter = adapterFor(businessId)
  if (!adapter.reads.length) return buildAdapterModel(businessId, {}, today)
  if (!token) {
    const sources = Object.fromEntries(adapter.reads.map((item) => [item.key, { access: 'signed-out', rows: [], message: '' }]))
    return buildAdapterModel(businessId, sources, today)
  }
  const client = createVeClient(env, token, factory)
  if (!client) {
    const sources = Object.fromEntries(adapter.reads.map((item) => [item.key, { access: 'unconfigured', rows: [], message: '' }]))
    return buildAdapterModel(businessId, sources, today)
  }
  const results = await Promise.all(adapter.reads.map((item) => readScopedTable(client, item.schema, item.table, item.columns, item.order, item.filters)))
  const sources = Object.fromEntries(adapter.reads.map((item, index) => [item.key, results[index]]))
  return buildAdapterModel(businessId, sources, today)
}
