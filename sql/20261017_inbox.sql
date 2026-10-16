-- VHPMS Inbox (Paperclip approvals model: approvals + approval_comments → inbox_items + inbox_events).
-- Idempotent. Decisions are RECORDED ONLY: nothing here executes a send, deploy, delete, trade or payment.
BEGIN;
CREATE TABLE IF NOT EXISTS public.vhpms_inbox_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 kind text NOT NULL CHECK (kind IN ('approval','decision','task')),
 action text CHECK (action IS NULL OR action IN ('send','deploy','delete','trade','payment','other')),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
 summary text CHECK (summary IS NULL OR length(summary) <= 4000),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object' AND length(payload::text) <= 16000),
 requested_by_agent text NOT NULL CHECK (requested_by_agent ~ '^[a-z][a-z0-9_-]{1,63}$'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','done','cancelled')),
 link_type text CHECK (link_type IS NULL OR link_type IN ('project','task','activity','url')),
 link_ref text CHECK (link_ref IS NULL OR length(link_ref) <= 500),
 idempotency_key text NOT NULL,
 decision_note text,
 decided_by uuid REFERENCES auth.users(id),
 decided_at timestamptz,
 read_at timestamptz,
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (requested_by_agent, idempotency_key),
 CHECK (status <> 'rejected' OR length(btrim(coalesce(decision_note,''))) > 0),
 CHECK ((status IN ('approved','rejected')) = (decided_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS vhpms_inbox_items_status_idx ON public.vhpms_inbox_items (business_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS public.vhpms_inbox_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 item_id uuid NOT NULL REFERENCES public.vhpms_inbox_items(id),
 business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
 event text NOT NULL CHECK (event IN ('created','approved','rejected','commented','read')),
 actor_kind text NOT NULL CHECK (actor_kind IN ('owner','agent')),
 actor text NOT NULL,
 body text CHECK (body IS NULL OR length(body) <= 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vhpms_inbox_events_item_idx ON public.vhpms_inbox_events (item_id, created_at);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['inbox_items','inbox_events'] LOOP
  EXECUTE format('ALTER TABLE public.vhpms_%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS business_read ON public.vhpms_%I', t);
  EXECUTE format('CREATE POLICY business_read ON public.vhpms_%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vhpms_memberships m WHERE m.user_id=auth.uid() AND m.business_id=vhpms_%I.business_id))', t, t);
  EXECUTE format('REVOKE ALL ON public.vhpms_%I FROM PUBLIC, anon, authenticated', t);
  EXECUTE format('GRANT SELECT ON public.vhpms_%I TO authenticated', t);
  EXECUTE format('GRANT ALL ON public.vhpms_%I TO service_role', t);
 END LOOP;
END $$;
-- Audit log is append-only, even for service_role writes through SQL.
CREATE OR REPLACE FUNCTION public.vhpms_inbox_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'inbox_events_append_only'; END $$;
DROP TRIGGER IF EXISTS vhpms_inbox_events_append_only ON public.vhpms_inbox_events;
CREATE TRIGGER vhpms_inbox_events_append_only BEFORE UPDATE OR DELETE ON public.vhpms_inbox_events FOR EACH ROW EXECUTE FUNCTION public.vhpms_inbox_events_append_only();

-- Agent creates an item (idempotent per agent + key). Called by the task API with the service key after agent-token auth.
CREATE OR REPLACE FUNCTION public.vhpms_inbox_create(p_agent text, p_key text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.vhpms_inbox_items; existing public.vhpms_inbox_items;
BEGIN
 SELECT * INTO existing FROM public.vhpms_inbox_items WHERE requested_by_agent=p_agent AND idempotency_key=p_key;
 IF FOUND THEN RETURN jsonb_build_object('item', to_jsonb(existing), 'replayed', true); END IF;
 INSERT INTO public.vhpms_inbox_items (business_id, kind, action, title, summary, payload, requested_by_agent, link_type, link_ref, idempotency_key)
 VALUES (p_data->>'business_id', p_data->>'kind', p_data->>'action', p_data->>'title', p_data->>'summary', coalesce(p_data->'payload','{}'::jsonb), p_agent, p_data->>'link_type', p_data->>'link_ref', p_key)
 RETURNING * INTO r;
 INSERT INTO public.vhpms_inbox_events (item_id, business_id, event, actor_kind, actor) VALUES (r.id, r.business_id, 'created', 'agent', p_agent);
 RETURN jsonb_build_object('item', to_jsonb(r), 'replayed', false);
END $$;

-- Owner decision. Records only. Requires a write grant on the business, pending status, matching revision, and a note on reject.
CREATE OR REPLACE FUNCTION public.vhpms_inbox_decide(p_actor uuid, p_item uuid, p_decision text, p_note text, p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.vhpms_inbox_items;
BEGIN
 IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
 IF p_decision='rejected' AND length(btrim(coalesce(p_note,'')))=0 THEN RAISE EXCEPTION 'note_required'; END IF;
 SELECT * INTO r FROM public.vhpms_inbox_items WHERE id=p_item FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.vhpms_memberships m WHERE m.user_id=p_actor AND m.business_id=r.business_id AND m.can_write) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF r.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
 IF p_revision IS NOT NULL AND p_revision <> r.revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 UPDATE public.vhpms_inbox_items SET status=p_decision, decision_note=nullif(btrim(coalesce(p_note,'')),''), decided_by=p_actor, decided_at=now(), read_at=coalesce(read_at,now()), revision=revision+1, updated_at=now()
  WHERE id=p_item RETURNING * INTO r;
 INSERT INTO public.vhpms_inbox_events (item_id, business_id, event, actor_kind, actor, body) VALUES (r.id, r.business_id, p_decision, 'owner', p_actor::text, r.decision_note);
 RETURN jsonb_build_object('item', to_jsonb(r));
END $$;

CREATE OR REPLACE FUNCTION public.vhpms_inbox_comment(p_actor uuid, p_item uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.vhpms_inbox_items; e public.vhpms_inbox_events;
BEGIN
 IF length(btrim(coalesce(p_body,''))) = 0 OR length(p_body) > 4000 THEN RAISE EXCEPTION 'invalid_comment'; END IF;
 SELECT * INTO r FROM public.vhpms_inbox_items WHERE id=p_item;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.vhpms_memberships m WHERE m.user_id=p_actor AND m.business_id=r.business_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
 INSERT INTO public.vhpms_inbox_events (item_id, business_id, event, actor_kind, actor, body) VALUES (r.id, r.business_id, 'commented', 'owner', p_actor::text, btrim(p_body)) RETURNING * INTO e;
 UPDATE public.vhpms_inbox_items SET read_at=coalesce(read_at,now()), updated_at=now() WHERE id=p_item;
 RETURN jsonb_build_object('event', to_jsonb(e));
END $$;

REVOKE ALL ON FUNCTION public.vhpms_inbox_create(text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vhpms_inbox_decide(uuid,uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vhpms_inbox_comment(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vhpms_inbox_events_append_only() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vhpms_inbox_create(text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.vhpms_inbox_decide(uuid,uuid,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.vhpms_inbox_comment(uuid,uuid,text) TO service_role;
COMMIT;
