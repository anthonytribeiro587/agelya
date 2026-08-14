-- Agelya security hardening after auth/automation audit.

-- notification_log is written by server-side automation code. Anonymous users
-- do not need direct table privileges; authenticated access remains RLS-scoped.
REVOKE ALL ON TABLE public.notification_log FROM anon;
GRANT SELECT ON TABLE public.notification_log TO authenticated;
GRANT ALL ON TABLE public.notification_log TO service_role;

-- Ensure the sensitive Evolution credential table remains server-only even if
-- permissions were changed manually in an older environment.
REVOKE ALL ON TABLE public.business_evolution_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_evolution_config TO service_role;

-- Automation rules are tenant-scoped and may be edited by authenticated users;
-- anonymous callers must never enumerate or mutate them.
REVOKE ALL ON TABLE public.business_automation_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_automation_rules TO authenticated;
GRANT ALL ON TABLE public.business_automation_rules TO service_role;

-- SECURITY DEFINER helper must not be callable directly by app roles. It exists
-- only as an AFTER INSERT trigger on businesses.
REVOKE ALL ON FUNCTION public.seed_agelya_automation_rules() FROM PUBLIC, anon, authenticated;
