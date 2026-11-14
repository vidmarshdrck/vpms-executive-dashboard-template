import { createClient } from '@supabase/supabase-js'
import { projectBudget } from './bankBudget.js'
import { slicesBy } from './books.js'
import { periodBounds } from './reportingPeriod.js'
export { VE_UPCOMING } from './veUpcoming.js'

export const FAMILY_COLUMNS = 'fid,aaid,product,due_date,paid_status,slots_total,slots_taken,slot_1,slot_2,slot_3,slot_4,slot_5'
export const CUSTOMER_COLUMNS = 'cid,name,phone,products,status,total_spent,due_date,date_joined'
export const ORDER_COLUMNS = 'oid,date,amount,product,months,cid,status'
export const EXPENSE_COLUMNS = 'id,date,amount,category,family_account_id,status,payee'
export const MARKETING_COLUMNS = 'id,date,channel,campaign,content_type,hook_used,cta_used,amount,impressions,clicks,conversions,cac'
export const SPEND_COLUMNS = 'id,date,channel,campaign,amount,impressions,clicks,conversions,cac'
export const PRODUCT_COLUMNS = 'id,name,category,is_shared_plan,slots_per_account,default_months,price_zmw,is_active'
export const BANK_ACCOUNT_COLUMNS = 'id,label,bank,currency,account_last4,opening_balance,created_at'
export const BANK_TXN_COLUMNS = 'id,account_id,txn_date,description,reference,amount,balance,category,orig_amount_usd,fx_rate'
export const AGENT_COLUMNS = 'aaid,name'

export const COPY = {
  signedOut: 'Sign in with Supabase to load VE records.',
  unconfigured: 'Supabase is not configured for this sign-in.',
  loading: 'Loading VE records.',
  loadError: 'Could not load these records.',
  familyEmpty: 'No family account rows were returned for this account.',
  familyBlocked: 'Family accounts are not visible to this account.',
  customersEmpty: 'No customers yet.',
  customersBlocked: 'Customer records are not visible to this account.',
  ordersBlocked: 'Order income is not visible to this account.',
  expensesEmpty: 'No expense rows were returned for this account.',
  expensesBlocked: 'Expenses are not visible to this account.',
  fundsEmpty: 'No income or expenses were returned for this account.',
  budgetEmpty: 'No expenses recorded this week.',
  budgetNote: 'Derived from recorded expenses. No separate budget is stored.',
  postsEmpty: 'No scheduled posts yet.',
  postsBlocked: 'Scheduled posts are not visible to this account.',
  cacEmpty: 'No acquisition spend recorded yet.',
  cacBlocked: 'Acquisition spend is not visible to this account.',
  activeEmpty: 'No active family accounts.',
  inactiveEmpty: 'No inactive family accounts.',
  plansEmpty: 'No plans were returned for this account.',
  bankAccountsBlocked: 'Bank accounts are not visible to this account.',
  bankTxnsBlocked: 'Bank transactions are not visible to this account.',
  bankTxnsEmpty: 'No bank transactions were returned for this account.',
  currencyEmpty: 'No account in this currency was returned.',
  bankTrailEmpty: 'No transactions match this month and filter.',
}

export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

function isoDate(value) {
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

export function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function amountOrZero(value) {
  return parseAmount(value) ?? 0
}

function productList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).join(', ')
  const text = String(value || '').trim()
  return text
}

export function accountActivity(dueDate, today) {
  const due = isoDate(dueDate)
  return due && due >= today ? 'Active' : 'Inactive'
}

export function weekStart(value) {
  const due = isoDate(value)
  if (!due) return ''
  const [year, month, day] = due.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - weekday + 1)
  return date.toISOString().slice(0, 10)
}

export function monthKey(value) {
  const due = isoDate(value)
  return due ? due.slice(0, 7) : ''
}

function sourceState(access, rows = [], message = '') {
  return { access, rows, message }
}

export function emptySources(access) {
  return {
    familyAccounts: sourceState(access),
    customers: sourceState(access),
    orders: sourceState(access),
    expenses: sourceState(access),
    marketing: sourceState(access),
    marketingSpend: sourceState(access),
    products: sourceState(access),
    bankAccounts: sourceState(access),
    bankTransactions: sourceState(access),
    accountAgents: sourceState(access),
  }
}

