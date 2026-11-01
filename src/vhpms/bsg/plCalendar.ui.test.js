import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import esbuild from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bsgPlConfig } from './plConfig.js'
import { aggregatePlCalendar, parsePaperTradesCsv, voidExitsOnDay } from './plCalendar.js'

const entry = new URL('./BsgPlCalendar.jsx', import.meta.url)

async function loadCard() {
  const dir = await mkdtemp(path.join(process.cwd(), '.tmp-bsg-pl-'))
  const outfile = path.join(dir, 'card.js')
  await esbuild.build({
    absWorkingDir: path.dirname(entry.pathname),
    entryPoints: [entry.pathname],
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    outfile,
    external: ['react', 'react/jsx-runtime', 'react-dom'],
  })
  return { mod: await import(pathToFileURL(outfile).href), dir }
}

test('card renders dollars by default, the mode tag, and a finished empty state', async () => {
  const { mod, dir } = await loadCard()
  const { BsgPlCalendar } = mod
  try {
  const trades = parsePaperTradesCsv(await readFile(new URL('../../../server/fixtures/bsg_paper_trades.csv', import.meta.url), 'utf8'))
  const now = Date.parse('2026-11-01T15:03:00Z')
  const data = { ...aggregatePlCalendar(trades, { month: '2026-10', mode: 'PAPER', riskUsdPerR: bsgPlConfig.riskUsdPerR }), as_of: '2026-11-01T15:00:00Z' }
  const html = renderToStaticMarkup(createElement(BsgPlCalendar, { data, phase: 'ready', month: '2026-10', mode: 'PAPER', now }))
  assert.match(html, /data-state="ready"/)
  assert.match(html, /data-unit="usd"/)
  assert.match(html, /data-testid="bsg-pl-total">\+\$42\.56</)
  assert.match(html, /data-testid="bsg-pl-best">\+\$44\.00</)
  assert.match(html, /OCT 6/)
  assert.match(html, />142</)
  assert.match(html, />113m</)
  assert.match(html, />1\.48</)
  assert.match(html, /\+\$34\.57/)
  assert.match(html, /28 trades/)
  assert.match(html, /aria-pressed="true">\$</)
  assert.match(html, /data-testid="bsg-pl-mode-tag">Paper</)
  assert.match(html, /data-testid="bsg-pl-mode-switch"/)
  assert.match(html, />Demo</)
  assert.match(html, /data-testid="bsg-pl-sync"[^>]*>[\s\S]*Synced 3m ago/)
  assert.match(html, /vh-pl-sync is-ok/)
  assert.equal(html.includes('LIVE'), false)
  assert.match(html, /vh-pl-week-short">Week</)
  assert.match(html, /aria-label="VIDMAR"/)
  assert.match(html, />VIDMΛR</)
  assert.equal(html.includes('>VIDΛR<'), false)
  assert.equal(html.includes('Vidmar Holdings'), false)
  assert.equal(/fixture|placeholder|sample|preview|Trade Echo/i.test(html), false)
  const rUnit = renderToStaticMarkup(createElement(BsgPlCalendar, { data, phase: 'ready', month: '2026-10', mode: 'PAPER', unit: 'r' }))
  assert.match(rUnit, /data-testid="bsg-pl-total">\+42\.56R</)
  assert.match(rUnit, /data-testid="bsg-pl-best">\+44\.00R</)
  assert.match(rUnit, /\+34\.57R/)
  assert.equal(rUnit.includes('+$42.56'), false)
  assert.equal(rUnit.includes('+$34.57'), false)
  const empty = renderToStaticMarkup(createElement(BsgPlCalendar, { phase: 'unavailable', month: '2026-10', mode: 'PAPER' }))
  assert.match(empty, /data-testid="bsg-pl-total">—<\/strong><p class="vh-pl-note" role="status">Monthly P\/L is unavailable\.<\/p>/)
  assert.match(empty, /vh-pl-sync is-stale/)
  assert.match(empty, /Not synced/)
  assert.equal(empty.includes('LIVE'), false)
  assert.match(empty, /data-testid="bsg-pl-total">—</)
  assert.equal(empty.includes('42.56'), false)
  assert.equal(empty.includes('+$'), false)
  const hidden = renderToStaticMarkup(createElement(BsgPlCalendar, {
    data, phase: 'ready', month: '2026-10', mode: 'PAPER',
    config: { ...bsgPlConfig, showModeTag: false, showModeSelector: false },
  }))
  assert.equal(hidden.includes('bsg-pl-mode-tag'), false)
  assert.equal(hidden.includes('bsg-pl-mode-switch'), false)
  const source = await readFile(entry, 'utf8')
  const section = await readFile(new URL('./BsgSection.jsx', import.meta.url), 'utf8')
  assert.ok(source.includes('VIDM\u039BR'))
  assert.ok(source.includes('aria-label="VIDMAR"'))
  const css = await readFile(new URL('../embed.css', import.meta.url), 'utf8')
  assert.match(css, /\.vh-pl-wordmark\{font-family:"Open Sans"/)
  assert.match(css, /\.vh-pl-weekpl\.is-zero strong[^{]*\{color:#6B7280\}/)
  assert.match(css, /\.vh-pl-sync\{[^}]*color:#6B7280/)
  assert.match(css, /white-space:nowrap/)
  assert.equal(css.includes('.vh-pl-live'), false)
  assert.equal(/\.vh-pl-sync[^{]*\{[^}]*--pl-green/.test(css), false)
  for (const text of [source, section]) {
    assert.equal(text.includes('Vidmar Holdings'), false)
    assert.equal(text.includes('bsg_paper_trades'), false)
    assert.equal(text.includes('fixture.js'), false)
    assert.equal(/\b(placeholder|sample data|preview data)\b/i.test(text), false)
  }
  const negative = aggregatePlCalendar(voidExitsOnDay(trades, '2026-10-06'), { month: '2026-10', mode: 'PAPER', riskUsdPerR: bsgPlConfig.riskUsdPerR })
  const down = renderToStaticMarkup(createElement(BsgPlCalendar, { data: negative, phase: 'ready', month: '2026-10', mode: 'PAPER' }))
  assert.match(down, /vh-pl-hero is-neg/)
  assert.match(down, /data-testid="bsg-pl-total">-\$1\.44</)
  assert.match(down, /vh-pl-weekpl is-neg[\s\S]*?>-\$9\.43</)
  assert.match(down, />114</)
  assert.match(down, />0\.98</)
  assert.match(down, />VIDMΛR</)
  const downR = renderToStaticMarkup(createElement(BsgPlCalendar, { data: negative, phase: 'ready', month: '2026-10', mode: 'PAPER', unit: 'r' }))
  assert.match(downR, /data-testid="bsg-pl-total">-1\.44R</)
  assert.match(downR, />-9\.43R</)
  const losses = aggregatePlCalendar([
    { status: 'CLOSED_SL', mode: 'PAPER', r_multiple: '-1.5', open_ts: '2026-10-12 10:00 CAT', exit_ts: '2026-10-12 11:00 CAT' },
    { status: 'CLOSED_SL', mode: 'PAPER', r_multiple: '-0.5', open_ts: '2026-10-13 10:00 CAT', exit_ts: '2026-10-13 12:00 CAT' },
  ], { month: '2026-10', mode: 'PAPER', riskUsdPerR: bsgPlConfig.riskUsdPerR })
  const blankBest = renderToStaticMarkup(createElement(BsgPlCalendar, { data: losses, phase: 'ready', month: '2026-10', mode: 'PAPER' }))
  assert.match(blankBest, /data-testid="bsg-pl-best">—</)
  assert.equal(blankBest.includes('NaN'), false)
  assert.equal(blankBest.includes('undefined'), false)
  assert.equal(/OCT 1[23]/.test(blankBest), false)
  const noBest = { ...losses, summary: { ...losses.summary, best_day: null, profit_factor: undefined } }
  const dashed = renderToStaticMarkup(createElement(BsgPlCalendar, { data: noBest, phase: 'ready', month: '2026-10', mode: 'PAPER' }))
  assert.match(dashed, /data-testid="bsg-pl-best">—</)
  assert.match(dashed, /Profit factor<\/span><strong>—</)
  assert.equal(dashed.includes('NaN'), false)
  assert.equal(dashed.includes('undefined'), false)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
