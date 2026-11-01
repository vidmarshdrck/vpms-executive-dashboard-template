import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { taskApiBase } from '../backendStatus.js'
import { bsgPlConfig } from './plConfig.js'
import { catMonth, isPlCalendar, resolveOpeningMonth } from './plCalendar.js'
import { BsgPlCalendar } from './BsgPlCalendar.jsx'

function bsgPlUrl(env, month, mode) {
  const root = taskApiBase(env).replace(/\/api\/tasks$/, '')
  const query = new URLSearchParams({ month, mode })
  return `${root}/api/bsg/pl-calendar?${query}`
}

async function readMonth(env, token, month, mode) {
  const response = await fetch(bsgPlUrl(env, month, mode), {
    headers: { authorization: `Bearer ${token}` },
    credentials: 'omit',
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !isPlCalendar(body)) {
    const error = new Error('calendar_unavailable')
    error.status = response.status
    throw error
  }
  return body
}

export default function BsgSection() {
  const [picked, setPicked] = useState(null)
  const [viewMonth, setViewMonth] = useState(() => catMonth())
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
        const result = picked
          ? { month: picked, data: await readMonth(import.meta.env, token, picked, mode) }
          : await resolveOpeningMonth({
            mode,
            read: (month) => readMonth(import.meta.env, token, month, mode),
          })
        if (!live) return
        setViewMonth(result.month)
        setState({ phase: 'ready', data: result.data, syncedAt: new Date().toISOString() })
      } catch (error) {
        if (live) setState((prev) => ({ phase: error?.status === 401 ? 'signin' : 'unavailable', syncedAt: prev.syncedAt }))
      }
    }
    load()
    return () => { live = false }
  }, [picked, mode])
  return <BsgPlCalendar
    data={state.data ?? null}
    phase={state.phase}
    month={viewMonth}
    mode={mode}
    unit={unit}
    onMonth={(next) => { setPicked(next); setViewMonth(next); setState((prev) => ({ phase: 'loading', syncedAt: prev.syncedAt })) }}
    onMode={(next) => { setPicked(null); setViewMonth(catMonth()); setState((prev) => ({ phase: 'loading', syncedAt: prev.syncedAt })); setMode(next) }}
    syncedAt={state.syncedAt}
    onUnit={setUnit}
  />
}
