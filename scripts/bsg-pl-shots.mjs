// Test-only render. Serves the calendar with the offline CSV aggregated in this process.
// The app never imports this script and never reads the trade file at runtime.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { aggregatePlCalendar, parsePaperTradesCsv, voidExitsOnDay } from '../src/vhpms/bsg/plCalendar.js'
import { bsgPlConfig } from '../src/vhpms/bsg/plConfig.js'

const csv = readFileSync(new URL('../server/fixtures/bsg_paper_trades.csv', import.meta.url), 'utf8')
const trades = parsePaperTradesCsv(csv)
const monthOpts = { month: '2026-10', mode: 'PAPER', riskUsdPerR: bsgPlConfig.riskUsdPerR }
const syncedAt = new Date(Date.now() - 3 * 60 * 1000).toISOString()
const data = { ...aggregatePlCalendar(trades, monthOpts), as_of: syncedAt }
const negative = { ...aggregatePlCalendar(voidExitsOnDay(trades, '2026-10-06'), monthOpts), as_of: syncedAt }
const outDir = '/opt/cursor/artifacts'
mkdirSync(outDir, { recursive: true })

const vite = await createServer({
  configFile: path.resolve('vite.config.js'),
  server: { host: '127.0.0.1', port: 4391, strictPort: true },
  plugins: [{
    name: 'bsg-pl-shot-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (url.pathname === '/pl-data.json') {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(url.searchParams.get('variant') === 'negative' ? negative : data))
          return
        }
        next()
      })
    },
  }],
})
await vite.listen()
const origin = 'http://127.0.0.1:4391'

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'bsg-chrome-'))}`,
  '--remote-debugging-port=9222', 'about:blank',
], { stdio: 'ignore' })

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function debuggerSocket() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9222/json/list').then((res) => res.json())
      const page = list.find((target) => target.type === 'page' && target.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch { /* chrome still booting */ }
    await sleep(150)
  }
  throw new Error('chrome_debug_unavailable')
}

function cdp(ws) {
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
  })
  return {
    send(method, params = {}) {
      const msgId = ++id
      return new Promise((resolve, reject) => {
        pending.set(msgId, { resolve, reject })
        ws.send(JSON.stringify({ id: msgId, method, params }))
      })
    },
  }
}

async function shoot(client, { width, file, shot, cropFooter = false }) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width, height: 900, deviceScaleFactor: 1, mobile: width < 500,
  })
  await client.send('Page.navigate', { url: `${origin}/harness/bsg-pl/index.html?shot=${shot}` })
  const ready = await client.send('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
      const start = Date.now()
      const tick = () => {
        const card = document.querySelector('[data-testid="bsg-pl-card"]')
        if (card && card.dataset.state !== 'loading') resolve(card.dataset.state)
        else if (Date.now() - start > 15000) resolve('timeout')
        else setTimeout(tick, 40)
      }
      tick()
    })`,
    awaitPromise: true,
    returnByValue: true,
  })
  if (ready.result.value === 'timeout') throw new Error(`shot_timeout_${file}`)
  await client.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
  const height = await client.send('Runtime.evaluate', {
    expression: 'Math.ceil(document.documentElement.scrollHeight)',
    returnByValue: true,
  })
  await client.send('Emulation.setDeviceMetricsOverride', {
    width, height: Math.max(height.result.value, 900), deviceScaleFactor: 1, mobile: width < 500,
  })
  await sleep(200)
  const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
  const target = path.join(outDir, file)
  writeFileSync(target, Buffer.from(image.data, 'base64'))
  console.log(`${target} ${ready.result.value} ${width}x${height.result.value}`)
  if (!cropFooter) return
  const mark = await client.send('Runtime.evaluate', {
    expression: `document.fonts.load('700 48px "Open Sans"').then(() => {
      const el = document.querySelector('.vh-pl-wordmark')
      const foot = document.querySelector('.vh-pl-foot')
      const r = foot.getBoundingClientRect()
      const pad = 18
      const canvas = document.createElement('canvas')
      canvas.width = 180
      canvas.height = 96
      const g = canvas.getContext('2d')
      g.font = '700 64px "Open Sans", "Noto Sans", "DejaVu Sans", system-ui, sans-serif'
      g.fillStyle = '#000'
      function ink(ch) {
        g.clearRect(0, 0, canvas.width, canvas.height)
        g.fillText(ch, 8, 72)
        return [...g.getImageData(0, 0, canvas.width, canvas.height).data]
      }
      const latin = ink('A')
      const lambda = ink('\\u039B')
      let diff = 0
      for (let i = 3; i < latin.length; i += 4) if (latin[i] !== lambda[i]) diff += 1
      return {
        x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2,
        text: el.textContent, codes: [...el.textContent].map((ch) => ch.codePointAt(0).toString(16)).join(' '),
        font: getComputedStyle(el).fontFamily, loaded: document.fonts.check('700 32px "Open Sans"'), diff,
      }
    })`,
    awaitPromise: true,
    returnByValue: true,
  })
  const info = mark.result.value
  if (info.text !== 'VIDM\u039BR' || info.codes !== '56 49 44 4d 39b 52' || !info.loaded || info.diff < 30) {
    throw new Error(`wordmark_mismatch ${JSON.stringify(info)}`)
  }
  const crop = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: info.x, y: info.y, width: info.width, height: info.height, scale: 4 },
  })
  const cropPath = path.join(outDir, 'bsg-pl-footer-1440.png')
  writeFileSync(cropPath, Buffer.from(crop.data, 'base64'))
  console.log(`${cropPath} ${info.font} diff=${info.diff}`)
}

try {
  const ws = new WebSocket(await debuggerSocket())
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject) })
  const client = cdp(ws)
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await shoot(client, { width: 1440, file: 'bsg-pl-calendar-1440.png', shot: 'data', cropFooter: true })
  await shoot(client, { width: 390, file: 'bsg-pl-calendar-390.png', shot: 'data' })
  await shoot(client, { width: 1440, file: 'bsg-pl-calendar-empty.png', shot: 'empty' })
  await shoot(client, { width: 1440, file: 'bsg-pl-calendar-negative.png', shot: 'negative' })
  ws.close()
} finally {
  chrome.kill('SIGKILL')
  await vite.close()
}
