-- Agelya wellness foundation
-- Adds the first massotherapy/wellness-specific domain objects while
-- keeping sensitive health data unavailable to anonymous/public roles.

ALTER TABLE public.businesses
  ALTER COLUMN timezone SET DEFAULT 'America/Sao_Paulo',
  ALTER COLUMN currency SET DEFAULT 'BRL';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS buffer_after_min integer NOT NULL DEFAULT 0
    CHECK (buffer_after_min >= 0 AND buffer_after_min <= 180);

CREATE TABLE IF NOT EXISTS public.session_packages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  price_paid numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_paid >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.package_session_uses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.session_packages(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

CREATE TABLE IF NOT EXISTS public.client_intake_forms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  version text NOT NULL DEFAULT '1',
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_consents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  version text NOT NULL DEFAULT '1',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  pain_scale smallint CHECK (pain_scale BETWEEN 0 AND 10),
  body_areas text[] NOT NULL DEFAULT '{}',
  techniques text[] NOT NULL DEFAULT '{}',
  evolution text,
  client_response text,
  recommendations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_session_packages_business_client
  ON public.session_packages (business_id, client_id);
CREATE INDEX IF NOT EXISTS idx_package_session_uses_package
  ON public.package_session_uses (package_id, used_at);
CREATE INDEX IF NOT EXISTS idx_client_intake_forms_business_client
  ON public.client_intake_forms (business_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_consents_business_client
  ON public.client_consents (business_id, client_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_notes_business_client
  ON public.session_notes (business_id, client_id, created_at DESC);

ALTER TABLE public.session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_session_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_access_session_packages ON public.session_packages;
CREATE POLICY tenant_access_session_packages ON public.session_packages
  FOR ALL USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS tenant_access_package_session_uses ON public.package_session_uses;
CREATE POLICY tenant_access_package_session_uses ON public.package_session_uses
  FOR ALL USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS tenant_access_client_intake_forms ON public.client_intake_forms;
CREATE POLICY tenant_access_client_intake_forms ON public.client_intake_forms
  FOR ALL USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS tenant_access_client_consents ON public.client_consents;
CREATE POLICY tenant_access_client_consents ON public.client_consents
  FOR ALL USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS tenant_access_session_notes ON public.session_notes;
CREATE POLICY tenant_access_session_notes ON public.session_notes
  FOR ALL USING (business_id IN (SELECT public.my_business_ids()));

-- Health/intake/session data must never be readable by the public booking role.
REVOKE ALL ON TABLE public.client_intake_forms FROM anon;
REVOKE ALL ON TABLE public.client_consents FROM anon;
REVOKE ALL ON TABLE public.session_notes FROM anon;
REVOKE ALL ON TABLE public.session_packages FROM anon;
REVOKE ALL ON TABLE public.package_session_uses FROM anon;

GRANT ALL ON TABLE public.client_intake_forms TO authenticated;
GRANT ALL ON TABLE public.client_consents TO authenticated;
GRANT ALL ON TABLE public.session_notes TO authenticated;
GRANT ALL ON TABLE public.session_packages TO authenticated;
GRANT ALL ON TABLE public.package_session_uses TO authenticated;
