# VHPMS incremental workspace preview

The site root opens the VHPMS sign-in. On GitHub Pages that is `/?preview=vhpms` as well as `/`. Template dashboards stay on their existing paths, starting at `/login`. Set `VITE_BASE_PATH=/` when the app is served at a domain root such as vidmar.tech.

Source: https://github.com/vidmarshdrck/vpms-executive-dashboard-template

This extends the owner's existing VPMS React/Vite executive dashboard template. The existing login, authorization guards, and template routes are unchanged. It uses the template's self-hosted Inter Tight/Outfit fonts, sidebar/operating layout, and semantic status treatments; the owner's `tppl_pms` source was inspected as a related design reference. No new repository or infrastructure was created.

## Sign-in

The username `shadrickvidmar` is Shadrick Vidmar, with the Administrator, General Manager, and HRD (Human Resources Director) roles. Signing in with that username or with `VITE_VHPMS_ADMIN_EMAIL` uses the same account. The credential is checked only by `VITE_VHPMS_AUTH_URL` (POST `{username, password}`, and only `200` with `{ok:true}` is accepted) or by Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VHPMS_ADMIN_EMAIL`). Nothing secret is stored in this repository. See `.env.example`. The GitHub Pages workflow forwards those repository variables. Other roster usernames sign in only when the same service accepts them, or when `VITE_VHPMS_USER_EMAILS` maps them to Supabase emails. An account can hold several roles. All roles shows every section those roles grant. The current-role control narrows the shell to one role.

SMS rows load only after sign-in. They are read from `VITE_VHPMS_SMS_URL` with the session bearer token, or from Supabase table `vhpms_sms_transactions` with the signed-in access token. The client does not query that table without a session, and sign-in starts the read immediately. Expected columns: `id`, `received_at`, `sender` (`MTN`, `Airtel`, or `other`), `transaction_id`, `amount`, `direction` (`in` or `out`), `counterparty`, `raw_message`, `business_id`, `purpose`. With `VITE_VHPMS_SMS_URL`, a label is saved with PATCH `{id, business_id, purpose}` and is kept only when the response is `200` and `{ok:true}`. In a Supabase-only setup, the same label is an update of `vhpms_sms_transactions` and is kept only when the updated row is returned with that id, business, and purpose. A failed save leaves the Inbox item in place. Row level security must allow authenticated select and update, including returning the updated row, and must deny the publishable key on its own. Logout clears the cached messages and signs out of Supabase. No messages are included in the site bundle.

## Functional slice

- Executive summary of actual browser-local tasks and projects, scoped by business within content, not sidebar.
- Operations due queue, own/agent-labelled task create/complete/delete, project create/delete and task associations.
- Editable weekly priorities grouped by Monday; monthly scrollable calendar and month navigation.
- Personal, Business and BSG manual receipt trackers with Paid (green), Pending (orange), Overdue (red) status and ZMW totals. These are user-entered, unverified records, not accounting or verified revenue.
- BSG confidence panel distinguishes baseline Stage 2+ from separate Stage 1 paper exceptions. No fabricated confidence/win-rate, chart URLs, live signals or profit claims.
- Export all local records as JSON; print/PDF uses white paper and black text.

## Honest limitations and security boundary

Public static preview. Starts empty. No private finance, SMS, payment references, bank balances, credentials, internal API addresses or agent tokens are included. Do not enter sensitive information. No connection to Boaz, Supabase, Paperclip or a live trading service is made. Owner labels do not dispatch work. Public preview is not authentication for a real finance system.

Persistence uses the `vhpms-local-v1` localStorage key in this browser. It is not encrypted, synchronized, backed up, an authenticated database, or multi-user. Clearing site data loses records; shared-device users can read them. A failed storage write displays an error and does not claim success. JSON export downloads a local backup; import/restore is not implemented. No service worker, offline guarantee, PWA installation or APK is claimed.

Existing template routes retain existing illustrative datasets; these do not feed the VHPMS preview. Use the explicit preview link above. No existing monorepo dirty files were changed.

## Run and test

```sh
npm ci
npm test
npm run lint
GITHUB_ACTIONS=true npm run build
GITHUB_ACTIONS=true npm run preview -- --host 127.0.0.1 --port 4303
```

Visit `/vpms-executive-dashboard-template/?preview=vhpms` on that local preview. Normal development without `GITHUB_ACTIONS` uses `/?preview=vhpms`. Existing main-branch GitHub Pages workflow deploys with the correct base URL.

## Integration points for future work / Grok

- `src/vhpms/Vhpms.jsx`: scoped workspace views/forms, local state and export.
- `src/vhpms/model.js`: versioned local model, task transition, manual receipt aggregation and date grouping.
- `src/vhpms/model.test.js`: node:test coverage.
- `src/vhpms/vhpms.css`: responsive, mobile navigation, focus and print styling scoped to `.vh-app`.
- `src/App.jsx`: explicit `preview=vhpms` entry, isolated from template auth and datasets.

A production integration must use authenticated server endpoints, business/role-scoped authorization, server-side validation, audit trails and secure transport. Never place service-role keys, Paperclip tokens, SMS receipts, or private financial source files into a Vite bundle, public JSON, or Pages artifacts. Add live connectors behind authenticated server APIs; identify source, freshness and reconciliation status per metric. Finance recognition requires transaction ID, amount and timestamp verification, with personal/business separation. BSG confidence requires provenance and reviewed setup-level outcomes; paper and baseline cohorts must not be mixed.

This is implementation-partial for the broader VHPMS programme, not a completed backend or live-data rollout.
