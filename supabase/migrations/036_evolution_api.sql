-- Agelya: Evolution API integration.
-- Credentials are intentionally kept in a server-only table and are never
-- exposed through the browser Supabase client.

CREATE TABLE IF NOT EXISTS public.business_evolution_config (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  api_url text NOT NULL,
  api_key text NOT NULL,
  instance_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  last_status text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_evolution_config ENABLE ROW LEVEL SECURITY;

-- Integration credentials must only be read/written by server code using the
-- service-role key. Authenticated browser clients do not receive direct access.
REVOKE ALL ON TABLE public.business_evolution_config FROM anon;
REVOKE ALL ON TABLE public.business_evolution_config FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_evolution_config TO service_role;

CREATE INDEX IF NOT EXISTS business_evolution_config_enabled_idx
  ON public.business_evolution_config (enabled)
  WHERE enabled = true;
