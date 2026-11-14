export function Donut({ items, center, format, renderName }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (!total) return null
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const rings = items.reduce((built, item) => {
    const length = circumference * item.value / total
    return { offset: built.offset + length, rings: [...built.rings, { ...item, length, offset: built.offset }] }
  }, { offset: 0, rings: [] }).rings
  return (
    <div className="donut-row">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={center}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="20" />
        {rings.map((item) => (
          <circle key={item.name} cx="70" cy="70" r={radius} fill="none" stroke={item.color} strokeWidth="20" strokeDasharray={`${Math.max(item.length - 1.5, 0)} ${circumference}`} strokeDashoffset={-item.offset} transform="rotate(-90 70 70)">
            <title>{`${item.name}: ${format(item.value)} (${Math.round(100 * item.value / total)}%)`}</title>
          </circle>
        ))}
        <text x="70" y="74" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">{center}</text>
      </svg>
      <div className="dl">
        {items.map((item) => (
          <div key={item.name}><i style={{ background: item.color }} />{renderName ? renderName(item) : <span>{item.name}</span>}<b>{format(item.value)} · {Math.round(100 * item.value / total)}%</b></div>
        ))}
      </div>
    </div>
  )
}

export function ScoreGauge({ pct, caption }) {
  const rag = pct == null ? 'na' : pct >= 100 ? 'green' : pct >= 90 ? 'amber' : 'red'
  const length = Math.PI * 80
  const fill = pct == null ? 0 : Math.max(0, Math.min(pct, 100)) / 100 * length
  const value = pct == null ? '—' : `${Math.round(pct)}%`
  return (
    <figure className="score-gauge">
      <svg viewBox="0 0 200 110" role="img" aria-label={`${caption}: ${value}`}>
        <path className="gauge-track" d="M20,100 A80,80 0 0 1 180,100" />
        <path className="gauge-fill" d="M20,100 A80,80 0 0 1 180,100" style={{ stroke: `var(--rag-${rag})` }} strokeDasharray={`${fill.toFixed(2)} ${(length + 2).toFixed(2)}`} />
      </svg>
      <figcaption><strong>{value}</strong><span>{caption}</span></figcaption>
    </figure>
  )
}

const VIDMAR = 'VIDM\u039BR'

export function VidmarCredit() {
  return <span className="vidmar-credit">Powered by <span className="vidmar-word">{VIDMAR}</span></span>
}

export function PageFooter({ children }) {
  return <footer className="page-footer">{children} <VidmarCredit /></footer>
}
