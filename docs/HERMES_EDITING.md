# Editing the VHPMS dashboards

This is the exact path for the Hermes agent on the VPS. The host is `187.7.22.237`. The account is `shadrickvidmar`. Do not use another user, and do not commit a service-role key.

## 1. Repository

- GitHub: `https://github.com/vidmarshdrck/vpms-executive-dashboard-template`
- Default branch: `main`
- Live site: `https://vidmar.tech/vhpms/` and `https://srv1967792.hstgr.cloud/vhpms/`
- Supabase project: `bbpfkjucsabdfcmusqzu` (`https://bbpfkjucsabdfcmusqzu.supabase.co`)

Clone once:

```bash
git clone https://github.com/vidmarshdrck/vpms-executive-dashboard-template.git
cd vpms-executive-dashboard-template
npm ci
```

## 2. Branch and pull request

Never commit straight to `main`.

```bash
git checkout main
git pull origin main
git checkout -b cursor/short-description-f2f0
```

Make the change. Then:

```bash
npm test
npm run lint
npm run build
git add <files>
git commit -m "Say what changed and why"
git push -u origin HEAD
```

Open a pull request into `main`. After it merges, deploy that commit's SHA (section 7).

## 3. Where each screen lives

| Screen | File |
| --- | --- |
| Sign-in | `src/vhpms/Shell.jsx` (`LoginScreen`). Backgrounds: `public/login/*.webp`. Credits: `docs/CREDITS.md`. |
| App shell, sidebar, header, profile menu | `src/vhpms/Shell.jsx`. Sidebar open/closed state: `src/vhpms/sidebar.js`. |
| Which screen is shown after sign-in | `src/vhpms/Vhpms.jsx` |
| Shell colours | `src/vhpms/theme.css` (`--brand: #1454c0`) |
| VE business pages | `src/vhpms/VeWorkspace.jsx`, opened from `src/vhpms/BusinessHome.jsx` when the business id is `ve` |
| VE reads and row mapping | `src/vhpms/veData.js` |
| Funds month maths | `src/vhpms/fundsMonth.js` |
| Bank budget maths and FX derivation | `src/vhpms/bankBudget.js` |
| Empty holder kept off the screen | `src/vhpms/veUpcoming.js` |
| Activities | `src/vhpms/ActivitiesBoard.jsx` and `src/vhpms/activities.js` |
| Inbox and SMS | `src/vhpms/InboxSms.jsx`, `src/vhpms/sms.js`, `src/vhpms/smsClient.js` |
| Other businesses (expenses, income, counts) | `src/vhpms/BusinessHome.jsx` and `src/vhpms/books.js` |
| Footer credit | `src/vhpms/Donut.jsx` (`Powered by VIDMΛR`) |

Every live business opens the same four pages: Overview, Funds, Marketing, Budget. A business then keeps its own pages after those four.

The live business ids, from `BUSINESS_SEED` in `src/vhpms/books.js`, are `ve`, `vai`, `rez`, `bsg`, `vt`, `eunique`, and `digital`.

VE keeps Family Accounts, Customers, and Accounts, and its reads stay in `src/vhpms/veData.js`. The other businesses use `src/vhpms/BusinessWorkspace.jsx`. Their Supabase mapping is one entry in `ADAPTERS` inside `src/vhpms/businessSources.js`. Adding a business is that entry plus a row in `BUSINESS_SEED`. Each slot is either `keys` (tables that exist) or `needs` (the table name shown when nothing is connected). The screen says `No data connected yet. Needs <table>.` A missing owner SELECT is a blocked read, not a zero.

