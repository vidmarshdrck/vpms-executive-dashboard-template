import { createContext, useContext, useMemo, useState } from 'react'
import { monthlyRevenue } from '../data/kpiData.js'
import { defaultTimeframeState, filterSeriesByTimeframe, describeTimeframe, TIMEFRAMES } from './reportingPeriod.js'

const ReportingPeriodContext = createContext(null)

export function ReportingPeriodProvider({ children }) {
  const [timeframe, setTimeframe] = useState(() => defaultTimeframeState(monthlyRevenue.length))

  const value = useMemo(() => ({
    timeframe,
    setTimeframe,
    timeframes: TIMEFRAMES,
    filteredMonthlyRevenue: filterSeriesByTimeframe(monthlyRevenue, timeframe),
    periodLabel: describeTimeframe(monthlyRevenue, timeframe),
    seriesLength: monthlyRevenue.length,
  }), [timeframe])

  return <ReportingPeriodContext.Provider value={value}>{children}</ReportingPeriodContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReportingPeriod() {
  const context = useContext(ReportingPeriodContext)
  if (!context) throw new Error('useReportingPeriod must be used inside ReportingPeriodProvider')
  return context
}
