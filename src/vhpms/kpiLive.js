import { closingBalances } from './bankBudget.js'
import { customersDue, receivedInPeriod } from './veData.js'

const READABLE = new Set(['ok', 'empty'])

function readable(access, key) {
  return READABLE.has(access?.[key])
}

// Figures already calculated for the VE workspace. Other businesses stay blank
// until someone types the actual on the KPIs page.
export function veKpiFigures(workspace, period) {
  if (!workspace) return null
  const access = workspace.access || {}
  const figures = {}
  if (readable(access, 'familyAccounts')) {
    figures.activeAccounts = Number(workspace.overview?.active)
    figures.openSlots = Number(workspace.overview?.openSlots)
    if (!Number.isFinite(figures.activeAccounts)) delete figures.activeAccounts
    if (!Number.isFinite(figures.openSlots)) delete figures.openSlots
  }
  if (readable(access, 'customers')) {
    figures.customersDue = customersDue(workspace.customers || [], period).length
  }
  if (readable(access, 'orders')) {
    figures.income = receivedInPeriod(workspace.income || [], period)
  }
  if (readable(access, 'bankAccounts') && readable(access, 'bankTransactions')) {
    const totals = closingBalances(workspace.bankAccounts || [], workspace.bankTransactions || [], period?.end)
    const kwacha = totals.find((line) => line.currency === 'ZMW')
    figures.cash = kwacha ? kwacha.amount : 0
  }
  return figures
}
