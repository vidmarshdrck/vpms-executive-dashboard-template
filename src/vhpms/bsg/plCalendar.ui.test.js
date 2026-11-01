import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import esbuild from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bsgPlConfig } from './plConfig.js'
import { aggregatePlCalendar, parsePaperTradesCsv } from './plCalendar.js'

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
  const data = aggregatePlCalendar(trades, { month: '2026-10', mode: 'PAPER', riskUsdPerR: bsgPlConfig.riskUsdPerR })
  const html = renderToStaticMarkup(createElement(BsgPlCalendar, { data, phase: 'ready', month: '2026-10', mode: 'PAPER' }))
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
  assert.match(html, />Powered by <b>VIDΛR</)
  assert.equal(html.includes('Vidmar Holdings'), false)
  assert.equal(/fixture|placeholder|sample|preview|Trade Echo/i.test(html), false)
  const rUnit = renderToStaticMarkup(createElement(BsgPlCalendar, { data, phase: 'ready', month: '2026-10', mode: 'PAPER', unit: 'r' }))
  assert.match(rUnit, /data-testid="bsg-pl-total">\+42\.56R</)
  assert.match(rUnit, /data-testid="bsg-pl-best">\+44\.00R</)
  assert.match(rUnit, /\+34\.57R/)
  assert.equal(rUnit.includes('+$42.56'), false)
  assert.equal(rUnit.includes('+$34.57'), false)
  const empty = renderToStaticMarkup(createElement(BsgPlCalendar, { phase: 'unavailable', month: '2026-10', mode: 'PAPER' }))
  assert.match(empty, /Monthly P\/L is unavailable\./)
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
  assert.ok(source.includes('VID\u039BR'))
  for (const text of [source, section]) {
    assert.equal(text.includes('Vidmar Holdings'), false)
    assert.equal(text.includes('bsg_paper_trades'), false)
    assert.equal(text.includes('fixture.js'), false)
    assert.equal(/\b(placeholder|sample data|preview data)\b/i.test(text), false)
  }
  } finally { await rm(dir, { recursive: true, force: true }) }
})
