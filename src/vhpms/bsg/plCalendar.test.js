import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { bsgPlConfig } from './plConfig.js'
import {
  aggregatePlCalendar, bestDayFigure, buildMonthGrid, catMonth, formatPl, formatSyncedAgo, mondayOf, parsePaperTradesCsv, parseTradeTimestamp, resolveOpeningMonth, shiftMonth, syncStatus, voidExitsOnDay,
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
  assert.equal(formatPl(-1.44, 'usd'), '-$1.44')
  assert.equal(formatPl(-1.44, 'r'), '-1.44R')
  assert.equal(formatPl(-9.43, 'usd'), '-$9.43')
  assert.equal(formatPl(0, 'usd'), '$0.00')
  const now = Date.parse('2026-11-01T15:03:00Z')
  assert.equal(formatSyncedAgo('2026-11-01T15:00:00Z', now), '3m ago')
  assert.equal(formatSyncedAgo('2026-11-01T15:02:30Z', now), 'just now')
  assert.equal(formatSyncedAgo('2026-11-01T13:03:00Z', now), '2h ago')
  assert.deepEqual(syncStatus({ phase: 'ready', asOf: '2026-11-01T15:00:00Z', now }), { tone: 'ok', label: 'Synced 3m ago' })
  assert.deepEqual(syncStatus({ phase: 'ready', syncedAt: '2026-11-01T15:00:00Z', now }), { tone: 'ok', label: 'Synced 3m ago' })
  assert.deepEqual(syncStatus({ phase: 'unavailable', now }), { tone: 'stale', label: 'Not synced' })
  assert.deepEqual(syncStatus({ phase: 'signin', asOf: '2026-11-01T15:00:00Z', now }), { tone: 'stale', label: 'Not synced' })
  assert.equal(syncStatus({ phase: 'ready' }).label.startsWith('Synced'), true)
  assert.equal(syncStatus({ phase: 'unavailable' }).label.includes('LIVE'), false)
})

test('opening month follows the current CAT month, then the latest earlier month, and stops after 12', async () => {
  const now = new Date('2026-11-01T08:00:00Z')
  assert.equal(catMonth(now), '2026-11')
  const book = (tradesByMonth) => {
    const calls = []
    const read = async (month) => {
      calls.push(month)
      const trades = tradesByMonth[month] ?? 0
      return { month, summary: { trades, pl_r: trades, pl_usd: trades }, days: [], weeks: [] }
    }
    return { calls, read }
  }
  const current = book({ '2026-11': 4 })
  const opened = await resolveOpeningMonth({ now, mode: 'PAPER', read: current.read })
  assert.equal(opened.month, '2026-11')
  assert.equal(opened.data.summary.trades, 4)
  assert.deepEqual(current.calls, ['2026-11'])

  const earlier = book({ '2026-10': 142, '2026-08': 9 })
  const found = await resolveOpeningMonth({ now, mode: 'DEMO', read: earlier.read })
  assert.equal(found.month, '2026-10')
  assert.equal(found.data.summary.trades, 142)
  assert.deepEqual(earlier.calls, ['2026-11', '2026-10'])

  const none = book({})
  const blank = await resolveOpeningMonth({ now, mode: 'all', read: none.read })
  assert.equal(blank.month, '2026-11')
  assert.equal(blank.data.summary.trades, 0)
  assert.equal(none.calls.length, 13)
  assert.equal(none.calls.at(-1), '2025-11')

  const beyond = book({ '2025-10': 6 })
  const bounded = await resolveOpeningMonth({ now, mode: 'PAPER', read: beyond.read })
  assert.equal(shiftMonth('2026-11', -12), '2025-11')
  assert.equal(shiftMonth('2026-11', -13), '2025-10')
  assert.equal(bounded.month, '2026-11')
  assert.equal(bounded.data.summary.trades, 0)
  assert.equal(beyond.calls.length, 13)
  assert.equal(beyond.calls.at(-1), '2025-11')
  assert.equal(beyond.calls.includes('2025-10'), false)
  await assert.rejects(resolveOpeningMonth({ now, read: async () => { throw new Error('503') } }), /503|calendar_unavailable/)
})

test('dropping 6 Oct is a negative month, and a losing month has no best-day figure', async () => {
  const trades = voidExitsOnDay(parsePaperTradesCsv(await readFile(csvUrl, 'utf8')), '2026-10-06')
  const calendar = aggregatePlCalendar(trades, opts())
  assert.equal(calendar.summary.trades, 114)
  assert.equal(Number(calendar.summary.pl_r).toFixed(2), '-1.44')
  assert.equal(Number(calendar.summary.pl_usd).toFixed(2), '-1.44')
  assert.equal(calendar.summary.profit_factor, 0.98)
  assert.equal(calendar.summary.win_rate, 33.3)
  const week = calendar.weeks.find((row) => row.week_start === '2026-10-05')
  assert.equal(Number(week.pl_r).toFixed(2), '-9.43')
  assert.equal(Number(week.pl_usd).toFixed(2), '-9.43')
  assert.ok(calendar.summary.best_day.pl_r > 0)
  assert.equal(bestDayFigure(calendar, 'usd').day, calendar.summary.best_day.day)
  const losses = aggregatePlCalendar([
    { status: 'CLOSED_SL', mode: 'PAPER', r_multiple: '-1.5', open_ts: '2026-10-12 10:00 CAT', exit_ts: '2026-10-12 11:00 CAT' },
    { status: 'CLOSED_SL', mode: 'PAPER', r_multiple: '-0.5', open_ts: '2026-10-13 10:00 CAT', exit_ts: '2026-10-13 12:00 CAT' },
  ], opts())
  assert.ok(losses.summary.best_day.pl_r < 0)
  assert.equal(bestDayFigure(losses, 'usd'), null)
  assert.equal(bestDayFigure(losses, 'r'), null)
  assert.equal(bestDayFigure(aggregatePlCalendar([], opts()), 'usd'), null)
  assert.equal(bestDayFigure({ summary: { best_day: null }, days: [] }, 'r'), null)
  assert.equal(bestDayFigure({ summary: { best_day: { day: '2026-10-12' } }, days: [] }, 'r'), null)
})
