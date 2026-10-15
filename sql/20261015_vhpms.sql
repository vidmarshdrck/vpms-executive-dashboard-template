-- Additive migration. PREPARED, NOT APPLIED remotely.
-- Existing exposed public schema has VE tables, not projects/tasks/businesses.
-- No customer/finance copy, no anonymous access, no auto-membership or rule seeds.
BEGIN;
CREATE TABLE IF NOT EXISTS public.vhpms_businesses (
 id text PRIMARY KEY, name text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.vhpms_memberships (
 business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), PRIMARY KEY(business_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.vhpms_categories (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS public.vhpms_projects (
 business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 external_id text NOT NULL, source text NOT NULL DEFAULT 'paperclip' CHECK(source='paperclip'),
 title text NOT NULL, source_status text NOT NULL, due_at timestamptz,
 source_updated_at timestamptz, synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,external_id)
);
CREATE TABLE IF NOT EXISTS public.vhpms_priority_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 category_id text NOT NULL REFERENCES public.vhpms_categories(id),
 priority text NOT NULL CHECK(priority IN ('critical','high','medium','low')),
 rationale text NOT NULL CHECK(length(trim(rationale))>0),
 approved_by uuid NOT NULL REFERENCES auth.users(id), approved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,category_id)
);
CREATE TABLE IF NOT EXISTS public.vhpms_tasks (
 business_id text NOT NULL REFERENCES public.vhpms_businesses(id), external_id text NOT NULL,
 source text NOT NULL DEFAULT 'paperclip' CHECK(source='paperclip'), identifier text,
 title text NOT NULL, project_external_id text, category_id text REFERENCES public.vhpms_categories(id),
 owner_name text, source_status text NOT NULL,
 source_priority text CHECK(source_priority IN ('critical','high','medium','low')),
 due_at timestamptz, gate text, source_updated_at timestamptz, synced_at timestamptz NOT NULL DEFAULT now(),
 override_priority text CHECK(override_priority IN ('critical','high','medium','low')),
 override_reason text, override_by uuid REFERENCES auth.users(id),
 PRIMARY KEY(business_id,external_id),
 FOREIGN KEY(business_id,project_external_id) REFERENCES public.vhpms_projects(business_id,external_id)
);
CREATE TABLE IF NOT EXISTS public.vhpms_task_dependencies (
 business_id text NOT NULL, task_id text NOT NULL, depends_on_id text NOT NULL,
 PRIMARY KEY(business_id,task_id,depends_on_id), CHECK(task_id<>depends_on_id),
 FOREIGN KEY(business_id,task_id) REFERENCES public.vhpms_tasks(business_id,external_id),
 FOREIGN KEY(business_id,depends_on_id) REFERENCES public.vhpms_tasks(business_id,external_id)
);
CREATE TABLE IF NOT EXISTS public.vhpms_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id text NOT NULL,
 task_id text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz,
 CHECK(ends_at IS NULL OR ends_at>=starts_at),
 FOREIGN KEY(business_id,task_id) REFERENCES public.vhpms_tasks(business_id,external_id)
);
CREATE TABLE IF NOT EXISTS public.vhpms_deliverables (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id text NOT NULL,
 task_id text NOT NULL, label text NOT NULL, url text NOT NULL CHECK(url ~ '^https://'),
 verified_at timestamptz,
 FOREIGN KEY(business_id,task_id) REFERENCES public.vhpms_tasks(business_id,external_id)
);
CREATE TABLE IF NOT EXISTS public.vhpms_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 task_id text NOT NULL, actor_id uuid REFERENCES auth.users(id),
 event text NOT NULL, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.vhpms_sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 source text NOT NULL CHECK(source IN ('paperclip','ve')), synced_at timestamptz NOT NULL DEFAULT now(),
 record_count integer NOT NULL CHECK(record_count>=0), status text NOT NULL CHECK(status IN ('success','failed'))
);
-- Membership table is self-readable only; no recursive policies or self-enrollment.
ALTER TABLE public.vhpms_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_membership ON public.vhpms_memberships;
CREATE POLICY own_membership ON public.vhpms_memberships FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.vhpms_memberships FROM anon,authenticated;
GRANT SELECT ON public.vhpms_memberships TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['businesses','projects','tasks','priority_rules','task_dependencies','schedules','deliverables','activities','sync_runs'] LOOP
 EXECUTE format('ALTER TABLE public.vhpms_%I ENABLE ROW LEVEL SECURITY', t);
 EXECUTE format('DROP POLICY IF EXISTS business_read ON public.vhpms_%I',t);
 EXECUTE format('CREATE POLICY business_read ON public.vhpms_%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vhpms_memberships m WHERE m.user_id=auth.uid() AND m.business_id=%s))',t, CASE WHEN t='businesses' THEN 'id' ELSE 'vhpms_'||t||'.business_id' END);
 EXECUTE format('REVOKE ALL ON public.vhpms_%I FROM anon,authenticated',t);
 EXECUTE format('GRANT SELECT ON public.vhpms_%I TO authenticated',t);
 EXECUTE format('GRANT ALL ON public.vhpms_%I TO service_role',t);
 END LOOP;
