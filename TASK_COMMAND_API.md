# Authenticated task commands for Bags / Bags-Mark

## State: implemented and locally tested, NOT production-connected

This is an additive API/tool bridge **inside the existing VHPMS repository**, not another task system. Production persistence uses the same Supabase `public.vhpms_tasks` / `vhpms_task_priorities` read by `src/vhpms/LiveWorkspace.jsx`; refresh that live module to see committed tasks. The browser-local planner is deliberately NOT treated as shared storage. No UI changed. No listener, gateway plugin, background job, Supabase migration or identity was installed remotely.

Known prerequisites remain blocked (see `VHPMS_LIVE_DATA.md` and existing handoff reports): the shared project is `bbpfkjucsabdfcmusqzu`; prepared canonical tables were absent from its exposed REST catalog; there is no established project Auth UUID for the owner-confirmed account. Prior complete project Auth discovery returned `users: []`. Platform/dashboard sign-in is not an application Auth identity. Do not guess a UUID, create/reset/invite an account, relax RLS, or silently use a different database. The new command migration is prepared, not applied.

## Components

- `server/task-api.js`: authenticated, bounded JSON HTTP router, structured allowlist validation, create/read/update only; writes require exact post-commit canonical readback.
- `server/supabase-store.js`: Auth `/auth/v1/user` validates each bearer token online; only the explicitly configured actual owner UUID is accepted. Reads use that token and publishable key, preserving RLS. Writes use a **server-only** service credential for a narrowly scoped transactional RPC.
- `sql/20261016_task_commands.sql`: additive canonical task source/revision fields, default-deny `can_write` membership, service-role-only command RPC, transactional deduplication and audit. No new task database, rule seeds, membership grants or Auth users.
- `server/start.js`: environment-gated loopback listener; no SQLite/PGlite/memory fallback. Missing configuration returns 503. Missing SQL, Auth service or storage remains unavailable; configured is not synonymous with ready.
- `clients/task-client.js`: narrow reusable async client; write responses must be verified, contain a real task ID/revision, and match a second GET. A `queued` job is never accepted as completed.
- `clients/task-tool.mjs`: one allowlisted structured command from stdin; JSON result on stdout, nonzero exit for failure. No shell, SQL, arbitrary URL parameter, action discovery, automatic retry, or model execution.
- Tests use disposable PGlite PostgreSQL (including restart persistence), loopback HTTP, and explicitly test-only Auth transport fixtures. **Test tokens and UUIDs are not production login evidence.**

## Provisioning / deployment gates

1. Administrator inspects actual catalog for equivalents before applying prepared canonical SQL. Reuse/adapt existing equivalents, never duplicate a hidden task store. Apply base `sql/20261015_vhpms.sql`, then `sql/20261016_task_commands.sql` on the confirmed existing project through an authorized DDL route. Test migration replay is not remote apply. After this increment, replay the command migration after any base-schema maintenance; the expanded view uses explicit ordering to preserve its derived columns.
2. Owner/admin establishes the confirmed account in **project** Auth through a separately approved supported flow; resolve the real UUID. Provision explicit business membership and `can_write=true` for authorized business IDs only. Existing memberships default to false. Do not infer consent from a Telegram sender string or a companion pairing record.
3. Provision reviewed business/category taxonomy and project bindings. Category ID must already exist; project belongs to the selected business. Exact business+category rule wins over source priority; no matching approved rule means retain source priority, including unknown/null. Existing audited overrides take precedence. No override/rule-management endpoint is exposed.
4. Inject the following into the server's private environment (not browser/VITE variables, command arguments, repo files or tool input):
   - `SUPABASE_URL=https://bbpfkjucsabdfcmusqzu.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` (existing public project key)
   - `SUPABASE_SERVICE_KEY` (existing server-only credential)
   - `VHPMS_OWNER_UUID` (resolved actual project Auth ID, never a placeholder)
   - `VHPMS_COMMAND_CHANNEL=bags-telegram` **or** `bags-mark`
   - optional `VHPMS_COMMAND_PORT` (default 8096)
5. Start `node server/start.js` on the existing app backend. Listener binds only `127.0.0.1`; review same-app HTTPS proxy configuration separately. Use distinct fixed-channel server entry points/ports for Telegram and Mark if both are enabled; do not let clients choose channel attribution. Service privilege cannot be exposed to either client. The RPC is callable only by service_role; even a genuine owner bearer cannot bypass the API by calling it directly.
6. Exercise **real** owner login → API create → API GET → dashboard authenticated refresh on that exact shared project. Verify ID, business, category, priority, revision, audit actor/channel and timestamps; update with revision and verify again. Only then enable channel writes or describe the connection as operational.

## HTTP contract

All endpoints require `Authorization: Bearer <current owner Supabase access token>`. Tokens are validated, not simply decoded. Never put tokens in a URL or logs. The server binds the actor from Auth, channel from private server configuration; incoming `actor`, `channel`, `sql`, `confirmed`, priority overrides and arbitrary fields are rejected.

| Request | Requirements | Result |
|---|---|---|
| `GET /api/tasks?business=BSG` | Explicit authorized business | `{tasks:[...],limit:100}`; bounded first page, not a complete snapshot |
| `GET /api/tasks/<external_id>?business=BSG` | Same business-scoped identity | `{task:{...}}`; inaccessible/not found item is 404 |
| `POST /api/tasks?business=BSG` | `Idempotency-Key` + valid body | 201 `{task,replayed:false,verified:true}` after readback; replay 200 |
| `PATCH /api/tasks/<external_id>?business=BSG` | `Idempotency-Key`, `If-Match: <integer revision>` | 200 same envelope after readback |

