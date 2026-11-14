// Side-by-side proof of the header timeframe control against the pms_app preview.
import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/pw/node_modules/playwright/index.mjs')
const chromium = playwright.chromium
const outDir = process.env.TF_SHOTS_DIR || '/tmp/tf-shots'
const artifactDir = '/opt/cursor/artifacts'
await mkdir(outDir, { recursive: true })
await mkdir(artifactDir, { recursive: true })

const bundle = await build({
  entryPoints: [new URL('./timeframe-harness.jsx', import.meta.url).pathname],
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
if (!stylesheet) throw new Error('Build the app before taking timeframe screenshots.')
const fontFile = (await readdir(distAssets)).find((name) => name.startsWith('inter-tight-latin-wght-normal-') && name.endsWith('.woff2'))
if (!fontFile) throw new Error('Inter Tight font is missing from the build.')

const referenceCss = (await readFile(new URL('./tfsel-reference/timeframe.css', import.meta.url), 'utf8'))
  .replace(/@import url\([^)]+\);\n/, '')
const referenceHtml = (await readFile(new URL('./tfsel-reference/preview.html', import.meta.url), 'utf8'))
  .replace('</head>', `<style>@font-face{font-family:"Inter Tight";font-style:normal;font-weight:100 900;font-display:block;src:url("/assets/${fontFile}") format("woff2");}.hod-timeframe-popover>summary,.hod-timeframe-panel label,.hod-timeframe-panel button{font-variation-settings:"wght" 600}.hod-timeframe-panel>p{font-variation-settings:"wght" 700}.hod-timeframe-panel select{font-variation-settings:"wght" 400}</style></head>`)
const htmlPath = `${outDir}/harness.html`
const referencePath = `${outDir}/reference.html`
await writeFile(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/${stylesheet}"></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`)
await writeFile(referencePath, referenceHtml.replace('href="timeframe.css"', 'href="/reference.css"'))
await writeFile(`${outDir}/reference.css`, referenceCss)

const server = spawn(process.execPath, ['-e', `
const http=require('http');const fs=require('fs');const path=require('path');
const dist=${JSON.stringify(new URL('../dist/', import.meta.url).pathname)};
const html=${JSON.stringify(htmlPath)};
const reference=${JSON.stringify(referencePath)};
const referenceCss=${JSON.stringify(`${outDir}/reference.css`)};
http.createServer((req,res)=>{
  const url=decodeURIComponent(req.url.split('?')[0]);
  const file=url.startsWith('/assets/')?path.join(dist,url):url.startsWith('/shot/')?path.join(${JSON.stringify(outDir)}, path.basename(url)):url==='/reference'?reference:url==='/reference.css'?referenceCss:url.startsWith('/compare')?path.join(${JSON.stringify(outDir)}, path.basename(url)):html;
  fs.readFile(file,(error,body)=>{
    if(error){res.writeHead(404);res.end('missing');return}
    const type=file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'text/html';
    res.setHeader('content-type', type);
    res.end(body);
  });
}).listen(4318);
`], { stdio: 'ignore' })
await new Promise((resolve) => setTimeout(resolve, 300))

function assertClose(actual, expected, label, failures, tolerance = 0.6) {
  if (Math.abs(actual - expected) > tolerance) failures.push(`${label}: ${actual} expected ${expected}`)
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const failures = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', (error) => failures.push(error.message))
  await page.addInitScript(() => {
    if (!location.search.includes('keep=1')) localStorage.removeItem('vhpms-reporting-period:shadrickvidmar')
  })

  async function readStyles() {
    return page.evaluate(() => {
      const summary = document.querySelector('.hod-timeframe-popover > summary')
      const icon = summary.querySelector('svg')
      const chevron = summary.querySelector('.hod-chevron')
      const panel = document.querySelector('.hod-timeframe-panel')
      const help = panel.querySelector('p')
      const select = panel.querySelector('select')
      const cancel = panel.querySelector('button[data-cancel-period]')
      const apply = panel.querySelector('.btn-primary')
      const pick = (el) => {
        const s = getComputedStyle(el)
        return {
          fontSize: s.fontSize, fontWeight: s.fontWeight, padding: s.padding, radius: s.borderRadius,
          border: s.borderTopWidth, borderColor: s.borderTopColor, color: s.color, background: s.backgroundColor,
          width: s.width, height: s.height, shadow: s.boxShadow, letter: s.letterSpacing, transform: s.textTransform,
          position: s.position, gap: s.columnGap,
        }
      }
      const summaryBox = summary.getBoundingClientRect()
      const panelBox = panel.getBoundingClientRect()
      return {
        summary: pick(summary), icon: pick(icon), chevron: pick(chevron), panel: pick(panel),
        help: pick(help), select: pick(select), cancel: pick(cancel), apply: pick(apply),
        gap: panelBox.top - summaryBox.bottom,
        rightDelta: (summaryBox.right - panelBox.right),
        panelTop: panelBox.top,
        panelRight: window.innerWidth - panelBox.right,
        label: summary.querySelector('span').textContent,
        helpText: help.textContent,
      }
    })
  }

  async function shot(name) {
    await page.screenshot({ path: `${outDir}/${name}.png` })
  }

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.goto('http://127.0.0.1:4318/?shot=header')
    const trigger = page.getByRole('button', { name: 'Select reporting period' })
    try {
      await trigger.waitFor({ timeout: 5000 })
    } catch (error) {
      const body = await page.locator('body').innerText().catch(() => '')
      const html = await page.content()
      console.error(`${width} trigger missing`, body.slice(0, 800), html.slice(0, 1200))
      throw error
    }
    const label = await page.locator('.hod-timeframe-popover summary span').innerText()
    if (label !== 'Oct – Dec 2026') failures.push(`${width} closed label ${JSON.stringify(label)}`)
    if (await page.locator('.hod-timeframe-panel').isVisible()) failures.push(`${width} panel visible while closed`)
    await shot(`vhpms-${width}-closed`)
    await page.getByRole('button', { name: 'Select reporting period' }).click()
    await page.getByRole('button', { name: 'Apply', exact: true }).waitFor()
    const styles = await readStyles()
    if (styles.summary.fontSize !== '11px') failures.push(`${width} trigger font ${styles.summary.fontSize}`)
    if (styles.summary.fontWeight !== '600') failures.push(`${width} trigger weight ${styles.summary.fontWeight}`)
    if (styles.summary.padding !== '4px 8px') failures.push(`${width} trigger padding ${styles.summary.padding}`)
    if (styles.summary.radius !== '6px') failures.push(`${width} trigger radius ${styles.summary.radius}`)
    if (styles.summary.border !== '1px') failures.push(`${width} trigger border ${styles.summary.border}`)
    if (styles.icon.width !== '12px' || styles.icon.height !== '12px') failures.push(`${width} icon ${styles.icon.width} ${styles.icon.height}`)
    if (styles.icon.color !== 'rgb(20, 84, 192)') failures.push(`${width} icon color ${styles.icon.color}`)
    if (styles.chevron.width !== '11px' || styles.chevron.color !== 'rgb(168, 162, 158)') failures.push(`${width} chevron ${styles.chevron.width} ${styles.chevron.color}`)
    if (styles.panel.width !== '256px') failures.push(`${width} panel width ${styles.panel.width}`)
    if (styles.panel.radius !== '12px') failures.push(`${width} panel radius ${styles.panel.radius}`)
    if (styles.panel.padding !== '16px') failures.push(`${width} panel padding ${styles.panel.padding}`)
    if (!styles.panel.shadow.includes('18px') || !styles.panel.shadow.includes('45px') || !styles.panel.shadow.includes('0.28')) failures.push(`${width} shadow ${styles.panel.shadow}`)
    if (styles.help.fontSize !== '10px' || styles.help.transform !== 'uppercase') failures.push(`${width} help ${styles.help.fontSize} ${styles.help.transform}`)
    if (styles.help.fontWeight !== '700' || styles.help.color !== 'rgb(168, 162, 158)') failures.push(`${width} help weight/color ${styles.help.fontWeight} ${styles.help.color}`)
    if (styles.helpText !== 'Reporting period · Executive Dashboard') failures.push(`${width} help copy ${styles.helpText}`)
    if (styles.select.fontSize !== '14px' || styles.select.radius !== '6px') failures.push(`${width} select ${styles.select.fontSize} ${styles.select.radius}`)
    if (styles.select.borderColor !== 'rgb(214, 211, 209)') failures.push(`${width} select border ${styles.select.borderColor}`)
    if (styles.cancel.background !== 'rgba(0, 0, 0, 0)' || styles.cancel.color !== 'rgb(120, 113, 108)') failures.push(`${width} cancel ${styles.cancel.background} ${styles.cancel.color}`)
    if (styles.apply.background !== 'rgb(20, 84, 192)' || styles.apply.color !== 'rgb(255, 255, 255)') failures.push(`${width} apply ${styles.apply.background} ${styles.apply.color}`)
    if (width === 1440) {
      assertClose(styles.gap, 8, 'panel gap', failures)
      assertClose(styles.rightDelta, 0, 'panel right alignment', failures, 1)
      if (styles.panel.position !== 'absolute') failures.push(`1440 panel position ${styles.panel.position}`)
    } else {
      if (styles.panel.position !== 'fixed') failures.push(`390 panel position ${styles.panel.position}`)
      assertClose(styles.panelTop, 126, '390 panel top', failures, 1)
      assertClose(styles.panelRight, 12, '390 panel right', failures, 1)
    }
    await shot(`vhpms-${width}-open`)
    await page.keyboard.press('Escape')
    if (await page.locator('.hod-timeframe-panel').isVisible()) failures.push(`${width} escape left the panel open`)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:4318/?shot=header')
  await page.getByRole('button', { name: 'Select reporting period' }).click()
  await page.locator('select[name="period_to"]').selectOption('8')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  if (await page.locator('.hod-timeframe-popover summary span').innerText() !== 'Oct 2026') failures.push('To earlier than From was not clamped')
  await page.getByRole('button', { name: 'Select reporting period' }).click()
  if (await page.locator('select[name="period_to"]').inputValue() !== '10') failures.push('reopen did not restore the applied To month')
  await page.locator('select[name="period_from"]').selectOption('1')
  await page.locator('select[name="period_to"]').selectOption('3')
  await page.locator('select[name="period_year"]').selectOption('2025')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  if (await page.locator('.hod-timeframe-popover summary span').innerText() !== 'Oct 2026') failures.push('Cancel changed the applied period')
  await page.getByRole('button', { name: 'Select reporting period' }).click()
  if (await page.locator('select[name="period_from"]').inputValue() !== '10') failures.push('reopen did not restore From after Cancel')
  await page.locator('select[name="period_from"]').selectOption('1')
  await page.locator('select[name="period_to"]').selectOption('3')
  await page.locator('select[name="period_year"]').selectOption('2025')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  if (await page.locator('.hod-timeframe-popover summary span').innerText() !== 'Jan – Mar 2025') failures.push('Apply did not keep Jan – Mar 2025')
  const stored = await page.evaluate(() => localStorage.getItem('vhpms-reporting-period:shadrickvidmar'))
  if (stored !== JSON.stringify({ year: 2025, from: 1, to: 3 })) failures.push(`stored period ${stored}`)
  await page.getByRole('button', { name: 'Select reporting period' }).click()
  await page.locator('.page-title').click()
  if (await page.locator('.hod-timeframe-panel').isVisible()) failures.push('outside click left the panel open')
  if (await page.locator('.hod-timeframe-popover summary span').innerText() !== 'Jan – Mar 2025') failures.push('outside click changed the period')

  await page.goto('http://127.0.0.1:4318/?shot=shell&keep=1')
  await page.locator('.page-title', { hasText: 'GM Dashboard' }).waitFor()
  await page.getByRole('button', { name: 'Select reporting period' }).waitFor()
  if (await page.locator('.hod-timeframe-popover summary span').innerText() !== 'Jan – Mar 2025') failures.push('GM shell did not keep the stored period')
  await page.goto('http://127.0.0.1:4318/?shot=activities')
  await page.locator('.page-title', { hasText: 'Activities' }).waitFor()
  if (await page.getByRole('button', { name: 'Select reporting period' }).count()) failures.push('Activities shows the timeframe control')

  const reference = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await reference.goto('http://127.0.0.1:4318/reference')
  await reference.locator('.hod-timeframe-panel').waitFor()
  await reference.screenshot({ path: `${outDir}/selector.png` })
  await reference.close()

  if (failures.length) throw new Error(failures.join('\n'))

  const compare = await browser.newPage({ viewport: { width: 1400, height: 980 } })
  for (const width of [1440, 390]) {
    const html = `<!doctype html><meta charset="utf-8"><title>Timeframe ${width}</title>
      <style>body{margin:0;background:#fff;font:600 14px/1.4 "Inter Tight Variable",sans-serif;color:#1C1917} .row{display:flex;align-items:flex-start;gap:16px;padding:16px} figure{margin:0} figcaption{margin:0 0 8px} img{display:block;border:1px solid #E4E1DB;height:860px;width:auto}</style>
      <div class="row">
        <figure><figcaption>VHPMS closed ${width}</figcaption><img src="/shot/vhpms-${width}-closed.png"></figure>
        <figure><figcaption>VHPMS open ${width}</figcaption><img src="/shot/vhpms-${width}-open.png"></figure>
        <figure><figcaption>selector.png</figcaption><img src="/shot/selector.png"></figure>
      </div>`
    await writeFile(`${outDir}/compare-${width}.html`, html)
    await compare.goto(`http://127.0.0.1:4318/compare-${width}.html`, { waitUntil: 'networkidle' })
    await compare.screenshot({ path: `${artifactDir}/timeframe-${width}-closed-open-vs-reference.png`, fullPage: true })
  }
  await compare.close()
} finally {
  await browser.close()
  server.kill()
}
