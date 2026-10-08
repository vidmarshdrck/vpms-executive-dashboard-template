import { AlertCircle, CheckCircle2 } from 'lucide-react'

// Lightweight inline success/error banner. There is no toast library in
// this app (checked StatusBadge.jsx / DataStatus for the existing
// notification pattern) — this reuses the same tint/color CSS variables as
// StatusBadge (via inline style, to avoid a specificity fight with the
// `.status-badge` class) rather than introducing a new color.
export function InlineMessage({ tone = 'neutral', children }) {
  if (!children) return null
  const isError = tone === 'negative'
  const Icon = isError ? AlertCircle : CheckCircle2
  const style = { background: isError ? 'var(--negative-tint)' : 'var(--positive-tint)', color: isError ? 'var(--negative)' : 'var(--positive)' }
  return (
    <div style={style} className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium" role={isError ? 'alert' : 'status'}>
      <Icon size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
