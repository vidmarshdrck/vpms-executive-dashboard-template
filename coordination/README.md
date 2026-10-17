# Shared agent activity — cooperative VPS handoffs

## What works now

This Python standard-library CLI records agent **session activity**, progress, help requests and advisory edit leases on this VPS. It is framework-neutral: Hermes, Grok Bot and other authorized agents can use the same register without sharing chat histories or changing their profiles.

This is NOT another task system. Canonical business tasks stay in VHPMS/Supabase; existing `VID-...` references can appear in a summary without minting conflicting task numbers. Local session references use `SES-...`; audit events use `ACT-000001` style references. No Paperclip runtime dependency and no requirement to open a desktop.

**Coverage is registered sessions only.** Provider/agent labels, progress and completion are self-reports, not verified OS execution or verified bot identities. Unregistered Grok/Hermes sessions are unknown, not idle. No automatic private transcript/session-store ingestion is enabled. A fresh heartbeat is not proof an AI is doing useful work. Every snapshot carries this limitation; sessions become visibly stale after five minutes without an update.

## Trust boundary

Local CLI only: no public server, no arbitrary execution endpoint, no network listener. All participants already have authorized access to the same Unix account. The data directory is mode 0700; database and per-session credential files are mode 0600. Credentials are never printed in status output, and only their hashes are stored in the database.

A session capability prevents accidental updates to another session. It is NOT isolation from a malicious agent running under the same Unix UID: such an agent can already read the account's files. Do not place broker/account data, access tokens, personal contacts, private chat text or secrets in summaries. Sharing a VPS is not approval to modify another Hermes profile, trade, deploy, merge, reset branches, grant access or spend money.

SQLite here stores only transient coordination metadata, not business tasks or financial records. It does not bypass the shared Supabase/Auth prerequisites and must not be exposed as a public unauthenticated feed. An authenticated business-scoped VHPMS UI projection and automatic framework adapters are follow-up work, not delivered by this CLI.

## Commands

Run from the repository root (or use absolute paths). Default state directory: `~/.local/state/vhpms-coordination`.

```sh
python3 coordination/activity.py snapshot
python3 coordination/activity.py register --provider hermes --agent Bags --business VH --worktree /absolute/worktree --objective 'Describe the bounded work' --credential /private/new-session.credential.json
python3 coordination/activity.py claim --credential /private/new-session.credential.json --repo vhpms --scope coordination --ttl 300
python3 coordination/activity.py update --credential /private/new-session.credential.json --state working --summary 'Reproduced regression; implementing fix'
python3 coordination/activity.py update --credential /private/new-session.credential.json --state blocked --summary 'What is actually blocked' --help-needed 'Specific next action and who can help'
python3 coordination/activity.py update --credential /private/new-session.credential.json --state handoff --summary 'Commit/PR and test evidence' --help-needed 'Named reviewer and exact next step'
python3 coordination/activity.py events
```

Use `--provider grok` for Grok Bot, with a separate credential per session. Put all registrations in the same default register unless an explicitly separate environment is intended. An existing credential file is never overwritten. Keep credentials private; agents need only the shared snapshot and their own credential.

Registration writes, flushes, synchronizes and closes the new credential (and synchronizes its parent directory) before committing the SQLite session/event transaction. Normal persistence errors roll the database back and remove only the newly created credential. There is no cross-filesystem atomic transaction: a process crash between credential persistence and DB commit can leave an orphan private credential without a registered session. Recovery is to check the snapshot for that exact session ID; if absent, an authorized operator can remove that orphan and register afresh. Do not delete a credential whose session exists. No automatic recovery rewrites another agent's files.

States: `working`, `waiting`, `blocked`, `handoff`, `completed`, `failed`. Blocked/handoff states require a concrete next action. Update only while actually working; don't install a blind heartbeat to simulate activity. Before pausing, send waiting/handoff/completed so stale working records do not mislead the owner.

## Avoiding collisions

- Read the snapshot, latest Git branches/PRs and the handoff before editing. Use separate worktrees/branches. Never reset/stash/delete another agent's work.
- Use the agreed repo label `vhpms`. Claim relative repo paths, e.g. `src/vhpms/inbox` or `coordination`. Parent/child overlap is a conflict; adjacent paths remain independent. No `..` or absolute lease paths.
- Leases are advisory, not filesystem locks. Cooperating agents must honor conflicts. They expire in 60–1800 seconds; renew explicitly with another claim. Completing/failing/handing off releases that session's leases.
- Two concurrent writers are serialized transactionally. Expired claims do not block indefinitely. Claims do not prove that a process is still alive, and cannot prevent edits by tools that ignore the protocol.
- Append progress and test evidence; don't overwrite history. UI reads are bounded to the latest 100 sessions/events and report incomplete session coverage if the limit is reached.

## Current pickup / no duplicated work

At pickup, the existing remote workstreams were:
- PR #2 `feature/vidmar-brand-redesign`: TPPL/Vidmar branding work.
- PR #3 `feature/vhpms-bsg-section`: BSG read-only view and subsequent layout/API work in its branch history.
- PR #4 `feature/vhpms-inbox`: owner Inbox with record-only decisions, layered on the latest layout/BSG work.

Read their exact current heads; these notes are a pickup snapshot, not live status. Hermes' separate `feature/shared-agent-activity` owns only `coordination/` and this handoff documentation. It does not merge/deploy those PRs or edit their UI/server files. GitHub PR comments provide a visible cross-agent handoff until every bot is registered here.

## Owner direction preserved

Valet is the hands-free interface. CEOs hold vision and outcome measures; specialist leads provide role-specific employee agents. VHPMS should provide per-business workspaces inspired by Paperclip's task/activity patterns, while the holding-company executive view shows material results, trends/quarter comparisons, risks and decisions—not every operational detail. Boaz supervises the owner's personal finance/trading domain. Owner reports a Deriv demo connection; this work does not verify that broker session, inspect private account credentials, place trades or change execution/risk rules.

## Tests

`python3 -m unittest discover -s coordination -p 'test_*.py' -v`

Tests use disposable directories and the real SQLite/CLI subprocess: persistence/restart, audit, private credentials, stale states, blocked-action requirements, parent/child collisions, TTL expiry and simultaneous claims. Existing VHPMS Node tests should also be run before landing, but this increment changes no existing JS/SQL/runtime behavior.
