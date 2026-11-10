import { latestMonth, shiftMonth } from './fundsMonth.js'

export const BANK_CURRENCIES = ['ZMW', 'USD']

export const CATEGORY_LABELS = {
  ve_provider_subscription: 'VE provider subscriptions',
  tools_ai_subscription: 'Tools and AI subscriptions',
  ads_boost: 'Ads and boosts',
  bank_charges: 'Bank charges',
  fx_conversion: 'FX conversion',
  transfer_in: 'Transfers in',
  savings_transfer: 'Savings transfers',
  internal_transfer_out: 'Internal transfers out',
  other: 'Other',
}

export const PROJECTION_LABEL = 'Projected monthly cost = active family plan prices × the latest FX rate for USD plans + kwacha-billed plans + the average monthly bank charge.'

export const GAP_LABEL = 'Gap is actual ve_provider_subscription outflow minus the projected plan cost. A positive gap means the bank paid more than the active family plans imply.'

const STOP_WORDS = new Set(['music', 'video', 'plus', 'premium', 'family', 'plan', 'pass', 'subscription'])

const PLAN_ALIASES = {
  'prime video': ['amazon prime', 'amzn prime'],
  'amazon prime': ['prime video', 'amzn prime'],
  'apple music': ['apple com', 'itunes'],
  'apple one': ['apple com', 'itunes'],
  'apple tv': ['apple com'],
}

export function roundTo(value, places) {
  const factor = 10 ** places
  return Math.round(Number(value) * factor) / factor
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || String(category || '').trim() || 'Other'
}

