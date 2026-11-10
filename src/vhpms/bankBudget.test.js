import test from 'node:test'
import assert from 'node:assert/strict'
import {
  accountPeriod, accountsByCurrency, averageMonthlyBankCharges, closingBalances, descriptionMatchesPlan, filterBankTransactions, latestFxRate, projectBudget, providerSpendByMonth, typicalPlanPrice,
} from './bankBudget.js'

const active = [
  { plan: 'Netflix' },
  { plan: 'Netflix' },
  { plan: 'Starlink' },
  { plan: 'Spotify' },
]

function txn(overrides) {
  return {
    id: overrides.id,
    accountId: 'zmw',
    date: overrides.date,
    description: overrides.description || '',
    reference: overrides.reference || '',
    amount: overrides.amount ?? 0,
    balance: overrides.balance ?? null,
    category: overrides.category || 've_provider_subscription',
    origAmountUsd: overrides.origAmountUsd ?? null,
    fxRate: overrides.fxRate ?? null,
  }
}

const transactions = [
  txn({ id: 1, date: '2026-08-02', description: 'NETFLIX.COM', amount: -399.75, balance: 1000, origAmountUsd: 15.99, fxRate: 20 }),
  txn({ id: 2, date: '2026-08-03', description: 'NETFLIX.COM', amount: -449.75, balance: 550.25, origAmountUsd: 17.99, fxRate: 22 }),
  txn({ id: 3, date: '2026-08-04', description: 'NETFLIX.COM', amount: -399.75, balance: 150.5, origAmountUsd: 15.99, fxRate: 24 }),
  txn({ id: 4, date: '2026-08-10', description: 'STARLINK', amount: -800, balance: -649.5, category: 've_provider_subscription' }),
  txn({ id: 5, date: '2026-08-11', description: 'STARLINK', amount: -800, balance: -1449.5 }),
  txn({ id: 6, date: '2026-08-12', description: 'FNB CHARGE', amount: -10, balance: -1459.5, category: 'bank_charges' }),
  txn({ id: 7, date: '2026-09-01', description: 'NETFLIX.COM', amount: -1200, balance: 200, origAmountUsd: 15.99, fxRate: 24 }),
  txn({ id: 8, date: '2026-09-02', description: 'SPOTIFY', amount: -600, balance: -400, origAmountUsd: 9.99, fxRate: 26 }),
  txn({ id: 9, date: '2026-09-03', description: 'FX CONVERSION', amount: -5000, balance: -5400, category: 'fx_conversion' }),
  txn({ id: 10, date: '2026-09-04', description: 'Transfer in', amount: 7000, balance: 1600, category: 'transfer_in', fxRate: 25 }),
  txn({ id: 11, date: '2026-10-01', description: 'Savings', amount: -100, balance: 1500, category: 'savings_transfer' }),
]

test('plan descriptions match merchant text and ignore nearby words', () => {
  assert.equal(descriptionMatchesPlan('NETFLIX.COM', 'Netflix'), true)
  assert.equal(descriptionMatchesPlan('SPOTIFY P2B4', 'Spotify'), true)
  assert.equal(descriptionMatchesPlan('AMAZON PRIME', 'Prime Video'), true)
  assert.equal(descriptionMatchesPlan('APPLE.COM/BILL', 'Apple Music'), true)
  assert.equal(descriptionMatchesPlan('STARLINK INTERNET', 'Starlink'), true)
  assert.equal(descriptionMatchesPlan('PINEAPPLE MARKET', 'Apple Music'), false)
  assert.equal(descriptionMatchesPlan('FNB CHARGE', 'Netflix'), false)
  assert.equal(descriptionMatchesPlan('PREMIUM SUPPORT', 'Prime Video'), false)
})

test('FX rate is the latest month average and USD prices come from orig_amount_usd', () => {
  const fx = latestFxRate(transactions)
  assert.equal(fx.month, '2026-09')
  assert.equal(fx.rate, 25)
  assert.equal(fx.rows, 3)
  assert.match(fx.source, /2026-09/)
  assert.match(fx.source, /ZMW per 1 USD/)
  const netflix = typicalPlanPrice(transactions, 'Netflix')
  assert.equal(netflix.currency, 'USD')
  assert.equal(netflix.price, 15.99)
  assert.equal(netflix.rows, 4)
  assert.match(netflix.source, /orig_amount_usd/)
  const starlink = typicalPlanPrice(transactions, 'Starlink')
  assert.equal(starlink.currency, 'ZMW')
  assert.equal(starlink.price, 800)
  assert.match(starlink.source, /no USD amount/)
  assert.equal(typicalPlanPrice(transactions, 'Showmax').price, null)
  assert.equal(latestFxRate([{ date: '2026-10-01', fxRate: null }]).rate, null)
})

