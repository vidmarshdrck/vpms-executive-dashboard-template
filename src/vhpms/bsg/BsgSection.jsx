import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { taskApiBase } from '../backendStatus.js'
import { bsgPlConfig } from './plConfig.js'
import { catMonth, isPlCalendar } from './plCalendar.js'
import { BsgPlCalendar } from './BsgPlCalendar.jsx'

function bsgPlUrl(env, month, mode) {
  const root = taskApiBase(env).replace(/\/api\/tasks$/, '')
  const query = new URLSearchParams({ month, mode })
  return `${root}/api/bsg/pl-calendar?${query}`
}

export default function BsgSection() {
  const [month, setMonth] = useState(() => catMonth())
  const [mode, setMode] = useState('PAPER')
  const [unit, setUnit] = useState(bsgPlConfig.defaultUnit)
  const [state, setState] = useState({ phase: 'loading' })
  useEffect(() => {
    let live = true
    async function load() {
      try {
        const token = (await supabase?.auth?.getSession())?.data?.session?.access_token
        if (!token) {
          if (live) setState((prev) => ({ phase: 'signin', syncedAt: prev.syncedAt }))
          return
        }
        const response = await fetch(bsgPlUrl(import.meta.env, month, mode), {
          headers: { authorization: `Bearer ${token}` },
          credentials: 'omit',
          cache: 'no-store',
        })
        const body = await response.json().catch(() => null)
        if (!live) return
        if (response.ok && isPlCalendar(body)) setState({ phase: 'ready', data: body, syncedAt: new Date().toISOString() })
        else setState((prev) => ({ phase: response.status === 401 ? 'signin' : 'unavailable', syncedAt: prev.syncedAt }))
      } catch {
        if (live) setState((prev) => ({ phase: 'unavailable', syncedAt: prev.syncedAt }))
      }
    }
    load()
    return () => { live = false }
  }, [month, mode])
  return <BsgPlCalendar
    data={state.data ?? null}
    phase={state.phase}
    month={month}
    mode={mode}
    unit={unit}
    onMonth={(next) => { setState((prev) => ({ phase: 'loading', syncedAt: prev.syncedAt })); setMonth(next) }}
    onMode={(next) => { setState((prev) => ({ phase: 'loading', syncedAt: prev.syncedAt })); setMode(next) }}
    syncedAt={state.syncedAt}
    onUnit={setUnit}
  />
}
