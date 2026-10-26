import { departments, PERSPECTIVES } from '../data/scorecardData.js'
import { QUARTERS } from './reportingPeriod.js'
import { getAllPublishedValues, publishedKey } from './kpiSubmissions.js'
import { readKpiSetup, kpiPeriod, LEGACY_KPI_YEAR } from './kpiSetup.js'
import { periodAchievement, scoreScorecard } from './scorecard.js'
export function departmentsWithPublishedKpis(year = new Date().getFullYear(), months = Array.from({ length: 12 }, (_, index) => index), activatedOnly = false) {
  const published = getAllPublishedValues(), setup = readKpiSetup()
  return departments.map(department => {
    const candidates = new Map()
    QUARTERS.forEach((quarter, index) => {
      if (!months.some(month => Math.floor(month / 3) === index)) return
      const activation = setup.activations[`${department.id}::${kpiPeriod(year, quarter)}`]
      const definitions = activation?.kpis || (!activatedOnly && Number(year) === LEGACY_KPI_YEAR ? department.kpis : [])
      definitions.forEach(kpi => candidates.set(kpi.code, kpi))
    })
    const kpis = [...candidates.values()].map(definition => {
      const actuals = Array(12).fill(null), targets = Array(12).fill(null), directions = Array(12).fill(null)
      QUARTERS.forEach((quarter, index) => {
        const period = kpiPeriod(year, quarter), activation = setup.activations[`${department.id}::${period}`]
        const kpi = activation?.kpis.find(item => item.code === definition.code) || (!activation && !activatedOnly && Number(year) === LEGACY_KPI_YEAR ? department.kpis.find(item => item.code === definition.code) : null)
        if (!kpi) return
        const entry = published[publishedKey(department.id, kpi.code, period)]
        for (let month = index * 3; month < index * 3 + 3; month++) {
          targets[month] = kpi.target; directions[month] = kpi.direction
          actuals[month] = activation ? entry?.value ?? null : kpi.actuals?.[month] ?? null
        }
      })
      return { ...definition, actuals, targets, directions }
    })
    return { ...department, kpis }
  })
}
export function activatedKpiScore(year, months) {
  const setup = readKpiSetup()
  const active = Object.values(setup.activations).some(activation => activation.year === Number(year) && months.some(month => Math.floor(month / 3) === QUARTERS.indexOf(activation.quarter)))
  if (!active) return null
  const kpis = departmentsWithPublishedKpis(year, months, true).flatMap(department => department.kpis.map(kpi => ({ ...kpi, achievement: periodAchievement(kpi, months) })))
  return scoreScorecard(PERSPECTIVES, kpis)
}
