import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { getPerformanceStatus, getVariance, getKpiPerformance } from '../../lib/dashboardMetrics.js'
import { TONE_TO_BADGE_TONE, TONE_LABEL } from '../../lib/kpiThresholds.js'
import { StatusBadge } from './StatusBadge.jsx'

export function KPIComparison({ actual, target, previous, format = (value) => value, period = 'Current period' }) {
  const variance = getVariance(actual, target)
  const status = getPerformanceStatus(actual, target)
  const DirectionIcon = variance.direction === 'positive' ? ArrowUpRight : variance.direction === 'negative' ? ArrowDownRight : Minus
  const varianceText = variance.percent === null ? 'N/A' : `${variance.percent > 0 ? '+' : ''}${variance.percent.toFixed(1)}%`

  return (
    <div className="kpi-comparison">
      <div className="kpi-comparison-values">
        <span><small>Actual</small><strong>{actual === null || actual === undefined ? 'N/A' : format(actual)}</strong></span>
        <span><small>Target</small><strong>{target === null || target === undefined ? 'N/A' : format(target)}</strong></span>
        {previous !== undefined && <span><small>Previous</small><strong>{previous === null ? 'N/A' : format(previous)}</strong></span>}
      </div>
      <div className="kpi-comparison-footer">
        <StatusBadge label={status.label} tone={status.tone} />
        <span className={`variance variance-${variance.direction}`}><DirectionIcon size={13} />{varianceText}</span>
        <span className="kpi-period">{period}</span>
      </div>
    </div>
  )
}

export function TargetProgress({ actual, target, format = (value) => value, thresholds, showStatus = true }) {
  const ratio = target > 0 && actual !== null && actual !== undefined ? Math.min((actual / target) * 100, 100) : 0
  const performance = getKpiPerformance(actual, target, thresholds)
  return (
    <div className="target-progress">
      <div className="target-progress-track"><div className={`target-progress-fill progress-fill-${performance.tone}`} style={{ width: `${ratio}%` }} /><span className="target-progress-tick" style={{ left: '100%' }} /></div>
      <div className="target-progress-labels"><span>Actual {actual === null || actual === undefined ? 'N/A' : format(actual)}</span><span>Target {target === null || target === undefined ? 'N/A' : format(target)}</span></div>
      {showStatus && <StatusBadge label={TONE_LABEL[performance.tone]} tone={performance.badgeTone} />}
    </div>
  )
}
