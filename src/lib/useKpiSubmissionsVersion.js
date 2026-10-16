import { useEffect, useState } from 'react'
import { subscribeToKpiSetup } from './kpiSetup.js'
import { subscribeToSubmissions } from './kpiSubmissions.js'

// Bumps a counter whenever the KPI submissions store changes, in this tab or
// another one (GM approving in one tab must update a Dept Head's dashboard
// open in another). Components that derive data from kpiSubmissions.js
// should include this in their useMemo dependency list.
export function useKpiSubmissionsVersion() {
  const [version, setVersion] = useState(0)
  useEffect(() => { const update = () => setVersion(value => value + 1); const a = subscribeToSubmissions(update), b = subscribeToKpiSetup(update); return () => { a(); b() } }, [])
  return version
}
