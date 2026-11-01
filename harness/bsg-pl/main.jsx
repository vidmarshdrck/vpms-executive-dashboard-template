import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter-tight'
import '@fontsource/open-sans/700.css'
import '../../src/index.css'
import '../../src/vhpms/embed.css'
import { BsgPlCalendar } from '../../src/vhpms/bsg/BsgPlCalendar.jsx'

const shot = new URLSearchParams(location.search).get('shot') || 'data'
const shared = { month: '2026-10', mode: 'PAPER', unit: 'usd', onMonth() {}, onMode() {}, onUnit() {} }

const props = await (async () => {
  if (shot === 'empty') return { ...shared, phase: 'unavailable' }
  const variant = shot === 'negative' ? 'negative' : 'data'
  const response = await fetch(`/pl-data.json?variant=${variant}`, { cache: 'no-store' })
  if (!response.ok) return { ...shared, phase: 'unavailable' }
  return { ...shared, phase: 'ready', data: await response.json() }
})()

createRoot(document.getElementById('root')).render(
  <div className="vh-pl-stage"><div className="vh-embed"><BsgPlCalendar {...props} /></div></div>,
)
