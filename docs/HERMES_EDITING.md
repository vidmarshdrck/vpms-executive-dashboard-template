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
| Empty seam for bank accounts and budget projection | `src/vhpms/veUpcoming.js` |
| Activities | `src/vhpms/ActivitiesBoard.jsx` and `src/vhpms/activities.js` |
| Inbox and SMS | `src/vhpms/InboxSms.jsx`, `src/vhpms/sms.js`, `src/vhpms/smsClient.js` |
| Other businesses (expenses, income, counts) | `src/vhpms/BusinessHome.jsx` and `src/vhpms/books.js` |
| Footer credit | `src/vhpms/Donut.jsx` (`Powered by VIDMΛR`) |

VE tabs, in order: Overview, Family Accounts, Customers, Funds, Budget, Marketing.

`VE_UPCOMING` in `src/vhpms/veUpcoming.js` is the seam for a later Accounts page (USD and ZMW bank accounts with a transaction trail) and automatic budget projection. Leave the arrays empty. Do not invent rows.

## 4. How data is read

`createVeClient` in `src/vhpms/veData.js` builds a Supabase client with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- the signed-in user's access token (`accessToken` and `Authorization: Bearer`)

The owner policies from migration `ve_owner_workspace_access` allow that user to select (and, where granted, insert and update) `public.family_accounts`, `public.customers`, `public.orders`, `public.expenses`, `public.marketing`, `public.marketing_spend`, and `ve.products`.

Rules:

- Use the publishable key and the user token only.
- Never put a service-role key in the repo, the shell, or a `VITE_` variable.
- Do not bypass row level security.
- Do not select password columns. There is no email column on `family_accounts` or `customers`; do not fake one.
- Customer phone numbers are used only for the WhatsApp link.

Income is the sum of `public.orders.amount`. Expenses are the sum of `public.expenses.amount`. Balance on hand and profit generated are that income minus those expenses, because no bank balance and no separate profit ledger are stored.

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

- Blue is `#1454c0`.
- The footer credit is `Powered by VIDMΛR` (Greek capital lambda). Do not write `Vidmar Holdings` on new screens.
- Do not use the words draft, demo, sample, placeholder, or coming soon on a screen the owner uses.
- Do not put fictional rows in the shipped UI. Tests and `scripts/ve-workspace-harness.jsx` may use fictional rows.
- Do not change Activities, Inbox, or SMS Transactions unless the owner asked for that specific change.
