// Source-only integrity pin: reconstructed from actual Boaz report, not payment verification.
// Receipt: source-correction-projection-attestation.json. Never trust a payload's declared hash alone.
const SUPPLEMENT_DIGEST = '7ac984a7f1081685dbabb0b505b73026a35752fa434810255df528fd76826bff'
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = v => typeof v === 'string' && v.trim().length > 0
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v
const list = (v, check) => Array.isArray(v) && v.every(check)
const positive = v => Number.isInteger(v) && v > 0
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (record(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}'
  return JSON.stringify(v)
}
// Synchronous SHA-256 over UTF-8 for deterministic browser/server rendering.
export function evidenceDigest(value) {
  const input = new TextEncoder().encode(canonical(value))
  const size = Math.ceil((input.length + 9) / 64) * 64
  const bytes = new Uint8Array(size)
  bytes.set(input); bytes[input.length] = 128
  const view = new DataView(bytes.buffer)
  view.setUint32(size - 8, Math.floor(input.length / 0x20000000))
  view.setUint32(size - 4, input.length * 8)
  const primes = []
  for (let n = 2; primes.length < 64; n++) if (!primes.some(p => p*p <= n && n % p === 0)) primes.push(n)
  const h = primes.slice(0,8).map(p => (Math.sqrt(p) % 1 * 0x100000000) >>> 0)
  const k = primes.map(p => (Math.cbrt(p) % 1 * 0x100000000) >>> 0)
  const rotate = (x,n) => (x >>> n) | (x << (32-n))
  for (let offset = 0; offset < size; offset += 64) {
    const w = new Uint32Array(64)
    for (let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4)
    for (let i=16;i<64;i++) {
      const a=w[i-15], b=w[i-2]
      w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0
    }
    let [a,b,c,d,e,f,g,j]=h
    for (let i=0;i<64;i++) {
      const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0
      const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0
    }
    for (const [i,v] of [a,b,c,d,e,f,g,j].entries()) h[i]=(h[i]+v)>>>0
  }
  return h.map(v=>v.toString(16).padStart(8,'0')).join('')
}
const validAccount = a => record(a) && positive(a.fid) && text(a.product)
  && (a.due_date_unchanged === null || date(a.due_date_unchanged))
  && (a.expected_cycle_count === null || (Number.isInteger(a.expected_cycle_count) && a.expected_cycle_count >= 0))
  && list(a.expected_cycle_dates,date) && (a.expected_cycle_count ?? 0) === a.expected_cycle_dates.length
  && typeof a.continuous_from_anchor_owner_confirmed === 'boolean'
const validCycle = c => record(c) && positive(c.fid) && text(c.cycle_key) && date(c.expected_date)
  && list(c.ledger_candidate_expense_ids,positive) && list(c.unallocated_bank_candidate_handles,text)
export function validReconciliation(data) {
  if (!record(data) || !date(data.as_of) || data.version !== 1 || !list(data.accounts,validAccount) || !list(data.cycles,validCycle)
    || !record(data.summary) || !record(data.confirmed_activity) || !record(data.preserved_activity)) return false
  if (!Object.values(data.confirmed_activity).every(v=>['Active','Inactive'].includes(v))) return false
  const {accounts,cycles,summary}=data
  if (summary.active_fids !== Object.values(data.confirmed_activity).filter(v=>v==='Active').length) return false
  if (new Set(accounts.map(a=>a.fid)).size !== accounts.length || new Set(cycles.map(c=>c.cycle_key)).size !== cycles.length) return false
  if (!cycles.every(c=>accounts.some(a=>a.fid===c.fid && a.expected_cycle_dates.includes(c.expected_date)))) return false
  if (!accounts.every(a=>(a.expected_cycle_count ?? 0)===cycles.filter(c=>c.fid===a.fid).length)) return false
  const candidates=cycles.filter(c=>c.ledger_candidate_expense_ids.length || c.unallocated_bank_candidate_handles.length).length
  return summary.expected_cycles===cycles.length && summary.cycles_with_candidate_evidence===candidates
    && summary.unreconciled_cycles===cycles.length && summary.cycles_with_verified_payment===0
}
const validOrder = o => record(o) && text(o.oid) && (o.cid === null || text(o.cid)) && text(o.product)
  && typeof o.amount_equal === 'boolean' && date(o.order_date)
const validSlot = s => record(s) && text(s.cid) && positive(s.fid) && positive(s.slot) && text(s.product)
  && typeof s.owner_current_active === 'boolean' && s.historical_connection_proven === false
const validLink = r => record(r) && text(r.key) && ['MTN','Airtel'].includes(r.provider)
  && list(r.orders,validOrder) && list(r.current_slots,validSlot) && typeof r.amount_match === 'boolean'
  && r.amount_match === r.orders.some(o=>o.amount_equal) && r.verified === false && r.historical_connection_proven === false
export function validSupplement(s) {
  if (!record(s) || !record(s.summary) || !list(s.customer_cash_links,validLink) || !list(s.current_slot_memberships,validSlot)) return false
  const rows=s.customer_cash_links, e=s.summary
  if (new Set(rows.map(r=>r.key)).size !== rows.length) return false
  if (e.incoming_tid_groups_including_invalid !== rows.length
    || e.groups_matching_exact_order_tid !== rows.filter(r=>r.orders.length).length
    || e.groups_with_order_amount_match !== rows.filter(r=>r.amount_match).length
    || e.exact_tid_groups_with_amount_mismatch !== rows.filter(r=>r.orders.length && !r.amount_match).length
    || e.groups_with_current_product_slot !== rows.filter(r=>r.current_slots.length).length
    || e.groups_with_current_active_product_slot !== rows.filter(r=>r.current_slots.some(slot=>slot.owner_current_active)).length
    || e.payment_verifications_performed !== 0 || e.historically_proven_family_allocations !== 0) return false
  return evidenceDigest(s) === SUPPLEMENT_DIGEST
}