Create fields: required nonempty `title` (max 300), required explicit `category_id` (existing ID, or explicit null if intentionally unclassified). Optional `project_external_id`, `owner_name` (assignee display label, not an authentication identity), `due_at` (ISO timestamp with explicit timezone or null), `source_priority` (`critical|high|medium|low` or null), `source_status` (`backlog|todo|in_progress|blocked|done|cancelled`, default todo). Patch accepts only these fields, preserves omitted fields, and allows explicit null only for nullable fields. Assignment by display name does not grant access; no invented assignee user IDs. Due dates are never guessed.

Generated task IDs are `cmd-<UUID>`; tasks use `source=command` in the existing canonical table. Imported Paperclip tasks remain readable but return 409 `source_read_only` on edits: silently changing a source projection that sync would overwrite is unsafe. Editing imported work needs a separately reviewed authoritative-source adapter. Every canonical update, including source sync, advances `revision` via trigger. Existing source sync fields do not erase category/override fields.

A key is scoped by verified actor + business; its immutable request includes operation, task ID, revision, data and configured channel. Retry the **same exact key/request**, never generate a new key after timeout. Different request with same key → 409 `idempotency_conflict`; stale revision → 409 `revision_conflict`. SQL locks serialize retries and atomically persist task, receipt and audit or roll everything back. Replaying an old receipt after a later edit returns 409 `readback_conflict`, not a claim the old state is current. A post-commit verification failure may mean the write committed; read by known ID/retry the original key, never duplicate.

Errors: 400 invalid structured input / unresolved IDs; 401 invalid or non-owner session; 403 no explicit business write grant; 404 inaccessible/missing task; 405 unsupported operation; 409 conflict/read-only source; 413 oversized body; 428 missing revision; 503 missing shared configuration/schema/auth/storage. No internal DB errors or secret values are returned. Body limit 16 KiB; upstream authentication/rate limits and TLS are deployment requirements, not bypassed by this code.

## Tool and channel integration contract

A trusted caller supplies `VHPMS_TASK_API_URL` and a current, revocable owner access token in `VHPMS_OWNER_ACCESS_TOKEN` to the narrow tool process. Never put the service key there. Launch only the fixed executable/argv `node clients/task-tool.mjs` (absolute reviewed paths in gateways); send JSON through stdin, not interpolated shell text.

Example **structured input**, not a claimed live write:

```json
{"action":"create","business":"BSG","data":{"title":"Review risk policy","category_id":"safety","due_at":null},"key":"owner-turn-unique-1"}
```

Other envelopes:

```json
{"action":"read","business":"BSG","id":"cmd-actual-id-from-result"}
{"action":"update","business":"BSG","id":"cmd-actual-id-from-result","revision":1,"data":{"title":"Updated title"},"key":"owner-turn-unique-2"}
```

Taxonomy/IDs in examples are illustrative, not approved production matrix values. Use actual authorized records; do not send the placeholder task ID.

**Bags Telegram:** before invoking the tool, the existing gateway must validate its actual trusted Telegram delivery/session, configured owner sender allowlist and explicit owner-to-Supabase session binding. A raw webhook JSON `sender_id`, text claiming ownership, or model-supplied `actor_id` is not authority. No public webhook is added here. Derive stable per-message idempotency keys without raw personal text/phone/chat IDs (e.g. gateway-held keyed digest); do not print/store access tokens in chat. A Telegram session alone cannot mint a Supabase owner token. Tool installation and token/session binding are **not completed** by this increment.

**Bags-Mark-LIII `feature/mobile-companion`:** its existing paired sessions and `server_status` action queue are separate authorities; `companion/tasks.py` currently allows only that read-only action. Do not add VHPMS to the generic queued worker with a global owner token. An authenticated companion server adapter must re-check its live owner session on **every invocation**, resolve an explicit authorized Supabase owner session binding, then invoke this narrow client/tool synchronously and return only the actual verified outcome. Deny expired/unbound/other-owner sessions. Preserve the existing confirmation contract for non-task actions; don't treat `confirmed:true` from arbitrary input as authorization. No companion files or running sessions were modified here. The reviewed adapter is ready to integrate, not claimed wired.

**Natural-language policy for both:** model parses untrusted text into this allowlisted schema, never SQL/shell/tool names. An explicit owner command to add/update a normal task is sufficient intent; do not repeatedly reconfirm harmless adds. Ask for missing business/category mapping, ambiguous task identity or ambiguous date/timezone; don't fabricate. Resolve task ID/revision with GET before patch; ask rather than silently resolving competing same-title tasks. Preserve declared dates and identifiers. Task `in_progress` records workflow state, not evidence code is running. Deletes, bulk moves, financial/irreversible actions are outside this API and require a separately authorized confirmation flow. No personal/finance/contact data ingestion is enabled.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, `npm audit`. HTTP tests execute create/read/update against the actual SQL RPC on disposable PostgreSQL, test idempotency/conflicts/RLS/permissions, restart storage, audit rollback, invalid structured fields and unsupported deletes. Auth adapter tests use a local fixture service to verify online token checking, owner allowlisting, RLS read bearer and server-only RPC credentials; they do not emulate a successful production account. CLI tests spawn the real executable and verify POST→GET and rejection of queued/unapproved results. No remote write or successful owner login is inferred from these tests.