| Business | Income | Expenses | Clients | Marketing | Operations | Owner SELECT |
| --- | --- | --- | --- | --- | --- | --- |
| VE | `public.orders` | `public.expenses` | `public.customers` | `public.marketing`, `public.marketing_spend` | `public.family_accounts`, `ve.products`, `public.ve_bank_accounts`, `public.ve_bank_transactions` | Present for the owner user on these tables |
| VAI | `finance.invoices` where `business_id` is Vidmar AI | No expense table in `vai` | `vai.clients`, `vai.prospects` | No marketing table in `vai` | `vai.contracts`, `vai.services`, `pms.tasks`, `pms.projects` | Missing. Policies are `core.is_staff` / `core.is_ceo` for VAI. This owner has no `core.memberships` row. `authenticator` also has no USAGE on `vai`, `finance`, or `pms`, so the Data API must expose those schemas. |
| REZ | `finance.invoices` for Real Estate Zambia. `rez.listings.rent_zmw` is asking rent and is not treated as income | No expense table in `rez` | `rez.enquiries`, `rez.applications` | No marketing table in `rez` | `rez.listings`, `rez.properties`, `rez.inspection_tasks`, `pms.tasks` | Missing. Same staff/ceo policies for REZ, and `authenticator` has no USAGE on `rez`. |
| BSG | `finance.invoices` for BSG Trades | No BSG expense table. `public.profit_tracking` is a VE rollup and is not used | No BSG customer table. `public.leads` has no business column | No BSG marketing table | `public.phone_inventory`, `public.iphone_price_list`, `pms.tasks` | Missing. Inventory tables have RLS and no SELECT policy. Invoices and tasks use the staff policy. `iphone_price_list` also has no grant to `authenticated`. |
| Digital Products | `commerce.sales` (`amount_received_zmw`) | No dated expense table. `cost_to_make` is a unit cost and is not used | No buyer table on `commerce.sales` | No marketing table in `commerce` | `commerce.digital_products`, `commerce.marketplace_listings`, `pms.tasks` | Missing. Policies are staff/finance for DC. `authenticator` has no USAGE on `commerce`. |
| VT | Needs `public.vt_income` | Needs `public.vt_expenses` | Needs `public.vt_customers` | Needs `public.vt_marketing` | Needs `public.vt_operations` | No tables, so no policy yet |
| Eunique Apparel | Needs `public.eunique_income` | Needs `public.eunique_expenses` | Needs `public.eunique_customers` | Needs `public.eunique_marketing` | Needs `public.eunique_operations` | No tables, so no policy yet |

VE tabs, in order: Overview, Family Accounts, Customers, Funds, Accounts, Budget, Marketing.

Accounts lists every row in `public.ve_bank_accounts`. ZMW and USD are always shown. A currency with no row says that no account was returned. Do not add a row that is not in the table.

The header reporting period is a month-to-month range inside one year. It defaults to the current calendar quarter and is stored per user. Funds Total received is every `public.orders` amount in that range, including orders for people on inactive family accounts. It is not income minus expenses. Bank movements stay on Accounts and use the same range. There is no separate month arrow on Funds or Accounts.

Family Accounts shows dates as `20 Dec 2026`. Plan categories are sentence case, such as Music and Streaming. On a narrow screen the account card keeps Status and Account paid as pills beside the owner name, and the second line is only the plan, due date, and agent. Family Accounts shows one compact row per `public.family_accounts` record. The Account owner is `public.account_agents.name` for that row’s `aaid`. Those names are the people who own the family accounts (`family_owner` on the legacy dashboard uses the same codes, stored as `FV` plus `aaid`). Slot customers (`slot_1` through `slot_5`) are members, not the owner, and their names stay inside the slots popup. There is no separate owner column and no email column on `family_accounts`. The same `aaid` is the only person stored on the account. When that name matches the owner, the Agent column says “Same as owner” instead of repeating it. A different name would show as written. `account_agents` is read as `aaid,name` only. A blank name, or the stored text `nan`, is shown as “Not recorded” in the owner column and an em dash in the Agent column. Account paid is the stored `public.family_accounts.paid_status` text. It is not calculated from member orders. Every current row is `Unpaid`. The members dialog lists each customer’s latest `public.orders` payment, which is a different figure.

The Family Accounts received total is every `public.orders.amount` whose date falls in the header reporting period. The label is `Received ·` plus the period label, for example `Received · Oct – Dec 2026`. It is not a fixed figure. As of 2026-11-14, March 2026 orders sum to 7160, October 2026 orders sum to 500, every order sums to 76425, and orders whose `cid` is currently seated in any family slot sum to 11739. Those four slices are defined in `scripts/family-received.sql`. The screen uses the selected period, not one of those slices hardcoded.

Budget shows a monthly provider projection from active family accounts, then the existing weekly expense table. The projection is: typical USD plan price × the latest month's average `fx_rate`, plus kwacha-billed plans, plus the average monthly `bank_charges`. USD prices come from `orig_amount_usd` on `ve_provider_subscription` rows whose description matches the plan. `ve.products` has no USD price, so it is not used. The actual series is `ve_provider_subscription` by month for the last 12 months. Gap is that actual outflow minus the projection. A positive gap means the bank paid more than the active plans imply.

