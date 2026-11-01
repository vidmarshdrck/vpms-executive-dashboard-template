import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { bsgPlConfig } from './plConfig.js'
import {
  aggregatePlCalendar, buildMonthGrid, catMonth, formatPl, mondayOf, parsePaperTradesCsv, parseTradeTimestamp,
} from './plCalendar.js'

const csvUrl = new URL('../../../server/fixtures/bsg_paper_trades.csv', import.meta.url)
const opts = (extra = {}) => ({ month: '2026-10', mode: 'PAPER', riskUsdPerR: bsgPlConfig.riskUsdPerR, ...extra })
const money = (row) => ({ r: Number(row.pl_r).toFixed(2), usd: Number(row.pl_usd).toFixed(2) })

test('config keeps $1 per R, dollar display, and the mode tag on', () => {
  assert.equal(bsgPlConfig.riskUsdPerR, 1)
  assert.equal(bsgPlConfig.defaultUnit, 'usd')
  assert.equal(bsgPlConfig.showModeTag, true)
  assert.equal(bsgPlConfig.showModeSelector, true)
})

test('paper CSV matches the calendar contract for October 2026', async () => {
  const trades = parsePaperTradesCsv(await readFile(csvUrl, 'utf8'))
  assert.equal(trades.length, 150)
  assert.equal(trades.filter((trade) => String(trade.status).startsWith('VOID')).length, 8)
  const calendar = aggregatePlCalendar(trades, opts())
  assert.equal(calendar.source, 'boaz.paper_trades')
  assert.equal(calendar.mode, 'PAPER')
  assert.equal(calendar.timezone, 'Africa/Lusaka')
  assert.equal(calendar.month, '2026-10')
  assert.equal(calendar.risk_usd_per_r, 1)
  assert.equal(calendar.summary.trades, 142)
  assert.equal(money(calendar.summary).r, '42.56')
  assert.equal(money(calendar.summary).usd, '42.56')
  assert.equal(calendar.summary.win_rate, 43.7)
  assert.equal(calendar.summary.avg_hold_minutes, 113)
  assert.equal(calendar.summary.profit_factor, 1.48)
  assert.deepEqual(calendar.summary.best_day, { day: '2026-10-06', pl_r: 44 })
  assert.equal(calendar.summary.worst_day.day, '2026-10-14')
  assert.equal(Number(calendar.summary.worst_day.pl_r).toFixed(2), '-4.51')
  const days = Object.fromEntries(calendar.days.map((day) => [day.day, day]))
  assert.deepEqual(calendar.days.map((day) => day.day), [
    '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14',
    '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
  ])
  assert.equal(days['2026-10-06'].trades, 28)
  assert.equal(days['2026-10-06'].wins, 24)
  assert.equal(days['2026-10-06'].losses, 4)
  assert.equal(money(days['2026-10-07']).r, '-3.51')
  assert.equal(days['2026-10-07'].trades, 3)
  assert.equal(calendar.days.reduce((sum, day) => sum + day.trades, 0), 142)
  assert.equal(calendar.days.reduce((sum, day) => sum + day.wins, 0), 62)
  assert.deepEqual(calendar.weeks.map((week) => [week.week_start, Number(week.pl_r).toFixed(2), week.trades]), [
    ['2026-10-05', '34.57', 49],
    ['2026-10-12', '7.67', 40],
    ['2026-10-19', '0.32', 53],
  ])
  assert.equal(mondayOf('2026-10-07'), '2026-10-05')
  const priced = aggregatePlCalendar(trades, opts({ riskUsdPerR: 40 }))
  assert.equal(Number(priced.summary.pl_usd).toFixed(2), '1702.40')
  assert.equal(Number(priced.summary.pl_r).toFixed(2), '42.56')
  assert.equal(aggregatePlCalendar(trades, opts({ mode: 'DEMO' })).summary.trades, 0)
  assert.equal(aggregatePlCalendar(trades, opts({ mode: 'all' })).summary.trades, 142)
  const grid = buildMonthGrid(calendar.month, calendar.days, calendar.weeks)
  assert.equal(grid.length, 5)
  assert.deepEqual(grid[0].cells.map((cell) => cell?.dayNum ?? null), [null, null, null, 1, 2])
  assert.equal(grid[1].cells[1].date, '2026-10-06')
  assert.equal(Number(grid[1].pl_r).toFixed(2), '34.57')
  assert.equal(grid[1].winDays, 1)
  assert.equal(grid[1].lossDays, 3)
  assert.equal(grid[0].trades, 0)
})

test('CAT exit date, closed trades only, and the pnl column is not the dollar figure', () => {
  const cross = {
    status: 'CLOSED_SL', mode: 'PAPER', r_multiple: '-1.01', pnl: '999',
    open_ts: '2026-10-06 10:30 CAT', exit_ts: '2026-10-31 23:30 UTC',
  }
  const october = aggregatePlCalendar([cross], opts())
  assert.equal(october.summary.trades, 0)
  const november = aggregatePlCalendar([cross], opts({ month: '2026-11' }))
  assert.equal(november.days[0].day, '2026-11-01')
  assert.equal(Number(november.summary.pl_r).toFixed(2), '-1.01')
  assert.equal(Number(november.summary.pl_usd).toFixed(2), '-1.01')
  const ignored = [
    { status: 'VOID_DATA_BUG', mode: 'PAPER', r_multiple: '5', open_ts: '2026-10-06 10:00 CAT', exit_ts: '2026-10-06 11:00 CAT' },
    { status: 'OPEN', mode: 'PAPER', r_multiple: '2', open_ts: '2026-10-06 10:00 CAT', exit_ts: '2026-10-06 12:00 CAT' },
    { status: 'CLOSED', mode: 'PAPER', r_multiple: '2', open_ts: '2026-10-06 10:00 CAT', exit_ts: '2026-10-06 12:00 CAT' },
    { status: 'CLOSEDX', mode: 'PAPER', r_multiple: '2', open_ts: '2026-10-06 10:00 CAT', exit_ts: '2026-10-06 12:00 CAT' },
    { status: 'CLOSED_TP', mode: 'DEMO', r_multiple: '2', open_ts: '2026-10-06 10:00 CAT', exit_ts: '2026-10-06 12:00 CAT' },
    { status: 'CLOSED_TP', mode: 'PAPER', r_multiple: '', pnl: '50', open_ts: '2026-10-06 10:00 CAT', exit_ts: '2026-10-06 12:00 CAT' },
  ]
  assert.equal(aggregatePlCalendar(ignored, opts()).summary.trades, 0)
  const empty = aggregatePlCalendar([], opts())
  assert.equal(empty.summary.trades, 0)
  assert.equal(empty.summary.pl_r, 0)
  assert.equal(empty.summary.win_rate, null)
  assert.equal(empty.summary.avg_hold_minutes, null)
  assert.equal(empty.summary.profit_factor, null)
  assert.equal(empty.summary.best_day, null)
  assert.deepEqual(empty.days, [])
  assert.deepEqual(empty.weeks, [])
  assert.equal(catMonth(new Date('2026-10-31T23:00:00Z')), '2026-11')
  assert.equal(parseTradeTimestamp('2026-10-07 01:21 CAT'), Date.parse('2026-10-06T23:21:00Z'))
  assert.equal(formatPl(42.56, 'usd'), '+$42.56')
  assert.equal(formatPl(42.56, 'r'), '+42.56R')
  assert.equal(formatPl(-4.51, 'usd'), '-$4.51')
  assert.equal(formatPl(0, 'usd'), '$0.00')
})
