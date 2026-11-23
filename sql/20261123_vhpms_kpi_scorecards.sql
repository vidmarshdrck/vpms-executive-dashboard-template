-- Prepared, not applied.
-- Run after sql/20261015_vhpms.sql. Boaz or Bags applies this file.
-- The app does not run it. Scorecards and KPI periods stay in the browser until this exists.
BEGIN;

CREATE TABLE IF NOT EXISTS public.vhpms_businesses (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vhpms_memberships (
  business_id text NOT NULL REFERENCES public.vhpms_businesses(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (business_id, user_id)
);

INSERT INTO public.vhpms_businesses (id, name) VALUES
  ('VE', 'Vidmar Entertainment'),
  ('VAI', 'Vidmar AI'),
  ('REZ', 'Real Estate Zambia'),
  ('BSG', 'BSG Trades'),
  ('VT', 'Vidmar Transport'),
  ('Eunique', 'Eunique Apparel'),
  ('Digital', 'Digital Products')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vhpms_owner_scorecards (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  subject_type text NOT NULL CHECK (subject_type IN ('department', 'user', 'business')),
  subject_id text NOT NULL CHECK (length(trim(subject_id)) > 0),
  business_id text REFERENCES public.vhpms_businesses(id),
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (subject_type <> 'business' OR business_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.vhpms_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  catalogue_id text NOT NULL CHECK (length(trim(catalogue_id)) > 0),
  business_code text,
  measure text NOT NULL CHECK (length(trim(measure)) > 0),
  perspective text NOT NULL,
  unit text,
  frequency text,
  direction text NOT NULL DEFAULT 'HIGHER_BETTER' CHECK (direction IN ('HIGHER_BETTER', 'LOWER_BETTER')),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, catalogue_id)
);

CREATE TABLE IF NOT EXISTS public.vhpms_kpi_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.vhpms_kpis(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(trim(label)) > 0),
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  target numeric,
  actual numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, label, year)
);

CREATE INDEX IF NOT EXISTS vhpms_owner_scorecards_owner ON public.vhpms_owner_scorecards (owner_id);
CREATE INDEX IF NOT EXISTS vhpms_owner_scorecards_business ON public.vhpms_owner_scorecards (business_id);
CREATE INDEX IF NOT EXISTS vhpms_kpis_owner ON public.vhpms_kpis (owner_id);
CREATE INDEX IF NOT EXISTS vhpms_kpis_business ON public.vhpms_kpis (business_code);
CREATE INDEX IF NOT EXISTS vhpms_kpi_periods_kpi ON public.vhpms_kpi_periods (kpi_id);

ALTER TABLE public.vhpms_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_membership ON public.vhpms_memberships;
CREATE POLICY own_membership ON public.vhpms_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.vhpms_owner_scorecards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_or_member_select ON public.vhpms_owner_scorecards;
DROP POLICY IF EXISTS owner_or_member_insert ON public.vhpms_owner_scorecards;
DROP POLICY IF EXISTS owner_or_member_update ON public.vhpms_owner_scorecards;
DROP POLICY IF EXISTS owner_or_member_delete ON public.vhpms_owner_scorecards;
CREATE POLICY owner_or_member_select ON public.vhpms_owner_scorecards
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.vhpms_memberships m
        WHERE m.user_id = auth.uid() AND m.business_id = vhpms_owner_scorecards.business_id
      )
    )
  );
CREATE POLICY owner_or_member_insert ON public.vhpms_owner_scorecards
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY owner_or_member_update ON public.vhpms_owner_scorecards
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.vhpms_memberships m
        WHERE m.user_id = auth.uid() AND m.business_id = vhpms_owner_scorecards.business_id
      )
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (
      business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.vhpms_memberships m
        WHERE m.user_id = auth.uid() AND m.business_id = vhpms_owner_scorecards.business_id
      )
    )
  );
CREATE POLICY owner_or_member_delete ON public.vhpms_owner_scorecards
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      business_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.vhpms_memberships m
        WHERE m.user_id = auth.uid() AND m.business_id = vhpms_owner_scorecards.business_id
      )
    )
  );

ALTER TABLE public.vhpms_kpis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_or_member_select ON public.vhpms_kpis;
DROP POLICY IF EXISTS owner_or_member_insert ON public.vhpms_kpis;
DROP POLICY IF EXISTS owner_or_member_update ON public.vhpms_kpis;
DROP POLICY IF EXISTS owner_or_member_delete ON public.vhpms_kpis;
CREATE POLICY owner_or_member_select ON public.vhpms_kpis
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vhpms_memberships m
      WHERE m.user_id = auth.uid() AND m.business_id = vhpms_kpis.business_code
    )
  );
CREATE POLICY owner_or_member_insert ON public.vhpms_kpis
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY owner_or_member_update ON public.vhpms_kpis
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vhpms_memberships m
      WHERE m.user_id = auth.uid() AND m.business_id = vhpms_kpis.business_code
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vhpms_memberships m
      WHERE m.user_id = auth.uid() AND m.business_id = vhpms_kpis.business_code
    )
  );
CREATE POLICY owner_or_member_delete ON public.vhpms_kpis
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE public.vhpms_kpi_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_or_member_all ON public.vhpms_kpi_periods;
CREATE POLICY owner_or_member_all ON public.vhpms_kpi_periods
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vhpms_kpis k
      WHERE k.id = kpi_id
        AND (
          k.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.vhpms_memberships m
            WHERE m.user_id = auth.uid() AND m.business_id = k.business_code
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vhpms_kpis k
      WHERE k.id = kpi_id
        AND (
          k.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.vhpms_memberships m
            WHERE m.user_id = auth.uid() AND m.business_id = k.business_code
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.vhpms_keep_row_owner() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'owner cannot be reassigned';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vhpms_keep_scorecard_owner ON public.vhpms_owner_scorecards;
CREATE TRIGGER vhpms_keep_scorecard_owner
  BEFORE UPDATE ON public.vhpms_owner_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.vhpms_keep_row_owner();

DROP TRIGGER IF EXISTS vhpms_keep_kpi_owner ON public.vhpms_kpis;
CREATE TRIGGER vhpms_keep_kpi_owner
  BEFORE UPDATE ON public.vhpms_kpis
  FOR EACH ROW EXECUTE FUNCTION public.vhpms_keep_row_owner();

REVOKE ALL ON public.vhpms_owner_scorecards, public.vhpms_kpis, public.vhpms_kpi_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vhpms_owner_scorecards, public.vhpms_kpis, public.vhpms_kpi_periods TO authenticated;
GRANT ALL ON public.vhpms_owner_scorecards, public.vhpms_kpis, public.vhpms_kpi_periods TO service_role;
REVOKE EXECUTE ON FUNCTION public.vhpms_keep_row_owner() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