test('projection uses active plans, kwacha plans, and average bank charges', () => {
  const charges = averageMonthlyBankCharges(transactions)
  assert.equal(charges.months, 3)
  assert.equal(charges.average, 3.33)
  const budget = projectBudget({
    activeAccounts: active.filter((account) => account.plan !== 'Spotify'),
    transactions,
  })
  const netflix = budget.lines.find((line) => line.plan === 'Netflix')
  const starlink = budget.lines.find((line) => line.plan === 'Starlink')
  assert.equal(budget.lines.some((line) => line.plan === 'Spotify'), false)
  assert.equal(netflix.count, 2)
  assert.equal(netflix.unitUsd, 15.99)
  assert.equal(netflix.unitZmw, 399.75)
  assert.equal(netflix.total, 799.5)
  assert.equal(starlink.unitZmw, 800)
  assert.equal(starlink.total, 800)
  assert.equal(budget.usdConverted, 799.5)
  assert.equal(budget.kwachaBilled, 800)
  assert.equal(budget.charges.average, 3.33)
  assert.equal(budget.projection, 1602.83)
  assert.equal(budget.fx.rate, 25)
  assert.match(budget.formula, /latest FX rate/)
  assert.match(budget.gapLabel, /positive gap means the bank paid more/)
})

test('provider spend is the last 12 months and the gap is actual minus projection', () => {
  const actual = providerSpendByMonth(transactions)
  assert.equal(actual.months.length, 12)
  assert.equal(actual.months[0].month, '2025-11')
  assert.equal(actual.latest.month, '2026-10')
  assert.equal(actual.latest.amount, 0)
  assert.equal(actual.months.find((month) => month.month === '2026-08').amount, 2849.25)
  assert.equal(actual.months.find((month) => month.month === '2026-09').amount, 1800)
  assert.equal(actual.average, 387.44)
  const budget = projectBudget({ activeAccounts: [{ plan: 'Netflix' }], transactions })
  assert.equal(budget.projection, 403.08)
  assert.equal(budget.gapLatest, -403.08)
  assert.equal(budget.gapAverage, -15.64)
  const quiet = projectBudget({ activeAccounts: [], transactions: [] })
  assert.equal(quiet.projection, null)
  assert.equal(quiet.charges.average, 0)
  assert.equal(quiet.actual.average, null)
  assert.equal(quiet.gapLatest, null)
})

test('a currency with no account stays empty and the latest balance is the last recorded one', () => {
  const groups = accountsByCurrency([{ id: 'zmw', currency: 'ZMW', label: 'FNB' }])
  assert.deepEqual(groups.map((group) => [group.currency, group.accounts.length]), [['ZMW', 1], ['USD', 0]])
  const account = { id: 'zmw', openingBalance: 488.7, currency: 'ZMW' }
  const period = accountPeriod(account, transactions, '2026-09')
  assert.equal(period.current, 1500)
  assert.equal(period.moneyIn, 7000)
  assert.equal(period.moneyOut, 6800)
  assert.equal(period.points.at(-1).balance, 1600)
  const trail = filterBankTransactions(transactions, { accountId: 'zmw', month: '2026-09', query: 'netflix', category: 'All' })
  assert.deepEqual(trail.map((row) => row.id), [7])
  assert.equal(filterBankTransactions(transactions, { month: '2026-09', category: 'fx_conversion' }).length, 1)
  const opening = accountPeriod({ id: 'usd', openingBalance: 20, currency: 'USD' }, [], '2026-09')
  assert.equal(opening.current, 20)
  assert.equal(opening.points.length, 0)
  const balances = closingBalances(
    [{ id: 'zmw', currency: 'ZMW', openingBalance: 10 }, { id: 'usd', currency: 'USD', openingBalance: 5 }, { id: 'zmw-2', currency: 'ZMW', openingBalance: 1 }],
    [{ accountId: 'zmw', date: '2026-11-08', balance: 100, id: 1 }, { accountId: 'zmw', date: '2027-01-02', balance: 900, id: 2 }],
    '2026-12-31',
  )
  assert.deepEqual(balances, [{ currency: 'USD', amount: 5 }, { currency: 'ZMW', amount: 101 }])
  assert.deepEqual(closingBalances([], [], '2026-12-31'), [])
})
