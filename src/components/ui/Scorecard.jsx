import { DEFAULT_KPI_THRESHOLDS } from '../../lib/kpiThresholds.js'
import { scoreStatus, formatScore } from '../../lib/scoreStatus.js'
import { StatusBadge } from './StatusBadge.jsx'

/**
 * Half-circle gauge for a single headline score. The green threshold is
 * marked on the arc so the reader sees the distance to "on target".
 */
export function ScoreGauge({ value, size = 168, label = 'Overall score', showThreshold = true }) {
  const status = scoreStatus(value)
  const stroke = size * 0.085
  const r = size / 2 - stroke
  const cx = size / 2
  const cy = size / 2
  const length = Math.PI * r
  const clamped = Math.max(0, Math.min(value ?? 0, 100))
  const angle = Math.PI * (1 - DEFAULT_KPI_THRESHOLDS.greenAt / 100)
  const tick = [cx + Math.cos(angle) * (r - stroke), cy - Math.sin(angle) * (r - stroke), cx + Math.cos(angle) * (r + stroke), cy - Math.sin(angle) * (r + stroke)]
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  return (
    <figure className="score-gauge" style={{ width: size }} aria-label={`${label}: ${formatScore(value)}, ${status.label}`}>
      <svg viewBox={`0 0 ${size} ${size / 2 + stroke}`} width={size} height={size / 2 + stroke} aria-hidden="true">
        <path d={arc} fill="none" stroke="var(--surface-subtle)" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={status.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * length} ${length}`}
          className="score-gauge-fill"
        />
        {showThreshold && <line x1={tick[0]} y1={tick[1]} x2={tick[2]} y2={tick[3]} stroke="var(--comparison)" strokeWidth="2" />}
      </svg>
      <figcaption>
        <strong>{formatScore(value)}</strong>
        <span>{label}</span>
      </figcaption>
    </figure>
  )
}

/** Score for one Balanced Scorecard perspective, with its weight and contribution. */
export function PerspectiveScore({ perspective, score, weightShare, contribution, onClick, active = false }) {
  const status = scoreStatus(score)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`perspective-score ${onClick ? 'is-interactive' : ''} ${active ? 'is-active' : ''}`}
      style={{ '--perspective': perspective.color }}
    >
      <div className="perspective-score-head">
        <span className="perspective-dot" aria-hidden="true" />
        <span>{perspective.name}</span>
        {weightShare !== undefined && <span className="perspective-weight">{Math.round(weightShare)}% of KPIs</span>}
      </div>
      <div className="perspective-score-value">{formatScore(score)}</div>
      <div className="perspective-score-track" aria-hidden="true">
        <div style={{ width: `${Math.min(score ?? 0, 100)}%`, background: status.color }} />
        <span style={{ left: `${DEFAULT_KPI_THRESHOLDS.greenAt}%` }} />
      </div>
      <div className="perspective-score-foot">
        <StatusBadge label={status.label} tone={status.badgeTone} />
        {contribution !== undefined && contribution !== null && <span>adds {contribution.toFixed(1)} pts</span>}
      </div>
    </Tag>
  )
}

/** Tiny trend line for table rows. Decorative; the table carries the numbers. */
export function Sparkline({ values, width = 84, height = 24, color = 'var(--comparison)' }) {
  const points = values.map((v, i) => [i, v]).filter(([, v]) => v !== null && v !== undefined)
  if (points.length < 2) return <span className="text-slate-400 text-xs">—</span>
  const ys = points.map(([, v]) => v)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const path = points.map(([i, v], n) => `${n ? 'L' : 'M'} ${(i * step).toFixed(1)} ${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join(' ')
  const [lastI, lastV] = points[points.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="sparkline">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastI * step} cy={height - 3 - ((lastV - min) / span) * (height - 6)} r="2.5" fill={color} />
    </svg>
  )
}

/** Segmented control, styled like the existing timeframe selector. */
export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`segmented-button ${value === option.id ? 'is-active' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Recharts legend text in text ink, not series colour (the swatch carries identity). */
export function LegendLabel({ value }) {
  return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>
}