export function classifyResult(result) {
  if (result?.error) {
    const code = String(result.error.code || '')
    const message = String(result.error.message || '')
    const blocked = code === '42501' || code === 'PGRST301' || /permission denied|row-level security|not authorized/i.test(message)
    return { access: blocked ? 'blocked' : 'error', rows: [], message }
  }
  const rows = Array.isArray(result?.data) ? result.data : []
  return { access: rows.length ? 'ok' : 'empty', rows, message: '' }
}

function mapCustomer(row) {
  return {
    id: String(row.cid || ''),
    name: String(row.name || '').trim() || 'Unnamed customer',
    phone: String(row.phone || '').trim(),
    dueDate: isoDate(row.due_date) || 'Not dated',
    joined: isoDate(row.date_joined),
    products: productList(row.products) || 'None',
    status: String(row.status || '').trim() || 'Unspecified',
    totalSpent: amountOrZero(row.total_spent),
  }
}

export function whatsappNumber(phone) {
  const compact = String(phone || '').replace(/[^\d+]/g, '')
  if (!compact) return ''
  const digits = compact.startsWith('+')
    ? compact.slice(1).replace(/\D/g, '')
    : compact.startsWith('0')
      ? `260${compact.slice(1).replace(/\D/g, '')}`
      : compact.replace(/\D/g, '')
  return digits.length >= 8 ? digits : ''
}

