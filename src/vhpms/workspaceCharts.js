import { MONTHS } from './reportingPeriod.js'
import { monthRows, monthSummary } from './fundsMonth.js'

const MINUS = '\u2212'

export const EMPTY = {
  budget: { title: 'No expense budget set', icon: 'calculator' },
  income: { title: 'No income recorded', icon: 'wallet' },
  expenses: { title: 'No expenses recorded', icon: 'receipt' },
  finances: { title: 'No finances recorded', icon: 'wallet' },
  operations: { title: 'No operations recorded', icon: 'activity' },
  clients: { title: 'No clients recorded', icon: 'users' },
  marketing: { title: 'No marketing recorded', icon: 'megaphone' },
  posts: { title: 'No scheduled posts', icon: 'megaphone' },
  spend: { title: 'No acquisition spend recorded', icon: 'megaphone' },
  accounts: { title: 'No bank account connected', icon: 'landmark' },
  funds: { title: 'No income or expenses recorded', icon: 'wallet' },
}

export function isNeedsNote(note) {
  return /No data connected yet\./.test(String(note || ''))
}

const SHORT_NAMES = { ve: 'VE', vai: 'VAI', rez: 'REZ', bsg: 'BSG', vt: 'VT', eunique: 'Eunique', digital: 'Digital Products' }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function businessShortName(id) {
  return SHORT_NAMES[id] || 'this business'
}

export function emptyDetail(kind, businessId) {
  const name = businessShortName(businessId)
  const lines = {
    budget: `Set a budget to track ${name} spending against it.`,
    income: `Record income to see what ${name} received in this period.`,
    expenses: `Record expenses to see ${name} spending for this period.`,
    finances: `Record income and expenses to follow ${name} for this period.`,
    operations: `Record operations to follow ${name} work in this period.`,
    clients: `Record clients to see who ${name} is working with.`,
    marketing: `Record posts and spend to see how ${name} reaches customers.`,
    posts: `Schedule a post to plan ${name} marketing.`,
    spend: `Record acquisition spend to see what ${name} pays to win a customer.`,
    accounts: `Connect a bank account to see ${name} balances.`,
    funds: `Record income and expenses to follow ${name} cash in this period.`,
  }
  return lines[kind] || ''
}

export function sectionDetail(note, kind, businessId) {
  if (/not visible|Could not load|Sign in|not configured/i.test(note || '')) return note
  return emptyDetail(kind, businessId)
}

export function sourceLine(note) {
  const text = String(note || '').trim()
  if (!text || /will appear here/i.test(text)) return ''
  if (!isNeedsNote(text)) return text
  const body = text.replace(/^No data connected yet\.\s*Needs\s+/i, '').replace(/\.\s*$/, '')
  const source = body.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return source ? `From ${source}.` : ''
}

export function formatDayHeading(value) {
  const iso = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(value || '')
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  const weekday = WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]
  return `${weekday} ${day} ${MONTHS[month - 1]}`
}

export function moneyHidden(note) {
  if (!note) return false
  if (isNeedsNote(note)) return true
  return /not visible|Could not load|Sign in|not configured/i.test(note)
}

export function axisMax(peak) {
  const value = Number(peak) || 0
  if (!(value > 0)) return 1
  const low = value * 1.1
  const high = value * 1.15
  const exponent = Math.floor(Math.log10(low))
  let chosen = null
  for (let power = exponent - 2; power <= exponent + 1; power += 1) {
    const base = 10 ** power
    for (const factor of [1, 2, 2.5, 5]) {
      const step = factor * base
      const rounded = Math.ceil((low - Number.EPSILON) / step) * step
      if (rounded + 1e-6 >= low && rounded <= high + 1e-6 && (chosen == null || step > chosen.step)) chosen = { step, rounded }
    }
  }
  const result = chosen ? chosen.rounded : Math.ceil((low - Number.EPSILON) / 10 ** Math.max(exponent - 1, 0)) * 10 ** Math.max(exponent - 1, 0)
  return Number(result.toPrecision(12))
}

export function weekBars(width, count, seriesCount) {
  const bars = Math.max(seriesCount, 1)
  const weeks = Math.max(count, 1)
  const innerGap = bars > 1 ? 2 : 0
  const minWeekGap = 6
  const gaps = Math.max(weeks - 1, 0)
  let barWidth = bars > 1 ? 5 : 12
  let group = barWidth * bars + innerGap * (bars - 1)
  if (width - weeks * group - gaps * minWeekGap < 0 && bars === 1) {
    barWidth = Math.max(1, (width - gaps * minWeekGap) / weeks)
    group = barWidth
  }
  const spare = width - weeks * group - gaps * minWeekGap
  const weekGap = gaps === 0 ? 0 : minWeekGap + Math.max(0, spare) / gaps
  return { barWidth, innerGap, weekGap, stride: group + weekGap, group }
}

export function formatAmount(amount, currency = 'ZMW') {
  const number = Number(amount)
  if (!Number.isFinite(number)) return '—'
  const absolute = Math.abs(number).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const prefix = currency === 'USD' ? 'USD ' : currency === 'ZMW' ? 'ZMW ' : `${currency} `
  return number < 0 ? `${prefix}${MINUS}${absolute}` : `${prefix}${absolute}`
}

export function sentenceCase(value) {
  const text = String(value || '').trim()
  if (!text) return 'Unspecified'
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export function statusLabel(value) {
  const text = String(value || '').trim()
  if (!text) return 'Unspecified'
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export function formatDisplayDate(value) {
  const iso = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(value || '')
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  return `${day} ${MONTHS[month - 1]} ${iso.slice(0, 4)}`
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
