// Screenshot harness. The records below are fictional and never shipped in the UI.
import { spawn } from 'node:child_process'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const chromium = playwright.chromium || playwright.default?.chromium

const outDir = process.env.VE_SHOTS_DIR || '/opt/cursor/artifacts/ve-workspace'
await mkdir(outDir, { recursive: true })

const bundle = await build({
  entryPoints: [new URL('./ve-workspace-harness.jsx', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': '{}' },
})
const distAssets = new URL('../dist/assets/', import.meta.url)
const stylesheets = (await readdir(distAssets)).filter((name) => name.startsWith('index-') && name.endsWith('.css'))
const stylesheet = (await Promise.all(stylesheets.map(async (name) => ({ name, time: (await stat(new URL(name, distAssets))).mtimeMs })))).sort((a, b) => b.time - a.time)[0]?.name
if (!stylesheet) throw new Error('Build the app before taking VE screenshots.')
const htmlPath = '/tmp/ve-workspace-harness.html'
await writeFile(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/${stylesheet}"></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`)

const server = spawn(process.execPath, ['-e', `
const http=require('http');const fs=require('fs');const path=require('path');
const root=${JSON.stringify(new URL('../dist/', import.meta.url).pathname)};
const pub=${JSON.stringify(new URL('../public/', import.meta.url).pathname)};
const html=${JSON.stringify(htmlPath)};
http.createServer((req,res)=>{
  const url=decodeURIComponent(req.url.split('?')[0]);
  const file=url.startsWith('/assets/')?path.join(root,url):url.startsWith('/login/')?path.join(pub,url):html;
  fs.readFile(file,(error,body)=>{
    if(error){res.writeHead(404);res.end('missing');return}
    const type=file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':file.endsWith('.webp')?'image/webp':'text/html';
    res.setHeader('content-type', type);
    res.end(body);
  });
}).listen(4317);
`], { stdio: 'ignore' })
await new Promise((resolve) => setTimeout(resolve, 300))

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4317/#login')
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  await page.screenshot({ path: `${outDir}/login-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${outDir}/login-mobile.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://127.0.0.1:4317/?shot=profile')
  await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor()
  await page.screenshot({ path: `${outDir}/profile-desktop.png`, fullPage: true })
  await page.goto('http://127.0.0.1:4317/?shot=activities')
  await page.getByRole('button', { name: 'Add task', exact: true }).waitFor()
  await page.screenshot({ path: `${outDir}/sidebar-desktop.png`, fullPage: false })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://127.0.0.1:4317/')
  await page.getByRole('tab', { name: 'Overview', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Select reporting period' }).waitFor()
  await page.screenshot({ path: `${outDir}/header-timeframe-desktop.png`, fullPage: false })
  await page.getByRole('button', { name: 'Select reporting period' }).click()
  await page.getByText('Reporting period').waitFor()
  await page.screenshot({ path: `${outDir}/timeframe-popover-desktop.png`, fullPage: false })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const pages = ['Overview', 'Family Accounts', 'Customers', 'Funds', 'Accounts', 'Budget', 'Marketing']
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    const label = width === 1440 ? 'desktop' : 'mobile'
    for (const name of pages) {
      await page.getByRole('tab', { name, exact: true }).click()
      await page.waitForFunction((label) => {
        const tab = [...document.querySelectorAll('[aria-label="VE sections"] [role="tab"]')].find((item) => item.textContent === label)
        const panel = document.getElementById(tab?.getAttribute('aria-controls') || '')
        if (!panel) return false
        const view = panel.closest('.slide-viewport').getBoundingClientRect()
        return Math.abs(panel.getBoundingClientRect().x - view.x) < 2
      }, name)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      if (!overflow) throw new Error(`${name} ${label} overflows`)
      if (width === 1440 && name === 'Overview') {
        const cover = await page.evaluate(() => ({ side: document.querySelector('.sidebar').offsetHeight, doc: document.documentElement.scrollHeight }))
        if (cover.side + 1 < cover.doc) throw new Error(`sidebar ${cover.side}px stops short of the ${cover.doc}px page`)
      }
      await page.screenshot({ path: `${outDir}/${name.toLowerCase().replaceAll(' ', '-')}-${label}.png`, fullPage: true })
    }
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    await page.getByRole('tab', { name: 'Family Accounts', exact: true }).click()
    await page.waitForFunction((label) => {
      const tab = [...document.querySelectorAll('[aria-label="VE sections"] [role="tab"]')].find((item) => item.textContent === label)
      const panel = document.getElementById(tab?.getAttribute('aria-controls') || '')
      if (!panel) return false
      const view = panel.closest('.slide-viewport').getBoundingClientRect()
      return Math.abs(panel.getBoundingClientRect().x - view.x) < 2
    }, 'Family Accounts')
    const tableName = width === 1440 ? 'family-accounts-table-1440.png' : 'family-accounts-table-390.png'
    await page.screenshot({ path: `${outDir}/${tableName}`, fullPage: true })
    const opener = page.getByRole('button', { name: /Slots for / }).first()
    await opener.click()
    await page.getByRole('dialog').waitFor()
    const popupName = width === 1440 ? 'family-accounts-members-1440.png' : 'family-accounts-members-390.png'
    await page.screenshot({ path: `${outDir}/${popupName}`, fullPage: false })
    if (width === 1440) await page.screenshot({ path: `${outDir}/family-accounts-popup-desktop.png`, fullPage: false })
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    const afterEscape = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '')
    if (!afterEscape.startsWith('Slots for')) throw new Error(`Escape did not return focus at ${width}: ${afterEscape}`)
    await opener.click()
    await page.getByRole('dialog').waitFor()
    await page.locator('.vh-modal-backdrop').click({ position: { x: 8, y: 8 } })
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    const afterBackdrop = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '')
    if (!afterBackdrop.startsWith('Slots for')) throw new Error(`Backdrop did not return focus at ${width}: ${afterBackdrop}`)
  }
  const secret = await page.locator('body').innerText()
  if (secret.includes('must-not-render')) throw new Error('secret rendered')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.waitForFunction(() => document.querySelector('.vh-app').classList.contains('sidebar-retracted'))
  if (await page.evaluate(() => localStorage.getItem('vhpms-sidebar')) !== 'retracted') throw new Error('sidebar state was not saved')
  await page.screenshot({ path: `${outDir}/sidebar-retracted-desktop.png`, fullPage: false })
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Activities', exact: true }).click()
  await page.getByRole('button', { name: 'Add task', exact: true }).waitFor()
  await page.screenshot({ path: `${outDir}/activities-desktop.png`, fullPage: false })
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await page.getByRole('heading', { name: 'New activity' }).waitFor()
  await page.screenshot({ path: `${outDir}/activities-add-task-desktop.png`, fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await page.locator('#sidebar.open, .sidebar.open').waitFor()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.waitForFunction(() => !document.querySelector('.sidebar').classList.contains('open'))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://127.0.0.1:4317/?business=vai')
  await page.getByRole('tab', { name: 'Overview', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Vidmar AI (VAI)' }).waitFor()
  await page.getByRole('img', { name: 'Month strip' }).first().waitFor()
  const vaiPages = ['Overview', 'Funds', 'Marketing', 'Budget']
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    const label = width === 1440 ? 'desktop' : 'mobile'
    for (const name of vaiPages) {
      await page.getByRole('tab', { name, exact: true }).click()
      await page.waitForFunction((tabName) => {
        const tab = [...document.querySelectorAll('[aria-label="Business sections"] [role="tab"]')].find((item) => item.textContent === tabName)
        const panel = document.getElementById(tab?.getAttribute('aria-controls') || '')
        if (!panel) return false
        const view = panel.closest('.slide-viewport').getBoundingClientRect()
        return Math.abs(panel.getBoundingClientRect().x - view.x) < 2
      }, name)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      if (!overflow) throw new Error(`VAI ${name} ${label} overflows`)
      await page.screenshot({ path: `${outDir}/vai-${name.toLowerCase()}-${label}.png`, fullPage: true })
    }
  }
  await page.goto('http://127.0.0.1:4317/')
  await page.getByRole('tab', { name: 'Overview', exact: true }).waitFor()
  const measures = []
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    for (const [tab, plot] of [['Overview', 'Daily income & expense'], ['Funds', 'Expense flow']]) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      const block = page.locator(`[data-plot="${plot}"]`)
      await block.waitFor()
      await page.waitForFunction((name) => {
        const bars = [...document.querySelectorAll(`[data-plot="${name}"] .plot-bar`)]
        return bars.some((bar) => bar.getBoundingClientRect().width >= 4)
      }, plot)
      const measured = await page.evaluate((name) => {
        const root = document.querySelector(`[data-plot="${name}"]`)
        const label = root.querySelector('.plot-label')
        const bars = [...root.querySelectorAll('.plot-bar')]
        const bar = bars.find((item) => item.getBoundingClientRect().height > 0) || bars[0]
        const labelBox = label.getBoundingClientRect()
        const barBox = bar.getBoundingClientRect()
        return {
          fontSize: getComputedStyle(label).fontSize,
          labelHeight: Math.round(labelBox.height * 10) / 10,
          barWidth: Math.round(barBox.width * 100) / 100,
          plotHeight: Math.round(root.getBoundingClientRect().height * 10) / 10,
        }
      }, plot)
      measures.push({ width, plot, ...measured })
      await block.scrollIntoViewIfNeeded()
      const file = `${plot === 'Daily income & expense' ? 'daily-chart' : 'expense-flow'}-${width}.png`
      const box = await block.boundingBox()
      await page.screenshot({ path: `${outDir}/${file}`, clip: { x: Math.max(box.x, 0), y: Math.max(box.y, 0), width: box.width, height: box.height } })
    }
  }
  const bad = measures.filter((item) => parseFloat(item.fontSize) !== 11 || item.barWidth < 4)
  if (bad.length) throw new Error(`chart pixels ${JSON.stringify(measures)}`)
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ outDir, pages: pages.length, widths: [1440, 390], measures }))
} finally {
  await browser.close()
  server.kill()
}