export function formatRate(rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return 'Not recorded'
  return Number(rate).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function formatMoney(amount, currency = 'ZMW') {
  if (amount == null || !Number.isFinite(Number(amount))) return 'Not recorded'
  const text = Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'USD' ? `USD ${text}` : `ZMW ${text}`
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function includesTerm(text, needle) {
  return ` ${text} `.includes(` ${needle} `)
}

export function descriptionMatchesPlan(description, plan) {
  const text = normalize(description)
  const key = normalize(plan)
  if (!text || !key) return false
  if (includesTerm(text, key)) return true
  const aliases = PLAN_ALIASES[key] || []
  if (aliases.some((alias) => includesTerm(text, alias))) return true
  const words = key.split(' ').filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
  return words.length > 0 && words.every((word) => includesTerm(text, word))
}

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function median(values) {
  const sorted = values.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function providerRows(transactions, plan) {
  return (transactions || []).filter((txn) => txn.category === 've_provider_subscription' && descriptionMatchesPlan(txn.description, plan))
}

export function typicalPlanPrice(transactions, plan) {
  const matched = providerRows(transactions, plan)
  const usd = matched.map((txn) => asNumber(txn.origAmountUsd)).filter((value) => value != null && value !== 0).map((value) => Math.abs(value))
  if (usd.length) {
    const price = roundTo(median(usd), 2)
    const noun = usd.length === 1 ? 'row' : 'rows'
    return {
      plan,
      currency: 'USD',
      price,
      rows: usd.length,
      source: `Median orig_amount_usd on ${usd.length} ve_provider_subscription ${noun} whose description matches ${plan}.`,
    }
  }
  const kwacha = matched.map((txn) => asNumber(txn.amount)).filter((value) => value != null && value !== 0).map((value) => Math.abs(value))
  if (kwacha.length) {
    const price = roundTo(median(kwacha), 2)
    const noun = kwacha.length === 1 ? 'row' : 'rows'
    return {
      plan,
      currency: 'ZMW',
      price,
      rows: kwacha.length,
      source: `Median kwacha amount on ${kwacha.length} ve_provider_subscription ${noun} whose description matches ${plan}. ${kwacha.length === 1 ? 'That row has' : 'Those rows have'} no USD amount.`,
    }
  }
  return {
    plan,
    currency: null,
    price: null,
    rows: 0,
    source: `No ve_provider_subscription description matches ${plan}.`,
  }
}

export function latestFxRate(transactions) {
  const rated = (transactions || []).flatMap((txn) => {
    const rate = asNumber(txn.fxRate)
    const month = String(txn.date || '').slice(0, 7)
    return rate != null && rate > 0 && /^\d{4}-\d{2}$/.test(month) ? [{ rate, month }] : []
  })
  if (!rated.length) {
    return { rate: null, month: '', rows: 0, source: 'No fx_rate was recorded on bank transactions.' }
  }
  const month = latestMonth(rated.map((row) => row.month))
  const values = rated.filter((row) => row.month === month).map((row) => row.rate)
  const rate = roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 4)
  return {
    rate,
    month,
    rows: values.length,
    source: `Average fx_rate in ${month} across ${values.length} bank rows. The rate is ZMW per 1 USD.`,
  }
}

function categorySpend(transactions, month, category) {
  const signed = (transactions || [])
    .filter((txn) => String(txn.date || '').startsWith(`${month}-`) && txn.category === category)
    .reduce((sum, txn) => sum + (asNumber(txn.amount) ?? 0), 0)
  return roundTo(Math.max(-signed, 0), 2)
}

function monthSpan(transactions) {
  const months = (transactions || []).map((txn) => String(txn.date || '').slice(0, 7)).filter((month) => /^\d{4}-\d{2}$/.test(month)).sort()
  if (!months.length) return []
  const span = []
  let cursor = months[0]
  const end = months.at(-1)
  while (cursor && cursor <= end && span.length < 240) {
    span.push(cursor)
    cursor = shiftMonth(cursor, 1)
  }
  return span
}

function trailingMonths(end, count) {
  const months = []
  let cursor = end
  for (let index = 0; index < count; index += 1) {
    months.unshift(cursor)
    cursor = shiftMonth(cursor, -1)
  }
  return months
}

export function averageMonthlyBankCharges(transactions) {
  const span = monthSpan(transactions)
  if (!span.length) {
    return { average: 0, months: 0, source: 'No bank transactions were returned, so the average monthly bank charge is 0.' }
  }
  const values = span.map((month) => categorySpend(transactions, month, 'bank_charges'))
  const average = roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 2)
  return {
    average,
    months: span.length,
    source: `Average monthly bank_charges outflow from ${span[0]} to ${span.at(-1)} (${span.length} months). A month with no bank charge counts as 0.`,
  }
}

export function providerSpendByMonth(transactions, monthCount = 12) {
  const end = latestMonth((transactions || []).map((txn) => txn.date))
  if (!end) {
    return { months: [], average: null, latest: null, source: 'No bank transactions were returned, so there is no provider spend trend.' }
  }
  const months = trailingMonths(end, monthCount).map((month) => ({
    month,
    amount: categorySpend(transactions, month, 've_provider_subscription'),
  }))
  const average = roundTo(months.reduce((sum, month) => sum + month.amount, 0) / months.length, 2)
  return {
    months,
    average,
    latest: months.at(-1),
    source: `ve_provider_subscription debits summed by month for the ${monthCount} months ending ${end}. The average divides that total by ${monthCount}. A month with no debit counts as 0.`,
  }
}

export function projectBudget({ activeAccounts = [], transactions = [] } = {}) {
  const fx = latestFxRate(transactions)
  const charges = averageMonthlyBankCharges(transactions)
  const counts = new Map()
  for (const account of activeAccounts || []) {
    const plan = String(account.plan || '').trim() || 'Unspecified plan'
    counts.set(plan, (counts.get(plan) || 0) + 1)
  }
  const lines = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([plan, count]) => {
    const price = typicalPlanPrice(transactions, plan)
    if (price.currency === 'USD' && price.price != null && fx.rate != null) {
      const unitZmw = roundTo(price.price * fx.rate, 2)
      return {
        plan, count, currency: 'USD', unitUsd: price.price, unitZmw, total: roundTo(unitZmw * count, 2), rows: price.rows, source: price.source,
      }
    }
    if (price.currency === 'ZMW' && price.price != null) {
      return {
        plan, count, currency: 'ZMW', unitUsd: null, unitZmw: price.price, total: roundTo(price.price * count, 2), rows: price.rows, source: price.source,
      }
    }
    const source = price.currency === 'USD' && fx.rate == null
      ? `${price.source} The FX rate is not recorded, so this plan is left out of the projection.`
      : price.source
    return { plan, count, currency: price.currency, unitUsd: price.price, unitZmw: null, total: null, rows: price.rows, source }
  })
  const usdConverted = roundTo(lines.reduce((sum, line) => sum + (line.currency === 'USD' && line.total != null ? line.total : 0), 0), 2)
  const kwachaBilled = roundTo(lines.reduce((sum, line) => sum + (line.currency === 'ZMW' && line.total != null ? line.total : 0), 0), 2)
  const priced = lines.some((line) => line.total != null) || charges.average > 0
  const projection = priced ? roundTo(usdConverted + kwachaBilled + charges.average, 2) : null
  const actual = providerSpendByMonth(transactions)
  const gapLatest = projection != null && actual.latest ? roundTo(actual.latest.amount - projection, 2) : null
  const gapAverage = projection != null && actual.average != null ? roundTo(actual.average - projection, 2) : null
  return {
    fx,
    charges,
    lines,
    usdConverted,
    kwachaBilled,
    projection,
    complete: lines.every((line) => line.total != null),
    actual,
    gapLatest,
    gapAverage,
    formula: PROJECTION_LABEL,
    gapLabel: GAP_LABEL,
  }
}

