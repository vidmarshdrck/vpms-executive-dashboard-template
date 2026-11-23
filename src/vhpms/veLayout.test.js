import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

const chrome = [process.env.CHROMIUM_PATH, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find((path) => path && existsSync(path))

async function serveHarness() {
  const bundle = await build({
    entryPoints: [new URL('../../scripts/ve-workspace-harness.jsx', import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{"BASE_URL":"/"}' },
  })
  const css = ['theme.css', 'vhpms.css', 'veWorkspace.css'].map((name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')).join('\n')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`
  const server = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end(html) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return { server, url: `http://127.0.0.1:${port}/` }
}

test('VE pages do not scroll sideways at 1440 or 390', { skip: chrome ? false : 'Chrome is not installed' }, async () => {
  const { server, url } = await serveHarness()
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    const page = await browser.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
      await page.goto(url, { waitUntil: 'networkidle' })
      for (const name of ['Overview', 'Customers', 'Funds', 'Accounts']) {
        await page.getByRole('tab', { name, exact: true }).click()
        await page.evaluate(() => window.scrollTo(0, 0))
        const fit = await page.evaluate((tabName) => {
          const tabs = document.querySelector('[aria-label="VE sections"]').getBoundingClientRect()
          const panel = document.querySelector('.slide-page[aria-hidden="false"]')
          const card = panel.querySelector('.card')?.getBoundingClientRect()
          return {
            scroll: document.documentElement.scrollWidth,
            inner: window.innerWidth,
            tabsLeft: tabs.left,
            cardLeft: card ? card.left : null,
            cardRight: card ? card.right : null,
            tabName,
          }
        }, name)
        assert.equal(fit.scroll, fit.inner, `${name} at ${width} scrolls sideways (${fit.scroll} > ${fit.inner})`)
        if (fit.cardLeft != null) {
          assert.ok(Math.abs(fit.cardLeft - fit.tabsLeft) < 2, `${name} at ${width} card starts at ${fit.cardLeft}, tabs at ${fit.tabsLeft}`)
          assert.ok(fit.cardRight <= fit.inner + 1, `${name} at ${width} card ends at ${fit.cardRight}`)
        }
      }
    }
  } finally {
    await browser.close()
    server.close()
  }
})
