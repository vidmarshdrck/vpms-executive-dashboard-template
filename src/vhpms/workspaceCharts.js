import { MONTHS } from './reportingPeriod.js'
import { monthRows, monthSummary } from './fundsMonth.js'

export const SECTION_EMPTY = {
  finances: 'Income, expenses, and account balances for this business will appear here.',
  operations: 'Operations for this business will appear here.',
  clients: 'Clients for this business will appear here.',
  funds: 'Income and expenses for this business will appear here.',
  marketing: 'Scheduled posts and acquisition spend for this business will appear here.',
  budget: 'The weekly expense budget for this business will appear here.',
  accounts: 'Balances for each bank account will appear here.',
  income: 'Income recorded for this business will appear here.',
  expenses: 'Expenses recorded for this business will appear here.',
}

export function isNeedsNote(note) {
  return /No data connected yet\./.test(String(note || ''))
}

export function displayNote(note, sentence) {
  if (!note) return ''
  return isNeedsNote(note) ? sentence : note
}

export function moneyHidden(note) {
  if (!note) return false
  if (isNeedsNote(note)) return true
  return /not visible|Could not load|Sign in|not configured/i.test(note)
}

export function formatThousands(amount, currency = 'ZMW') {
  const number = Number(amount)
  if (!Number.isFinite(number)) return '—'
  const sign = number < 0 ? '-' : ''
  const absolute = Math.abs(number)
  const prefix = currency === 'USD' ? 'USD ' : currency === 'ZMW' ? 'ZMW ' : `${currency} `
  let body
  if (absolute >= 1000) {
    const thousands = Math.round((absolute / 1000) * 10) / 10
    body = `${thousands.toFixed(1).replace(/\.0$/, '')}K`
  } else if (absolute >= 100 || Number.isInteger(absolute)) {
    body = String(Math.round(absolute))
  } else {
    body = absolute.toFixed(1).replace(/\.0$/, '')
  }
  return `${prefix}${sign}${body}`
}

export function accountCaption(account) {
  const last4 = String(account?.last4 || '').replace(/\D/g, '').slice(-4)
  const name = String(account?.label || account?.bank || 'Account').replace(/\d{5,}/g, '').replace(/\s{2,}/g, ' ').replace(/\(\s*\)/g, '').trim() || 'Account'
  return last4 ? `${name} · ${last4}` : name
}

export function monthStripRows(rows, months) {
  return (months || []).map((month) => {
    const summary = monthSummary(monthRows(rows, month))
    const index = Number(String(month).slice(5, 7)) - 1
    return { month, label: MONTHS[index] || month, ...summary }
  })
}
