import { AlertCircle, CheckCircle2, MinusCircle, TriangleAlert } from 'lucide-react'

const styles = {
  positive: { className: 'status-positive', Icon: CheckCircle2 },
  warning: { className: 'status-warning', Icon: TriangleAlert },
  caution: { className: 'status-caution', Icon: TriangleAlert },
  negative: { className: 'status-negative', Icon: AlertCircle },
  neutral: { className: 'status-neutral', Icon: MinusCircle },
}

export function StatusBadge({ label, tone = 'neutral' }) {
  const { className, Icon } = styles[tone] || styles.neutral
  return <span className={`status-badge ${className}`}><Icon size={13} aria-hidden="true" />{label}</span>
}

export function DataStatus({ source, period, isProvisional = false }) {
  return (
    <div className="data-status" title="Dashboard data provenance">
      <span className="data-status-dot" aria-hidden="true" />
      <span>{isProvisional ? 'Provisional data' : 'Approved data'}</span>
      {period && <><span className="data-status-divider">·</span><span>{period}</span></>}
      <span className="data-status-divider">·</span>
      <span>{source}</span>
    </div>
  )
}
