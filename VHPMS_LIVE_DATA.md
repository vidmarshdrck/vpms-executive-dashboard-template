# VHPMS authorised live-data increment

## Verified boundary

The existing React/Vite VHPMS now contains a Supabase Auth read-only live module, separate from browser-local planning records but sharing its navigation and shell. No demo authentication grants live access. Sessions stay in memory; no source service key ships to browsers. Hosted VHPMS-only builds start at the live sign-in module, not the legacy template demo login.

**Remote SQL is NOT applied.** Available credentials allow REST access, not DDL/Management API. The live REST catalog has VE tables but no VHPMS tables; non-public schemas including `boaz` return PGRST106. API discovery cannot prove what unexposed PostgreSQL schemas contain. Do not rerun the stale `supabase_specialist_schemas.sql`; `boaz_schema_v1.sql` supersedes its Boaz portion.

## SQL deployment / owner action

1. Owner/Micah: inspect actual PostgreSQL catalog for any unexposed equivalent project/task tables; adapt rather than duplicate if found. Run `sql/20261015_vhpms.sql` using the existing Supabase SQL editor or a scoped DB connection. No access policy on existing VE/Boaz tables is changed.
2. Run optional `sql/20261015_ve_readonly.sql` only on the discovered existing project after confirming `public.family_accounts.due_date` is a date. It adds one membership-checked, security-definer aggregate RPC; it copies no customer data. Anonymous execution is revoked; authenticated users without VE membership are denied.
3. Ira/owner: provision the real owner's existing `auth.users.id` into `vhpms_memberships` for explicitly authorised businesses only. Do not create an open membership policy or insert all users. The browser uses the existing Supabase email/password provider. No account/password is invented or reset.
4. Nehemiah/owner: provision business/category taxonomy and approved matrix values with rationale, approver and approval timestamp. No arbitrary business weighting is seeded. BSG safety urgency is not a financial-profit ranking. Source priorities remain unchanged when no exact approved rule exists.
5. Nathan: manually run the bounded sync with server-side environment variables and private explicit project/business bindings:

   `node scripts/sync-paperclip.mjs --bindings /private/project-business-bindings.json`

   This is a read-only dry-run. Only add `--apply` after migration and provisioning. Supply `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` through the server environment, never VITE variables or command arguments. No unattended job is installed. Writes upsert composite `(business_id, external_id)` keys; each source field is read back. A sync-run success record is emitted only after complete readback. Partial failures leave prior/partial rows stale; no transactional whole-snapshot claim. Source deletions are not mirrored in this increment; old rows become stale rather than silently deleted.

## Priority and source semantics

Adapted from the actual `vidmarshdrck/tppl_pms/src/lib/ticketPriority.js` implementation at commit `bfaf2430f8e849cc6e81cec7609aed33c2404067`: exact two-key mapping, no owner weighting. VHPMS substitutes business + task category. Security-invoker SQL view returns audited manual override, approved rule, then source priority. Unknown categories and priorities stay unknown/source-derived; historical source values are not overwritten. Overrides need an actor and rationale and append an activity entry. Browser reads are SELECT-only. Server ingestion omits override/category columns so source refresh cannot erase human classification. Category assignment and approved rule provisioning remain explicit administrator operations, not title-based guesses.

Source `in_progress` is shown verbatim, never as evidence that code is executing. Fifteen-minute freshness is a display threshold, not a claim a scheduler exists. Due dates, schedules, dependency edges, gate text and deliverable links have persistent schema fields, but source Paperclip issues currently expose no task due-date field; none is invented. No finance, personal-health or customer-contact records are backfilled. Initial real-source dry run scopes only the canonical BSG project; broader project/business mappings need review.

## Existing VE / AI integration

Existing VE code: active local FastAPI dashboard `Businesses/Vidmar Entertainment/ve-n8n/dashboard/server.py` (listening on 127.0.0.1:8095), plus Streamlit `dashboard.py` and `data/files/VE_Analytics_Dashboard.html`. Its cookie-auth `/api/data` reads customers/orders/expenses/family accounts; it must not be proxied publicly or embedded. `/api/agent` launches the Barnabas Hermes profile and has prompt-level confirmation instructions, not a scoped read-only tool boundary. Existing cookies/user hashes are not converted into Supabase identities or guessed. Reuses existing `public.family_accounts` through the restricted aggregate RPC in this VHPMS module. Counts describe rows/dates, not verified active customers, failed renewals, revenue or profit. Underlying source last-update time is unavailable and shown as such. No admin iframe, customer names, phones, receipts or finance rows are exposed.

Existing TPPL quick chat (`src/lib/tazai.js`) is a regex/scripted reply helper, not a verified model endpoint. AI chat remains visibly present but disabled/not connected pending a scoped authenticated server integration, provider entitlement and write-confirmation design. No paid provider request is made. Google/Calendar consent is a separate gate.

## Verification

`npm test` includes existing tests plus deterministic priority/source-projection tests and disposable PGlite PostgreSQL-engine execution of both migrations. Tests cover replay, anonymous denial, per-business isolation, no self-enrollment, priority approval requirements, security-invoker view isolation, manual override auditing, cross-business foreign keys and VE-member-only aggregates. Fixtures are test-only, never live data. This does not claim a remote migration or successful owner login.

Public build variables are only the existing Supabase URL and publishable key. Service-role credentials remain server-side. Existing public demo routes are preserved for the original template but cannot access the new SQL records; hosted VHPMS-only builds bypass that demo login entirely.
