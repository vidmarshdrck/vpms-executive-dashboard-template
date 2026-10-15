-- Optional second migration AFTER 20261015_vhpms.sql, only in existing VE project.
-- Reuses existing table; no customer rows, phone numbers, receipts or financial
-- claims leave this narrowly scoped, membership-checked aggregate function.
BEGIN;
CREATE OR REPLACE FUNCTION public.vhpms_ve_summary() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.vhpms_memberships WHERE business_id='VE' AND user_id=auth.uid()) THEN
  RAISE EXCEPTION 'VE membership required' USING ERRCODE='42501';
 END IF;
 RETURN (SELECT jsonb_build_object(
  'source','public.family_accounts', 'queried_at',statement_timestamp(),
  'source_updated_at',null,
  'family_accounts',count(*),
  'due_within_7_days',count(*) FILTER(WHERE due_date>=current_date AND due_date<=current_date+7),
  'past_due_date',count(*) FILTER(WHERE due_date<current_date),
  'missing_due_date',count(*) FILTER(WHERE due_date IS NULL)
 ) FROM public.family_accounts);
END $$;
REVOKE ALL ON FUNCTION public.vhpms_ve_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vhpms_ve_summary() TO authenticated;
COMMENT ON FUNCTION public.vhpms_ve_summary() IS 'VE-member-only source-row/due-date counts. Not revenue, active subscriptions, verified payments or proof of customer renewal. Underlying last update unavailable.';
NOTIFY pgrst, 'reload schema';
COMMIT;
