// The only list of Operations robots. Set watchUrl to enable Watch and startAction
// (an http or https address) to enable Start. Empty addresses leave the buttons off.
export const OPERATIONS_ROBOTS = [
  { name: 'Valet', status: 'Not connected', watchUrl: '', startAction: '' },
  { name: 'Boaz', status: 'Not connected', watchUrl: '', startAction: '' },
  { name: 'Hermes', status: 'Not connected', watchUrl: '', startAction: '' },
  { name: 'Barnabas', status: 'Not connected', watchUrl: '', startAction: '' },
  { name: 'Bags', status: 'Not connected', watchUrl: '', startAction: '' },
]

export function robotHttpUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export function robotStatus(robot) {
  const status = String(robot?.status || '').trim()
  return status || 'Not connected'
}
