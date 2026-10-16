-- PREPARED ONLY. Apply after catalog review and 20261015_vhpms.sql.
-- Uses canonical dashboard tables. No new production datastore or auth identity.
BEGIN;
ALTER TABLE public.vhpms_memberships ADD COLUMN IF NOT EXISTS can_write boolean NOT NULL DEFAULT false;
ALTER TABLE public.vhpms_tasks DROP CONSTRAINT IF EXISTS vhpms_tasks_source_check;
ALTER TABLE public.vhpms_tasks ADD CONSTRAINT vhpms_tasks_source_check CHECK(source IN ('paperclip','command'));
ALTER TABLE public.vhpms_tasks ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE TABLE IF NOT EXISTS public.vhpms_task_commands (
 actor_id uuid NOT NULL REFERENCES auth.users(id), business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 request jsonb NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,business_id,idempotency_key)
);
ALTER TABLE public.vhpms_task_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vhpms_task_commands FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.vhpms_task_commands TO service_role;
-- Every canonical write (including source sync) advances the optimistic revision.
CREATE OR REPLACE FUNCTION public.vhpms_task_revision() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$ BEGIN NEW.revision=OLD.revision+1; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS vhpms_task_revision ON public.vhpms_tasks;
CREATE TRIGGER vhpms_task_revision BEFORE UPDATE ON public.vhpms_tasks FOR EACH ROW EXECUTE FUNCTION public.vhpms_task_revision();
REVOKE EXECUTE ON FUNCTION public.vhpms_task_revision() FROM PUBLIC,anon,authenticated;
-- CREATE OR REPLACE cannot append a column before existing view-derived columns.
CREATE OR REPLACE VIEW public.vhpms_task_priorities WITH (security_invoker=true) AS
 SELECT t.business_id,t.external_id,t.source,t.identifier,t.title,t.project_external_id,t.category_id,
 t.owner_name,t.source_status,t.source_priority,t.due_at,t.gate,t.source_updated_at,t.synced_at,
 t.override_priority,t.override_reason,t.override_by,
 coalesce(t.override_priority,r.priority,t.source_priority) AS effective_priority,
 CASE WHEN t.override_priority IS NOT NULL THEN 'audited override' WHEN r.id IS NOT NULL THEN 'business/category' ELSE 'source' END AS priority_source,
 CASE WHEN t.override_priority IS NOT NULL THEN t.override_reason WHEN r.id IS NOT NULL THEN r.rationale ELSE 'No approved business/category rule; source priority retained.' END AS priority_rationale,
 r.id AS priority_rule_id,t.revision
 FROM public.vhpms_tasks t LEFT JOIN public.vhpms_priority_rules r ON r.business_id=t.business_id AND r.category_id=t.category_id;
