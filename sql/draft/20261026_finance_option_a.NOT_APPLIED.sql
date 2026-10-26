-- NOT APPLIED. Do not execute this file against any database.
-- Option A is already live on bbpfkjucsabdfcmusqzu (Boaz apply PASS, VERIFY PASS):
--   finance.payment_buffer.ledger_bucket
--   finance.vhpms_finances_summary
--   finance.vhpms_finances_entries
-- This repository does not apply finance DDL.
-- There is no second ledger and no SMSGate cash-out table.
-- summary.incomes follows payment_buffer.ledger_bucket (aaron009_finances_summary_ledger_incomes).
-- verified_income is a side metric only. Do not seed payment_verifications.
-- Rhoda outbound claim_status is ignored. It does not replace ledger_bucket totals.
-- Rhoda cash-outs: ledger_bucket income, category rental_income, direction outbound.
-- Airtel from Rhoda: rental_income, not subscription_payment.
-- Investments: no rows until a later mapping.
-- Ingest PASS: payment_buffer 928 rows, Rhoda rental_income 9, TID 10900844301 present.
-- This file still must not be executed.

DO $$ BEGIN
  RAISE EXCEPTION 'NOT APPLIED: finance DDL is already live and owned by Boaz. Do not execute this file.';
END $$;
