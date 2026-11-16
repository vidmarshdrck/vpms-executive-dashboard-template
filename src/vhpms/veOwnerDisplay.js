import { validReconciliation } from './veEvidence.js'

// Owner-authorised VE display configuration. Not a database write or payment verification.
// Authority: immediate-dashboard-release-request.md, 14 November 2026 confirmation.
export const VE_OWNER_DISPLAY = Object.freeze({
  version: 1,
  asOf: '2026-11-14',
  active: Object.freeze([1,2,3,4,5,6,8,9,10,11,13,14,16,18]),
  inactive: Object.freeze([7,12,15,17]),
})

export function ownerDisplayFor(sources, reconciliation) {
  const rows = sources.familyAccounts?.rows
  // Never reveal a snapshot through signed-out, blocked, partial or malformed reads.
  if (sources.familyAccounts?.access !== 'ok' || !Array.isArray(rows) || rows.length !== 18) return null
  const ids = new Set(rows.map(row => Number(row?.fid)))
  if (ids.size !== 18 || !Array.from({length:18}, (_,i)=>i+1).every(id => ids.has(id))) return null
  // A same-date or newer operational event remains authoritative; this is a fallback.
  if (validReconciliation(reconciliation) && reconciliation.as_of >= VE_OWNER_DISPLAY.asOf) return null
  return VE_OWNER_DISPLAY
}