`VE_UPCOMING` stays empty. It is not a data source.

## 4. How data is read

`createVeClient` in `src/vhpms/veData.js` builds a Supabase client with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- the signed-in user's access token (`accessToken` and `Authorization: Bearer`)

The owner policies allow that user to select (and, where granted, insert and update) `public.family_accounts`, `public.customers`, `public.orders`, `public.expenses`, `public.marketing`, `public.marketing_spend`, `public.ve_bank_accounts`, `public.ve_bank_transactions`, and `ve.products`. Bank reads use the same publishable key and user token. There is no anon read on the bank tables.

Rules:

- Use the publishable key and the user token only.
- Never put a service-role key in the repo, the shell, or a `VITE_` variable.
- Do not bypass row level security.
- Do not select password columns. There is no email column on `family_accounts` or `customers`; do not fake one.
- Customer phone numbers are used only for the WhatsApp link.

Income on Overview is the sum of `public.orders.amount` in the selected period. Expenses are the sum of `public.expenses.amount` in that period. Profit generated is income minus expenses. Balance on hand is the closing bank balance: the latest `ve_bank_transactions.balance` on or before the period end, summed per currency, or the opening balance when that account has no earlier transaction. With no bank account the tile says “No bank account connected”. When the bank tables are blocked, the tile shows the same dash as a blocked income tile and the note “Bank accounts are not visible to this account.” or “Bank transactions are not visible to this account.” There is no separate profit ledger.

Last payment for a customer is the latest `public.orders` row for that `cid` (latest date, then the larger amount on that date).

## 5. Checks

```bash
npm test
npm run lint
npm run build
```

`npm test` is Node's built-in test runner. The production build writes `dist/`.

For a local preview of the VPS path:

```bash
VITE_BASE_PATH=/vhpms/ npm run build
npm run preview
```

## 6. Environment

Copy `.env.example` to `.env` on the machine that builds. Never commit `.env`.

The live build must set:

```bash
VITE_BASE_PATH=/vhpms/
VITE_SUPABASE_URL=https://bbpfkjucsabdfcmusqzu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key only>
```

Optional sign-in and SMS variables are listed in `.env.example` (`VITE_VHPMS_ADMIN_EMAIL`, `VITE_VHPMS_USER_EMAILS`, `VITE_VHPMS_AUTH_URL`, `VITE_VHPMS_SMS_URL`). Do not commit the admin email or any password.

## 7. Deploy on the VPS

Build with `VITE_BASE_PATH=/vhpms/`. Publish `dist/` as a new release and keep the previous one.

```bash
SHA=$(git rev-parse HEAD)
REL="/var/www/vhpms/releases/$SHA"
mkdir -p "$REL"
cp -a dist/. "$REL/"
PREVIOUS=""
if [ -L /var/www/vhpms/current ]; then PREVIOUS=$(readlink -f /var/www/vhpms/current); fi
printf '{\n  "sha": "%s",\n  "previous": "%s"\n}\n' "$SHA" "$PREVIOUS" > "$REL/deployment.json"
ln -sfn "$REL" /var/www/vhpms/current
```

`/var/www/vhpms/current` is the symlink the web server uses. `deployment.json` inside the release records `sha` and `previous`. Rollback is pointing `current` back at the previous release directory. Do not delete that previous directory as part of the publish.

GitHub Actions (`.github/workflows/deploy.yml`) still publishes the template to GitHub Pages. That is not the vidmar.tech/vhpms release.

## 8. Brand and safety

- Blue is `#1454c0`. Spacing, type, contrast, and icons follow [docs/DESIGN.md](DESIGN.md).
- The footer credit is `Powered by VIDMΛR` (Greek capital lambda). Do not write `Vidmar Holdings` on new screens.
- Do not use the words draft, demo, sample, placeholder, or coming soon on a screen the owner uses.
- Do not put fictional rows in the shipped UI. Tests and `scripts/ve-workspace-harness.jsx` may use fictional rows.
- Do not change Activities, Inbox, or SMS Transactions unless the owner asked for that specific change.