export function whatsappHref(customer) {
  const number = whatsappNumber(customer?.phone)
  if (!number) return ''
  const text = `Hello ${customer.name}, this is a reminder to renew ${customer.products}. Payment is due ${customer.dueDate}.`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export function filterCustomers(rows, { status = 'All', query = '' } = {}) {
  const terms = String(query || '').split(',').map((term) => term.trim().toLowerCase()).filter(Boolean)
  return rows.filter((row) => {
    if (status && status !== 'All' && row.status !== status) return false
    if (!terms.length) return true
    const haystack = [row.name, row.phone, row.products, row.id].join(' ').toLowerCase()
    return terms.some((term) => haystack.includes(term))
  })
}

function readable(access) {
  return access === 'ok' || access === 'empty'
}

export function financeSummary(income, expenses, access = {}) {
  const incomeTotal = readable(access.orders) ? income.reduce((sum, row) => sum + row.amount, 0) : null
  const expenseTotal = readable(access.expenses) ? expenses.reduce((sum, row) => sum + row.amount, 0) : null
  const surplus = incomeTotal != null && expenseTotal != null ? incomeTotal - expenseTotal : null
  return { expenses: expenseTotal, income: incomeTotal, balance: surplus, profit: surplus }
}

export function latestPayments(orders) {
  const byCustomer = new Map()
  for (const order of orders || []) {
    const cid = String(order.cid || '').trim()
    const date = /^\d{4}-\d{2}-\d{2}/.test(String(order.date || '')) ? String(order.date).slice(0, 10) : ''
    if (!cid || !date) continue
    const amount = amountOrZero(order.amount)
    const current = byCustomer.get(cid)
    if (!current || date > current.date || (date === current.date && amount > current.amount)) byCustomer.set(cid, { date, amount })
  }
  return byCustomer
}

export function personName(value) {
  const name = String(value || '').trim()
  if (!name || name.toLowerCase() === 'nan') return ''
  return name
}

function mapAccount(row, customers, today, agents) {
  const byId = new Map(customers.map((customer) => [customer.id, customer]))
  const members = [1, 2, 3, 4, 5].flatMap((slot) => {
    const cid = String(row[`slot_${slot}`] || '').trim()
    if (!cid) return []
    const customer = byId.get(cid)
    return [{ slot, cid, name: customer?.name || cid, unmatched: !customer, lastPayment: customer?.lastPayment || null }]
  })
  const recordedEmail = String(row.email || '').trim()
  const agentId = String(row.aaid || '').trim()
  const holder = personName(agents.get(agentId))
  return {
    id: String(row.fid ?? ''),
    plan: String(row.product || '').trim() || 'Unspecified plan',
    dueDate: isoDate(row.due_date) || 'Not dated',
    activity: accountActivity(row.due_date, today),
    paidStatus: String(row.paid_status || '').trim() || 'Unspecified',
    slotsTotal: Number(row.slots_total) || 0,
    slotsTaken: Number(row.slots_taken) || 0,
    email: recordedEmail.includes('@') ? recordedEmail : '',
    owner: holder || 'Not recorded',
    names: members.map((member) => member.name).join(', '),
    agent: holder,
    members,
  }
}

export function seatedCustomerIds(accounts) {
  const ids = new Set()
  for (const account of accounts || []) {
    for (const member of account.members || []) {
      const cid = String(member.cid || '').trim()
      if (cid) ids.add(cid)
    }
  }
  return ids
}

export function sumReceived(rows, { start = '', end = '', cids = null } = {}) {
  const allowed = cids ? new Set([...cids].map((id) => String(id || '').trim()).filter(Boolean)) : null
  return (rows || []).reduce((sum, row) => {
    const date = isoDate(row?.date)
    if (start && (!date || date < start)) return sum
    if (end && (!date || date > end)) return sum
    if (allowed && !allowed.has(String(row?.cid || '').trim())) return sum
    return sum + amountOrZero(row?.amount)
  }, 0)
}

export function receivedInPeriod(rows, period) {
  if (!period) return sumReceived(rows)
  const { start, end } = periodBounds(period)
  return sumReceived(rows, { start, end })
}

function mapIncome(row, customers) {
  const byId = new Map(customers.map((customer) => [customer.id, customer]))
  const cid = String(row.cid || '').trim()
  const customer = byId.get(cid)
  return {
    id: `order-${row.oid}`,
    cid,
    date: isoDate(row.date),
    kind: 'income',
    title: customer?.name || (cid ? cid : 'Order'),
    category: String(row.product || '').trim() || 'Unspecified',
    status: String(row.status || '').trim() || 'Unspecified',
    amount: amountOrZero(row.amount),
    months: row.months == null || row.months === '' ? null : Number(row.months),
  }
}

function mapExpense(row) {
  return {
    id: `expense-${row.id}`,
    date: isoDate(row.date),
    kind: 'expense',
    title: String(row.payee || '').trim() || String(row.category || '').trim() || 'Expense',
    category: String(row.category || '').trim() || 'Unspecified',
    status: String(row.status || '').trim() || 'Unspecified',
    amount: amountOrZero(row.amount),
    familyAccountId: row.family_account_id == null ? '' : String(row.family_account_id),
  }
}

function mapPost(row, today) {
  const date = isoDate(row.date)
  const post = [row.campaign, row.hook_used, row.cta_used].map((item) => String(item || '').trim()).filter(Boolean).join(' · ') || 'Untitled post'
  let status = 'Recorded'
  if (date && date > today) status = 'Scheduled'
  else if (date && date <= today) status = 'Published'
  return {
    id: `post-${row.id}`,
    date: date || (String(row.date || '').trim() || 'Not dated'),
    channel: String(row.channel || '').trim() || 'Unspecified',
    post,
    status,
  }
}

function mapSpend(row) {
  const spend = amountOrZero(row.amount)
  const conversions = parseAmount(row.conversions)
  const stored = String(row.cac || '').trim()
  const computed = conversions != null && conversions > 0 ? spend / conversions : null
  return {
    id: `spend-${row.id}`,
    date: isoDate(row.date) || (String(row.date || '').trim() || 'Not dated'),
    channel: String(row.channel || '').trim() || 'Unspecified',
    campaign: String(row.campaign || '').trim() || 'Unspecified',
    amount: spend,
    conversions,
    computed,
    cacLabel: stored,
  }
}

function mapBankAccount(row) {
  return {
    id: String(row.id || ''),
    label: String(row.label || '').trim() || 'Bank account',
    bank: String(row.bank || '').trim(),
    currency: String(row.currency || '').trim() || 'ZMW',
    last4: String(row.account_last4 ?? '').trim(),
    openingBalance: parseAmount(row.opening_balance),
  }
}

function mapBankTransaction(row) {
  return {
    id: String(row.id ?? ''),
    accountId: String(row.account_id || ''),
    date: isoDate(row.txn_date),
    description: String(row.description || '').trim(),
    reference: String(row.reference || '').trim(),
    amount: amountOrZero(row.amount),
    balance: parseAmount(row.balance),
    category: String(row.category || '').trim() || 'other',
    origAmountUsd: parseAmount(row.orig_amount_usd),
    fxRate: parseAmount(row.fx_rate),
  }
}

function mapProduct(row) {
  return {
    id: String(row.id || row.name || ''),
    name: String(row.name || '').trim() || 'Unnamed plan',
    category: String(row.category || '').trim() || 'Unspecified',
    shared: row.is_shared_plan === true,
    slots: row.slots_per_account == null ? null : Number(row.slots_per_account),
    months: row.default_months == null ? null : Number(row.default_months),
    price: parseAmount(row.price_zmw),
    active: row.is_active !== false,
  }
}

function categoryTotals(rows) {
  const totals = new Map()
  for (const row of rows) totals.set(row.category, (totals.get(row.category) || 0) + row.amount)
  return [...totals.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
}

export function weeklyBudget(expenses) {
  const weeks = new Map()
  for (const row of expenses) {
    const week = weekStart(row.date)
    if (!week) continue
    if (!weeks.has(week)) weeks.set(week, new Map())
    const categories = weeks.get(week)
    categories.set(row.category, (categories.get(row.category) || 0) + row.amount)
  }
  return [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, categories]) => {
    const lines = [...categories.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    return { week, categories: lines, total: lines.reduce((sum, line) => sum + line.amount, 0) }
  })
}

export function filterFunds(income, expenses, filter) {
  const rows = filter === 'income' ? income : filter === 'expense' ? expenses : [...income, ...expenses]
  return [...rows].sort((a, b) => {
    if (!a.date && !b.date) return a.id.localeCompare(b.id)
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  })
}

export function fundsByMonth(rows) {
  const buckets = new Map()
  for (const row of rows) {
    const month = monthKey(row.date) || 'Not dated'
    if (!buckets.has(month)) buckets.set(month, { month, income: 0, expense: 0 })
    buckets.get(month)[row.kind] += row.amount
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function acquisitionSummary(lines) {
  const convertible = lines.filter((line) => line.conversions != null && line.conversions > 0)
  const amount = convertible.reduce((sum, line) => sum + line.amount, 0)
  const conversions = convertible.reduce((sum, line) => sum + line.conversions, 0)
  return {
    amount: lines.reduce((sum, line) => sum + line.amount, 0),
    conversions,
    value: conversions > 0 ? amount / conversions : null,
  }
}

export function buildWorkspace(sources, today = todayIso()) {
  const customers = sources.customers.access === 'ok' ? sources.customers.rows.map(mapCustomer).sort((a, b) => a.name.localeCompare(b.name)) : []
  const payments = sources.orders.access === 'ok' ? latestPayments(sources.orders.rows) : new Map()
  for (const customer of customers) customer.lastPayment = payments.get(customer.id) || null
  const agentSource = sources.accountAgents || { access: 'empty', rows: [] }
  const agents = new Map()
  if (agentSource.access === 'ok') {
    for (const row of agentSource.rows) {
      const id = String(row.aaid || '').trim()
      const name = String(row.name || '').trim()
      if (id && name) agents.set(id, name)
    }
  }
  const accounts = sources.familyAccounts.access === 'ok' ? sources.familyAccounts.rows.map((row) => mapAccount(row, customers, today, agents)) : []
  const activeAccounts = accounts.filter((account) => account.activity === 'Active').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const inactiveAccounts = accounts.filter((account) => account.activity === 'Inactive').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const income = sources.orders.access === 'ok' ? sources.orders.rows.map((row) => mapIncome(row, customers)) : []
  const expenses = sources.expenses.access === 'ok' ? sources.expenses.rows.map(mapExpense) : []
  const posts = sources.marketing.access === 'ok' ? sources.marketing.rows.map((row) => mapPost(row, today)) : []
  const spend = sources.marketingSpend.access === 'ok' ? sources.marketingSpend.rows.map(mapSpend) : []
  const products = sources.products.access === 'ok' ? sources.products.rows.map(mapProduct).sort((a, b) => a.name.localeCompare(b.name)) : []
  const bankSource = sources.bankAccounts || { access: 'empty', rows: [] }
  const bankTxnSource = sources.bankTransactions || { access: 'empty', rows: [] }
  const bankAccounts = bankSource.access === 'ok' ? bankSource.rows.map(mapBankAccount).sort((a, b) => a.currency.localeCompare(b.currency) || a.label.localeCompare(b.label)) : []
  const bankTransactions = bankTxnSource.access === 'ok' ? bankTxnSource.rows.map(mapBankTransaction) : []
  const connected = new Set(accounts.flatMap((account) => account.members.map((member) => member.cid)))
  return {
    today,
    access: {
      familyAccounts: sources.familyAccounts.access,
      customers: sources.customers.access,
      orders: sources.orders.access,
      expenses: sources.expenses.access,
      marketing: sources.marketing.access,
      marketingSpend: sources.marketingSpend.access,
      products: sources.products.access,
      bankAccounts: bankSource.access,
      bankTransactions: bankTxnSource.access,
    },
    accounts,
    activeAccounts,
    inactiveAccounts,
    customers,
    income,
    expenses,
    posts,
    spend,
    products,
    bankAccounts,
    bankTransactions,
    budget: projectBudget({ activeAccounts, transactions: bankTransactions }),
    weeks: weeklyBudget(expenses),
    incomeCategories: categoryTotals(income),
    expenseCategories: categoryTotals(expenses),
    acquisition: acquisitionSummary(spend),
    overview: {
      accounts: accounts.length,
      active: activeAccounts.length,
      inactive: inactiveAccounts.length,
      connected: connected.size,
      openSlots: accounts.reduce((sum, account) => sum + Math.max(account.slotsTotal - account.members.length, 0), 0),
      finance: financeSummary(income, expenses, { orders: sources.orders.access, expenses: sources.expenses.access }),
    },
    slices: {
      income: slicesBy(income.map((row) => ({ group: row.category, amount: row.amount })), 'group'),
      expenses: slicesBy(expenses.map((row) => ({ group: row.category, amount: row.amount })), 'group'),
    },
  }
}

export function createVeClient(env = {}, token = '', factory = createClient) {
  const url = String(env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  if (!url || !key || !token) return null
  return factory(url, key, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

function scopedFrom(client, schema, table) {
  const scoped = schema !== 'public' && typeof client.schema === 'function' ? client.schema(schema) : client
  return scoped.from(table)
}

export async function readScopedTable(client, schema, table, columns, orderColumn, filters = []) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; from < 5000; from += pageSize) {
    let query
    try {
      query = scopedFrom(client, schema, table).select(columns)
      for (const filter of filters) {
        if (filter?.op === 'eq' && typeof query.eq === 'function') query = query.eq(filter.column, filter.value)
      }
      query = query.order(orderColumn, { ascending: true })
    } catch (error) {
      return classifyResult({ data: null, error: { message: error instanceof Error ? error.message : 'Could not query records.' } })
    }
    const result = typeof query.range === 'function' ? await query.range(from, from + pageSize - 1) : await query
    const classified = classifyResult(result)
    if (classified.access === 'blocked' || classified.access === 'error') return classified
    rows.push(...classified.rows)
    if (typeof query.range !== 'function' || classified.rows.length < pageSize) {
      return { access: rows.length ? 'ok' : 'empty', rows, message: '' }
    }
  }
  return { access: 'error', rows: [], message: 'Result limit reached.' }
}

function readTable(client, schema, table, columns, orderColumn) {
  return readScopedTable(client, schema, table, columns, orderColumn)
}

export async function fetchVeWorkspace({ env = {}, token = '', today = todayIso(), createClient: factory = createClient } = {}) {
  if (!token) return buildWorkspace(emptySources('signed-out'), today)
  const client = createVeClient(env, token, factory)
  if (!client) return buildWorkspace(emptySources('unconfigured'), today)
  const [familyAccounts, customers, orders, expenses, marketing, marketingSpend, products, bankAccounts, bankTransactions, accountAgents] = await Promise.all([
    readTable(client, 'public', 'family_accounts', FAMILY_COLUMNS, 'fid'),
    readTable(client, 'public', 'customers', CUSTOMER_COLUMNS, 'name'),
    readTable(client, 'public', 'orders', ORDER_COLUMNS, 'date'),
    readTable(client, 'public', 'expenses', EXPENSE_COLUMNS, 'date'),
    readTable(client, 'public', 'marketing', MARKETING_COLUMNS, 'date'),
    readTable(client, 'public', 'marketing_spend', SPEND_COLUMNS, 'date'),
    readTable(client, 've', 'products', PRODUCT_COLUMNS, 'name'),
    readTable(client, 'public', 've_bank_accounts', BANK_ACCOUNT_COLUMNS, 'label'),
    readTable(client, 'public', 've_bank_transactions', BANK_TXN_COLUMNS, 'txn_date'),
    readTable(client, 'public', 'account_agents', AGENT_COLUMNS, 'name'),
  ])
  return buildWorkspace({ familyAccounts, customers, orders, expenses, marketing, marketingSpend, products, bankAccounts, bankTransactions, accountAgents }, today)
}
