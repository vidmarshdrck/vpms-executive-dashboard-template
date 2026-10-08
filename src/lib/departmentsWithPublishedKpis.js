// Integration point between the KPI submission workflow and the existing
// department scorecard pages. Baseline department KPI actuals
// (src/data/scorecardData.js) are demo/placeholder data; once the GM
// approves a submission, this overlays the published value on top of the
// baseline for every month in that quarter, so DepartmentScorecards.jsx
// (used by both the GM/org "Departments" page and the Dept Head/Staff "My
// department" page) needs no changes beyond reading from here instead of
// `departments` directly.
//
// A quarter is "monthly-flattened" by repeating the one approved quarterly
// figure across its 3 months — the entry form collects one actual per
// quarter, not per month, matching the granularity every other quarterly
// KPI in this app already uses (gmScorecard, financialKPIs, etc).

import { departments } from '../data/scorecardData.js'
import { QUARTERS } from './reportingPeriod.js'
import { getAllPublishedValues, publishedKey } from './kpiSubmissions.js'

export function departmentsWithPublishedKpis() {
  const published = getAllPublishedValues()
  return departments.map((dept) => ({
    ...dept,
    kpis: dept.kpis.map((kpi) => {
      const actuals = kpi.actuals.slice()
      QUARTERS.forEach((quarter, quarterIndex) => {
        const entry = published[publishedKey(dept.id, kpi.code, quarter)]
        if (!entry) return
        const startMonth = quarterIndex * 3
        for (let month = startMonth; month < startMonth + 3; month += 1) actuals[month] = entry.value
      })
      return { ...kpi, actuals }
    }),
  }))
}
