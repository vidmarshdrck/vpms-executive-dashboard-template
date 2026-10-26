# VHPMS Finances

Offline UI and task-api read for Incomes, Expenses and Investments. This branch does not merge, deploy, or apply SQL.

## Source of truth

Boaz Option A is live on `bbpfkjucsabdfcmusqzu` (apply PASS, VERIFY PASS):

- `finance.payment_buffer.ledger_bucket`
- `finance.vhpms_finances_summary`
- `finance.vhpms_finances_entries`

There is no second ledger. `public.vhpms_finance_entries` is not used. SMSGate is not a cash-out ledger. `sql/draft/20261026_finance_option_a.NOT_APPLIED.sql` only records that fact and raises if someone tries to run it.

Boaz ingest PASS: `payment_buffer` has 928 rows, Rhoda `rental_income` count is 9, and TID `10900844301` is present. A successful RPC response is shown as returned, including when the numbers are zero. It is not replaced with the fixture. This VM has no Supabase credentials, so the live read was not run here. Nathan or Bags can smoke `finance.vhpms_finances_summary` and `finance.vhpms_finances_entries` with the owner session.

## Read path

`GET /api/finances`, `GET /api/finances/summary` and `GET /api/finances/entries` require the same owner JWT as the BSG summary. When `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY` and `VHPMS_OWNER_UUID` are set, the handler calls the two finance RPCs with that owner token (finance schema profile, then a narrower retry). If those calls fail, the handler serves `server/fixtures/finances.json`.

`POST /api/finances` accepts a manual income or expense only while the RPC client is not in use. It does not write to Supabase. Investment rows are rejected. Verification stays with Boaz.

## Totals

Bags override, certain: primary Finances totals come from `payment_buffer.ledger_bucket` via `finance.vhpms_finances_summary` (migration `aaron009_finances_summary_ledger_incomes`, already applied by Boaz, not by this repo).

- `summary.incomes` = rows with `ledger_bucket=income`, including Rhoda `rental_income` outbounds.
- `summary.expenses` = `ledger_bucket=expense`.
- `summary.investments` = `ledger_bucket=investment`.
- `verified_income` is a side metric only. The screen and the task-api wrapper do not use it as the income total.
- This repo does not seed `payment_verifications` for Rhoda or anyone else.
- Outbound rows still leave `claim_status` null. That does not remove them from `summary.incomes`.
- Airtel money from Rhoda is `rental_income`, not `subscription_payment`.
- Investments stay empty until rows exist. None are invented.
- Offline fixture TID `10900844301` is the Rhoda cash-out sample (present in the live buffer). Its fixture amount and timestamp are the offline shape.

Live smoke targets from the ledger summary, not the fixture: incomes about **20117.99**, expenses about **201974.44**, investments **0**. This VM has no Supabase credentials, so those RPCs were not called here.

## Ask-list (Boaz)

1. Is `finance` applied? **Yes.** Apply PASS and VERIFY PASS. This repo still does not run DDL.
2. How are cash-outs typed? **Option A.** `ledger_bucket` on `finance.payment_buffer`, filled by CSV ingest. Not a new table.
3. What counts as income? **`ledger_bucket=income`**, including rental outbounds. `verified_income` is a side metric only (`aaron009_finances_summary_ledger_incomes`).
4. Investments? **Deferred.** Empty list.
5. Rhoda rental? **Income**, including the outbound cash-out. Inbound Airtel from Rhoda is `rental_income`.
6. Read API? **The two RPCs above**, wrapped by this task-api for the owner session. Responses do not include `raw_sms`.

## Run the screen against the fixture

```bash
VITE_FINANCES_FIXTURE=true npm run dev
```

Sign in with the PMS account `admin` / `ChangeMe123!`, then open `/finances`. The flag is the switch. The screen does not label the rows.

`npm test` covers ledger-bucket totals, Rhoda rental income inside incomes, `verified_income` as a side metric, empty investments, and the owner auth gate.

Leave `VITE_FINANCES_FIXTURE` unset to call the task-api. Without owner Supabase credentials that route returns 503 and the signed-in owner session falls back to the fixture. Live buffer smoke is allowed; it needs those credentials, which are not in this environment.
