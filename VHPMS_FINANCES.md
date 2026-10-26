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

- Incomes total = inbound rows whose verification status is `verified`.
- Unclaimed and claimed-not-verified inbounds are pending candidates. They are listed and are not part of the incomes total.
- Outbound rows never keep `claim_status`.
- Rhoda cash-outs are rental **income**: `direction=outbound`, `ledger_bucket=income`, `category=rental_income`. Offline fixture TID `10900844301` (present in the live buffer). The fixture amount and timestamp are the offline shape, not a claim that this VM read that row.
- Airtel money from Rhoda is `rental_income`, not `subscription_payment`.
- Investments are empty until a later mapping. No investment rows are invented.

## Ask-list (Boaz)

1. Is `finance` applied? **Yes.** Apply PASS and VERIFY PASS. This repo still does not run DDL.
2. How are cash-outs typed? **Option A.** `ledger_bucket` on `finance.payment_buffer`, filled by CSV ingest. Not a new table.
3. What counts as income? **Verified inbounds only.** Other inbound claim states stay pending.
4. Investments? **Deferred.** Empty list.
5. Rhoda rental? **Income**, including the outbound cash-out. Inbound Airtel from Rhoda is `rental_income`.
6. Read API? **The two RPCs above**, wrapped by this task-api for the owner session. Responses do not include `raw_sms`.

## Run the screen against the fixture

```bash
VITE_FINANCES_FIXTURE=true npm run dev
```

Sign in with the PMS account `admin` / `ChangeMe123!`, then open `/finances`. The flag is the switch. The screen does not label the rows.

`npm test` covers bucket totals, the Rhoda cash-out under Incomes, verified-only income, empty investments, empty-RPC versus fallback, and the owner auth gate.

Leave `VITE_FINANCES_FIXTURE` unset to call the task-api. Without owner Supabase credentials that route returns 503 and the signed-in owner session falls back to the fixture. Live buffer smoke is allowed; it needs those credentials, which are not in this environment.
