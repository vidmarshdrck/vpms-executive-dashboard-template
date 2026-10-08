# KPI Data Entry → GM Approval → Publish Workflow — Implementation Report

## Summary

Built the Draft → Submitted → Approved(=Published) workflow, with a Returned
branch for revision, entirely client-side against `localStorage`, per the
task brief (no live backend exists in this sanitized copy). Verified with a
real headless-browser run of the full flow (see "What was actually tested"
below) — build, lint, and the existing unit test suite all pass.

## Files created

- `src/lib/kpiSubmissions.js` — the service layer. All workflow state
  (`createDraft`, `saveDraft`, `submitForReview`, `listPendingForGM`,
  `approveSubmission`, `returnSubmission`, `getSubmissionHistory`,
  `getPublishedKpiValue`, `getAllPublishedValues`, `listSubmissionsForDepartment`,
  `listAllSubmissions`, `validateValues`, `subscribeToSubmissions`) lives
  here. Storage is one `localStorage` key (`vpms-kpi-submissions`) holding
  `{ submissions: [...], published: {...} }`. Function signatures take a
  `currentUser` and return/throw plain data — no component ever touches
  `localStorage` directly, so swapping the body of each function for a
  `fetch()` call later should not require UI changes.
- `src/lib/departmentsWithPublishedKpis.js` — overlays approved submission
  values onto the baseline department KPI data (see "How approved data
  reaches the dashboard" below).
- `src/lib/useKpiSubmissionsVersion.js` — a tiny hook that bumps a counter on
  any submissions-store change, same-tab (custom event) or another tab (the
  native `storage` event), so dashboards and the approvals queue re-render
  live.
- `src/components/ui/InlineMessage.jsx` — inline success/error banner. There
  is no toast library in this codebase (checked first); this reuses the
  existing `--positive`/`--negative` tint CSS variables via inline style
  rather than introducing a new color or dependency.
- `src/pages/dashboard/KpiEntry.jsx` — Dept Head/Staff entry UI: period
  selector, per-KPI numeric inputs, Save draft / Submit for GM review,
  review-comment display when returned, and a status-history panel.
- `src/pages/dashboard/KpiApprovals.jsx` — GM review UI: pending queue,
  detail panel with submitted values vs. target, comment field, Approve &
  publish / Return for revision, plus a recent-decisions table.

## Files modified

- `src/auth/permissions.js` — added `kpi.submit` (Dept Head/Staff) and
  `kpi.approve` (GM) to `PERMISSION_ROLES`. Did not touch the pre-existing
  but unused `kpi.enter` key.
- `src/App.jsx` — added `/kpi-entry` and `/kpi-approvals` routes, each gated
  by `RequirePermission` (the same route-level guard every other page uses,
  not a hidden nav link).
- `src/components/layout/DashboardLayout.jsx` — added "KPI entry" to the
  Dept Head/Staff nav, and a permission-gated "KPI approvals" item to the
  org-wide nav (visible to GM only, since only GM holds `kpi.approve`).
- `src/pages/dashboard/DepartmentScorecards.jsx` — now computes its
  `departments` from `departmentsWithPublishedKpis()` instead of importing
  the static baseline array directly, re-running on
  `useKpiSubmissionsVersion()`. This is the one existing dashboard rewired
  to the new data; everything else about the page (scoring, charts, tables,
  department-locking for Dept Head/Staff) is unchanged.

## Baseline vs. submission data

Baseline KPI data (`src/data/scorecardData.js`'s `departments`, and
`src/data/kpiData.js`) is untouched and still the default. It is implicitly
treated as "already approved" simply by never being touched by the
submission workflow — there was no need to add a `source: 'baseline'` flag
anywhere, because the overlay in `departmentsWithPublishedKpis.js` only
*replaces* a department/KPI/quarter's monthly actuals when an explicit
`published` entry exists for that exact `(departmentId, kpiCode, quarter)`
key; everywhere else the baseline numbers pass through unchanged. The
composite key (`departmentId::kpiCode::period`) is what prevents two
approved submissions from silently co-existing as "the" official figure for
the same department+KPI+period — approving a revision simply overwrites that
one key.

## How approved data reaches the dashboard

1. Dept Head/Staff fills in `KpiEntry.jsx`, which calls `saveDraft` /
   `submitForReview`.
2. GM reviews in `KpiApprovals.jsx` and calls `approveSubmission`, which (a)
   marks the submission `APPROVED` and (b) in the same call, writes every
   filled-in KPI value into `store.published` keyed by
   `departmentId::kpiCode::period`. There is no separate "publish" step and
   no manual copy — approval *is* publish, as the brief required.
3. `departmentsWithPublishedKpis()` reads `store.published` and, for each
   department/KPI, overlays the approved quarterly value onto the 3 months
   that make up that quarter in the baseline `actuals` array (the entry form
   is quarterly, matching every other quarterly KPI already in this app —
   `gmScorecard`, `financialKPIs`, etc.).
4. `DepartmentScorecards.jsx` (used for both the GM/org "Departments" page
   and the Dept Head/Staff "My department" page) calls this function instead
   of importing `departments` directly, so both views pick up an approval
   immediately — including in a tab that was already open, via the
   `storage` event (verified live, see below).

**Scope limitation, found during testing, not fixed by redesign:**
`DepartmentScorecards.jsx` has a pre-existing, deliberate clamp — it only
ever scores the first `REPORTED_MONTHS` (8, i.e. Jan–Aug) of the 12-month
array, regardless of the header's selected reporting period, specifically so
it never shows non-existent months as zero (see the comment already in that
file). This clamp predates this task and was left alone rather than
redesigned. Consequence: a submission approved for Q4 *does* publish
correctly (it's retrievable via `getPublishedKpiValue` and visible in the
KPI Entry page's "Published" column immediately), but it will not move the
score shown on the Departments/My department page until that clamp is
lifted or the baseline "reported months" window is extended — because Q4's
months (9–11) fall outside the scored range. Submissions for Q1–Q3 are
unaffected and show up immediately. To make the default demo path work out
of the box, `KpiEntry.jsx` defaults its period picker to
`monthIndexToQuarter(REPORTED_MONTHS - 1)` (currently Q3) instead of
today's real calendar quarter, so a freshly-approved submission is visible
immediately rather than landing in a quarter the scorecard page doesn't
render yet. A GM/Dept Head can still pick Q4 explicitly; it will just not
move that page's score until the clamp is addressed separately.

**Executive overview was not wired.** `src/pages/dashboard/Executive.jsx`
computes its company-wide scorecard (`gmScorecard`) from static,
module-level constants, not from any per-department structure — there is no
existing aggregation path from per-department KPIs up to the company-wide
scorecard shown there. Wiring it would mean designing a new aggregation
layer (how do department-level KPI achievements roll up into the 13
GM-level KPIs?), which is a materially different, larger piece of work than
"read from a new data source" and was out of scope for this budget. This
page still shows baseline/static data only.

## Authorization — what exists and where

Enforced at **two layers**, per the brief's "server-side-equivalent"
requirement:

1. **Route layer** (`App.jsx` `RequirePermission`): `/kpi-entry` requires
   `kpi.submit` (Dept Head/Staff only), `/kpi-approvals` requires
   `kpi.approve` (GM only). Navigating directly to either URL without the
   permission redirects away — verified live (see below).
2. **Service layer** (`kpiSubmissions.js`): every mutating function
   independently re-checks the acting user, not just the route:
   - `requireDeptUser(user, departmentId)` — used by `createDraft`,
     `saveDraft`, `submitForReview`, `getActiveSubmission`,
     `listSubmissionsForDepartment`. Throws unless `user.role` is `Dept
     Head`/`Staff` **and** `user.departmentId === departmentId`. This is
     what stops a Dept Head from submitting on another department's behalf
     even if they constructed the right submission ID.
   - `requireGM(user)` — used by `listPendingForGM`, `listAllSubmissions`,
     `approveSubmission`, `returnSubmission`. Throws unless
     `user.role === 'GM'`.
   - A module-header comment explicitly documents that this is enforced
     client-side only because there is no server, and that it is a UX
     convenience, not a real security boundary, until reimplemented against
     a signed server session.

GM edits are never a silent overwrite: `approveSubmission`/`returnSubmission`
only ever write a `reviewComment` field and append to the submission's
`history`; the department's own `values` are untouched by the GM.

## Audit trail

Each submission carries its own append-only `history: [{ status, by: {id,
name, role}, at, comment }]` array, appended on every state transition
(draft created / revision started, submitted, approved, returned). This is
embedded per-record (not routed through the existing `src/lib/activityLog.js`
session log) because `activityLog.js` is sessionStorage-scoped, per-browser-tab,
and designed for "what did I do this session" — not for a persistent,
per-record history that a GM needs to see attached to one specific
submission regardless of who's currently logged in. The pattern (plain
array of timestamped events, `sessionStorage`'s honesty principle of "only
record what actually happened") was kept; the storage location was adapted
to fit the record-scoped need. `getSubmissionHistory(submissionId)` exposes
it independently for future reuse (e.g. an admin audit view).

## What was actually tested (and what was not)

Tested live with Playwright against the Vite dev server (not just
build/lint — actual browser interaction with console-error checking):

- Logged in as `ict_head` (Dept Head), opened KPI entry, filled one KPI
  value, saved, submitted — status badge correctly moved to "Submitted ·
  awaiting GM review" and the field became read-only.
- Logged in as `gm` in a second tab of the **same browser profile**
  (localStorage is shared per-profile, not per-tab — see note below),
  opened KPI approvals, saw the pending submission, approved it with a
  comment.
- Confirmed the Departments page (GM view) and the Dept Head's still-open
  KPI Entry tab both reflected the approval — the Dept Head's tab updated
  **without a manual reload**, confirming the `storage`-event live-sync
  works.
- Logged in as `hr_staff` (a different department) and confirmed: hitting
  `/kpi-approvals` directly redirects away (route guard), and `/kpi-entry`
  shows HR's own KPIs, not ICT's (department-locking).
- Checked browser console/page errors after every step: **none**.
- `npm run build`: **pass**. `npm run lint`: **pass, zero warnings**.
  `npm test` (existing `node --test` suite, 17 tests covering permissions,
  scoring, and demo-data invariants): **pass, unaffected**.

**Important caveat on the multi-user test above:** separate Playwright
*browser contexts* (`browser.newContext()`) are isolated profiles with
*separate* `localStorage`, exactly like different physical browsers — a
first test attempt using one context per user showed "0 pending
submissions" for the GM purely because of this isolation, not an app bug.
The real multi-tab test above used one context, two tabs, which is the
actual supported scenario: **this workflow only synchronizes across tabs of
the same browser profile.** It does **not** synchronize across different
users' machines or different browsers — there is no shared backend. This is
an inherent limitation of a `localStorage`-only implementation and is
expected; it's called out explicitly here so it isn't mistaken for
multi-user support that doesn't exist yet.

**Not tested:** mobile/responsive layout of the two new pages, and the
RETURNED → revise → resubmit loop (traced through the code and the service
layer's own logic, not driven through a browser).

## What still needs real backend wiring

- Every authorization check in `kpiSubmissions.js` needs a server-side
  equivalent against a signed session (JWT/cookie), as documented in that
  file's header comment. Right now a user can call these functions with a
  self-constructed `currentUser` object.
- `localStorage` needs to become real API calls (`fetch`) to a persistence
  layer — the function signatures were deliberately kept backend-agnostic
  (take plain arguments, return/throw plain data, no component touches
  storage directly) so this should be a scoped change inside
  `kpiSubmissions.js` only.
- Real multi-user/multi-machine sync needs a real backend; the `storage`
  event mechanism here only covers same-browser, multi-tab sync.
- The `REPORTED_MONTHS` clamp in `DepartmentScorecards.jsx` should
  eventually be replaced by something that reflects live submission data
  rather than a hardcoded "8 months" baseline constant, once real figures
  are flowing in for all quarters.
- Executive.jsx's org-wide scorecard remains fully static/baseline; wiring
  it needs a designed aggregation from department-level KPI submissions up
  to the 13 GM-level KPIs, which didn't exist before this task either.

## What was NOT built, and why

- **Staff forum** — explicitly out of scope per the task brief (deferred,
  separate feature).
- **Real backend/MySQL/Navision connection** — explicitly out of scope per
  the task brief; this is a sanitized, frontend-only copy, and the live
  production system lives on the client's company server. No MySQL
  credentials, API server, or fake "backend call" were invented.
- **Per-month (vs. per-quarter) KPI entry** — the entry form collects one
  actual per quarter, matching the granularity already used by every other
  quarterly KPI structure in this app (`gmScorecard`, `financialKPIs`,
  `customerKPIs`, etc.) and by the department scorecard's own `direction`/
  `target`/`unit` metadata, which has no monthly-specific fields. Monthly
  entry would need a new UI shape not asked for in the brief.
- **Executive overview wiring** — see above; would require a new
  aggregation design, not just a new data source.