export function accountsByCurrency(accounts, currencies = BANK_CURRENCIES) {
  const known = [...currencies]
  for (const account of accounts || []) {
    if (account.currency && !known.includes(account.currency)) known.push(account.currency)
  }
  return known.map((currency) => ({
    currency,
    accounts: (accounts || []).filter((account) => account.currency === currency),
  }))
}

function compareTxn(a, b) {
  const date = String(a.date || '').localeCompare(String(b.date || ''))
  if (date) return date
  const left = Number(a.id)
  const right = Number(b.id)
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right
  return String(a.id).localeCompare(String(b.id))
}

export function periodTotals(rows) {
  let moneyIn = 0
  let moneyOut = 0
  for (const row of rows || []) {
    const amount = asNumber(row.amount) ?? 0
    if (amount > 0) moneyIn += amount
    else if (amount < 0) moneyOut += -amount
  }
  return { moneyIn: roundTo(moneyIn, 2), moneyOut: roundTo(moneyOut, 2) }
}

export function accountPeriod(account, transactions, month) {
  const mine = (transactions || []).filter((txn) => txn.accountId === account.id).sort(compareTxn)
  const withBalance = mine.filter((txn) => asNumber(txn.balance) != null && txn.date)
  const current = withBalance.length ? asNumber(withBalance.at(-1).balance) : asNumber(account.openingBalance)
  const period = mine.filter((txn) => month && String(txn.date || '').startsWith(`${month}-`))
  return {
    current,
    ...periodTotals(period),
    points: period.filter((txn) => asNumber(txn.balance) != null).map((txn) => ({ id: String(txn.id), date: txn.date, balance: asNumber(txn.balance) })),
  }
}

export function filterBankTransactions(rows, { accountId = '', month = '', query = '', category = 'All' } = {}) {
  const needle = String(query || '').trim().toLowerCase()
  return (rows || []).filter((row) => {
    if (accountId && row.accountId !== accountId) return false
    if (month && !String(row.date || '').startsWith(`${month}-`)) return false
    if (category && category !== 'All' && row.category !== category) return false
    if (!needle) return true
    const haystack = [row.description, row.reference, categoryLabel(row.category), row.category].join(' ').toLowerCase()
    return haystack.includes(needle)
  }).sort((a, b) => compareTxn(b, a))
}

export function fxText(row) {
  const parts = []
  if (asNumber(row.origAmountUsd) != null) parts.push(formatMoney(asNumber(row.origAmountUsd), 'USD'))
  if (asNumber(row.fxRate) != null) parts.push(`FX ${formatRate(asNumber(row.fxRate))}`)
  return parts.length ? parts.join(' · ') : ''
}