-- service_role only: actor and channel are resolved by the authenticated server,
-- never trusted from incoming JSON. Also checks explicit business write grant.
CREATE OR REPLACE FUNCTION public.vhpms_task_command(
 p_actor uuid,p_business text,p_operation text,p_task_id text,p_key text,p_revision integer,p_data jsonb,p_channel text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_request jsonb; v_cached public.vhpms_task_commands; v_before jsonb; v_after jsonb; v_result jsonb;
 v_task public.vhpms_tasks; v_id text; v_key text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.vhpms_memberships WHERE user_id=p_actor AND business_id=p_business AND can_write) THEN
 RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_operation NOT IN ('create','update') OR p_operation IS NULL OR p_channel NOT IN ('bags-telegram','bags-mark') OR p_channel IS NULL THEN
 RAISE EXCEPTION 'invalid_command'; END IF;
 IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_command'; END IF;
 FOR v_key IN SELECT jsonb_object_keys(p_data) LOOP
 IF v_key NOT IN ('title','project_external_id','category_id','owner_name','source_status','source_priority','due_at') THEN RAISE EXCEPTION 'invalid_field'; END IF;
 IF jsonb_typeof(p_data->v_key) NOT IN ('string','null') THEN RAISE EXCEPTION 'invalid_field'; END IF;
 END LOOP;
 IF p_data ? 'title' AND (coalesce(length(trim(p_data->>'title')),0) NOT BETWEEN 1 AND 300) THEN RAISE EXCEPTION 'invalid_title'; END IF;
 IF p_operation='create' AND (NOT p_data ? 'title' OR NOT p_data ? 'category_id') THEN RAISE EXCEPTION 'title_and_category_required'; END IF;
 IF p_data ? 'source_status' AND coalesce(p_data->>'source_status','') NOT IN ('backlog','todo','in_progress','blocked','done','cancelled') THEN RAISE EXCEPTION 'invalid_status'; END IF;
 IF p_data ? 'source_priority' AND p_data->>'source_priority' IS NOT NULL AND p_data->>'source_priority' NOT IN ('critical','high','medium','low') THEN RAISE EXCEPTION 'invalid_priority'; END IF;
 IF p_data->>'due_at' IS NOT NULL AND (p_data->>'due_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$' THEN RAISE EXCEPTION 'invalid_due_at'; END IF;
 IF length(coalesce(p_data->>'owner_name',''))>120 OR length(coalesce(p_data->>'project_external_id',''))>128 OR length(coalesce(p_data->>'category_id',''))>128 THEN RAISE EXCEPTION 'invalid_field'; END IF;
 v_request=jsonb_build_object('operation',p_operation,'task_id',p_task_id,'revision',p_revision,'data',p_data,'channel',p_channel);
 -- Cross-process transactional serialization; unique key is the final guard.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_business||':'||p_key,0));
 SELECT * INTO v_cached FROM public.vhpms_task_commands WHERE actor_id=p_actor AND business_id=p_business AND idempotency_key=p_key;
 IF FOUND THEN
 IF v_cached.request<>v_request THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
 RETURN v_cached.response || jsonb_build_object('replayed',true);
 END IF;
 IF p_operation='create' THEN
 IF p_task_id IS NOT NULL OR p_revision IS NOT NULL THEN RAISE EXCEPTION 'invalid_command'; END IF;
 v_id='cmd-'||gen_random_uuid()::text;
 INSERT INTO public.vhpms_tasks(business_id,external_id,source,title,project_external_id,category_id,owner_name,source_status,source_priority,due_at)
 VALUES(p_business,v_id,'command',p_data->>'title',p_data->>'project_external_id',p_data->>'category_id',p_data->>'owner_name',coalesce(p_data->>'source_status','todo'),p_data->>'source_priority',(p_data->>'due_at')::timestamptz);
 ELSE
 SELECT * INTO v_task FROM public.vhpms_tasks WHERE business_id=p_business AND external_id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF v_task.source<>'command' THEN RAISE EXCEPTION 'source_read_only'; END IF;
 IF p_revision IS NULL OR p_revision<>v_task.revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF p_data='{}'::jsonb THEN RAISE EXCEPTION 'empty_update'; END IF;
 v_before=to_jsonb(v_task); v_id=p_task_id;
 UPDATE public.vhpms_tasks SET
 title=CASE WHEN p_data ? 'title' THEN p_data->>'title' ELSE title END,
 project_external_id=CASE WHEN p_data ? 'project_external_id' THEN p_data->>'project_external_id' ELSE project_external_id END,
 category_id=CASE WHEN p_data ? 'category_id' THEN p_data->>'category_id' ELSE category_id END,
 owner_name=CASE WHEN p_data ? 'owner_name' THEN p_data->>'owner_name' ELSE owner_name END,
 source_status=CASE WHEN p_data ? 'source_status' THEN p_data->>'source_status' ELSE source_status END,
 source_priority=CASE WHEN p_data ? 'source_priority' THEN p_data->>'source_priority' ELSE source_priority END,
 due_at=CASE WHEN p_data ? 'due_at' THEN (p_data->>'due_at')::timestamptz ELSE due_at END,
 synced_at=now() WHERE business_id=p_business AND external_id=v_id;
 END IF;
 SELECT to_jsonb(t) INTO v_after FROM public.vhpms_task_priorities t WHERE business_id=p_business AND external_id=v_id;
 INSERT INTO public.vhpms_activities(business_id,task_id,actor_id,event,before_value,after_value)
 VALUES(p_business,v_id,p_actor,'task_'||p_operation,v_before,jsonb_build_object('task',v_after,'channel',p_channel,'idempotency_key',p_key));
 v_result=jsonb_build_object('task',v_after,'replayed',false);
 INSERT INTO public.vhpms_task_commands(actor_id,business_id,idempotency_key,request,response) VALUES(p_actor,p_business,p_key,v_request,v_result);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.vhpms_task_command(uuid,text,text,text,text,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vhpms_task_command(uuid,text,text,text,text,integer,jsonb,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
