import { useEffect, useState } from 'react'
import { readKpiSetup, subscribeToKpiSetup } from './kpiSetup.js'
export function useKpiSetup() {
  const [, update] = useState(0)
  useEffect(() => subscribeToKpiSetup(() => update(value => value + 1)), [])
  try { return { ...readKpiSetup(), error: '' } }
  catch (error) { return { definitions: {}, activations: {}, history: [], error: error.message } }
}
