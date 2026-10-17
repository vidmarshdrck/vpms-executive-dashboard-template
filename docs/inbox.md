# VHPMS Inbox: plan and design (branch feature/vhpms-inbox)

Based on Paperclip's `approvals` and `approval_comments` tables, mapped to `vhpms_inbox_items` and `vhpms_inbox_events`.

## Scope
- An **Inbox** nav item sits directly under Executive overview. It shows a blue unread badge, counting pending items that have not been read.
- **Item types:**
  - `approval`, which needs an action of send, deploy, delete, trade, payment or other
  - `decision`
  - `task` (assigned to Shadrick)
- **Each row shows** the type and action, the title, the source agent, a UTC timestamp, the business, the status, and an "Open related" link. The link can point to a project, task, activity or https URL. Non-https URLs are refused.
- **Actions:** Approve, Reject, and Comment. A comment is required to reject; this rule is enforced in the UI, the API, the SQL function and a table CHECK.
- **Filters:** type, agent and status. The default is pending.
- **Decisions are only recorded.** The app and the API never run a send, deploy, delete, trade or payment. The decision response carries `executed:false`. Agents poll their own items and act afterwards.
- Activities is unchanged.

## Data: sql/20261017_inbox.sql
The migration is idempotent and wrapped in a single transaction.
- **`vhpms_inbox_items`**
  - Columns: business_id, kind, action, title, summary, payload jsonb (16 KB maximum), requested_by_agent, status, link_type/link_ref, idempotency_key, decision_note, decided_by, decided_at, read_at, revision, and timestamps.
  - Unique key: (agent, idempotency_key).
- **`vhpms_inbox_events`**
  - An append-only audit log, enforced by a trigger.
  - Event types: created, approved, rejected, commented, read.
- **RLS** follows the vhpms pattern:
  - `business_read` is a SELECT policy based on membership.
  - `authenticated` gets SELECT only; anon gets nothing.
- **Writes** go only through SECURITY DEFINER functions, which only `service_role` can execute:
  - `vhpms_inbox_create(agent,key,data)`, which is idempotent and replays an existing item.
  - `vhpms_inbox_decide(actor,item,decision,note,revision)`. It requires a can_write membership and a pending item, and it checks the revision. A note is required on reject. It also writes an audit event.
  - `vhpms_inbox_comment(actor,item,body)`.

## API (server/inbox-api.js, mounted in server/start.js under /api/inbox)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/inbox?kind=&status=&agent=&business= | Owner Supabase JWT (must be VHPMS_OWNER_UUID) | Reads use the owner token, so RLS applies. Returns `{items, unread}` |
| POST | /api/inbox | **Agent token** | `Idempotency-Key` header required. Returns 201 for a new item, 200 for a replay |
| POST | /api/inbox/:id/decision | Owner | Body `{decision:"approve"\|"reject", note, revision?}`. Returns 409 if the item is not pending or the revision conflicts |
| POST | /api/inbox/:id/comment | Owner | Body `{body}` |

### Agent tokens
- The env var is `VHPMS_AGENT_TOKENS="boaz:<sha256hex>,bags:<sha256hex>"`. It holds only hashes, never the raw tokens.
- Tokens are compared timing-safe and must be 16 to 512 characters long.
- The agent name comes from the token, never from the request body.

To generate a token:
```
TOKEN=$(openssl rand -base64 32 | tr -d '/+=')        # give to the agent (secret)
printf %s "$TOKEN" | sha256sum | cut -d' ' -f1          # put in VHPMS_AGENT_TOKENS
```

Example agent call:
```
curl -sS -X POST http://127.0.0.1:8096/api/inbox \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: bsg-0412-trade" -H 'content-type: application/json' \
  -d '{"business_id":"BSG","kind":"approval","action":"trade","title":"Open XAUUSD buy on demo 6345797","summary":"1R=$40","link_type":"project","link_ref":"bsg"}'
```

## UI
- **Files:**
  - `src/vhpms/inbox/`: fixture.js, logic.js (+tests), store.js (a shared external store, so the nav badge and the page stay in sync), InboxSection.jsx
  - `src/pages/dashboard/InboxPage.jsx`
  - Route `/inbox`
- **Layout:**
  - Summary count cards (Needs approval / Decisions / Assigned to you / Decided). The cards act as filters.
  - Desktop: two panes. On the left, a list grouped by Needs approval / Decisions / Assigned to you; each row shows an agent avatar, title, type chip, relative time and an unread dot. On the right, a detail panel with request facts, the related link, an activity thread and a sticky comment + Approve/Reject bar.
  - Mobile (<1024px): a single list, with a slide-up detail sheet (portal, 88dvh).
  - Keyboard: j/k to move, a to approve, r to reject. A reject with no comment focuses the comment box. Shortcuts are ignored while typing.
  - Full dark mode through the TPPL tokens.
- **Sample-data mode** (`VITE_BSG_FIXTURE=true`): 9 synthetic items, marked by a small grey "Sample data" pill in the page header (the red banners were removed). Decisions only change local state.
- **Live mode:** uses the shared Supabase session (sign in on Live workspace) and calls the API.

## Tests
- `sql/inbox-migration.test.js` (PGlite) checks that:
  - the migration can be applied twice
  - replays are idempotent
  - reject without a note fails
  - a non-writer is forbidden
  - a revision conflict and a non-pending item are both refused
  - the audit log is append-only
  - anon is denied
  - RLS limits rows to the user's memberships
  - authenticated users cannot UPDATE or call the RPCs
- `server/inbox-api.test.js` covers auth separation (an agent token cannot decide and an owner token cannot create), filters, the idempotency key, link validation, the reject note and error mapping.
- `src/vhpms/inbox/logic.test.js` covers the unread count, filters and sorting, decision rules and link safety.

## Out of scope / next
- Agents need a way to read back the decision: `GET /api/inbox/:id` with an agent token, limited to their own items. Not built yet.
- Marking items read in live mode needs a `read` RPC. For now, only fixture mode marks items read.
- Paperclip sync: write a projection from Paperclip `approvals` with `scripts/paperclip.js`, or have agents POST directly.