END $$;
ALTER TABLE public.vhpms_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_categories ON public.vhpms_categories;
CREATE POLICY member_categories ON public.vhpms_categories FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.vhpms_memberships WHERE user_id=auth.uid()));
REVOKE ALL ON public.vhpms_categories FROM anon,authenticated;
GRANT SELECT ON public.vhpms_categories TO authenticated;
GRANT ALL ON public.vhpms_memberships,public.vhpms_categories TO service_role;
CREATE OR REPLACE FUNCTION public.vhpms_audit_override() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW.override_priority,NEW.override_reason,NEW.override_by) IS DISTINCT FROM ROW(OLD.override_priority,OLD.override_reason,OLD.override_by) THEN
  IF NEW.override_by IS NULL OR length(trim(coalesce(NEW.override_reason,'')))=0 THEN
   RAISE EXCEPTION 'override requires an actor and rationale';
  END IF;
  INSERT INTO public.vhpms_activities(business_id,task_id,actor_id,event,before_value,after_value)
  VALUES(NEW.business_id,NEW.external_id,NEW.override_by,'priority_override',jsonb_build_object('priority',OLD.override_priority,'reason',OLD.override_reason),jsonb_build_object('priority',NEW.override_priority,'reason',NEW.override_reason));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vhpms_override_audit ON public.vhpms_tasks;
CREATE TRIGGER vhpms_override_audit BEFORE UPDATE ON public.vhpms_tasks FOR EACH ROW EXECUTE FUNCTION public.vhpms_audit_override();
-- Ingestion may never initialize an override without an audit. Only subsequent
-- human-reviewed UPDATE sets overrides; imported rows leave them null.
ALTER TABLE public.vhpms_tasks DROP CONSTRAINT IF EXISTS vhpms_override_complete;
ALTER TABLE public.vhpms_tasks ADD CONSTRAINT vhpms_override_complete CHECK(override_priority IS NULL OR (override_by IS NOT NULL AND length(trim(coalesce(override_reason,'')))>0));
REVOKE EXECUTE ON FUNCTION public.vhpms_audit_override() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';
-- Security-invoker is essential: a default owner-privileged view bypasses RLS.
CREATE OR REPLACE VIEW public.vhpms_task_priorities WITH (security_invoker=true) AS
 SELECT t.*, coalesce(t.override_priority,r.priority,t.source_priority) AS effective_priority,
 CASE WHEN t.override_priority IS NOT NULL THEN 'audited override' WHEN r.id IS NOT NULL THEN 'business/category' ELSE 'source' END AS priority_source,
 CASE WHEN t.override_priority IS NOT NULL THEN t.override_reason WHEN r.id IS NOT NULL THEN r.rationale ELSE 'No approved business/category rule; source priority retained.' END AS priority_rationale,
 r.id AS priority_rule_id
 FROM public.vhpms_tasks t LEFT JOIN public.vhpms_priority_rules r ON r.business_id=t.business_id AND r.category_id=t.category_id;
REVOKE ALL ON public.vhpms_task_priorities FROM anon,authenticated;
GRANT SELECT ON public.vhpms_task_priorities TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.vhpms_no_initial_override() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$ BEGIN
 IF NEW.override_priority IS NOT NULL OR NEW.override_reason IS NOT NULL OR NEW.override_by IS NOT NULL THEN
 RAISE EXCEPTION 'cannot initialize overrides; use audited update'; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vhpms_no_initial_override ON public.vhpms_tasks;
CREATE TRIGGER vhpms_no_initial_override BEFORE INSERT ON public.vhpms_tasks FOR EACH ROW EXECUTE FUNCTION public.vhpms_no_initial_override();
REVOKE EXECUTE ON FUNCTION public.vhpms_no_initial_override() FROM PUBLIC,anon,authenticated;
COMMIT;
