-- Agelya — configurable WhatsApp automation rules + client confirmation state

CREATE TABLE IF NOT EXISTS public.business_automation_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  name text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'appointment_created',
    'appointment_before',
    'appointment_after',
    'birthday',
    'reactivation'
  )),
  offset_minutes integer NOT NULL DEFAULT 0 CHECK (offset_minutes BETWEEN 0 AND 525600),
  enabled boolean NOT NULL DEFAULT true,
  message_template text NOT NULL CHECK (char_length(message_template) BETWEEN 1 AND 4000),
  requires_reply_confirmation boolean NOT NULL DEFAULT false,
  confirmation_keywords text[] NOT NULL DEFAULT ARRAY['sim', 'confirmo', 'confirmado']::text[],
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, rule_key)
);

CREATE INDEX IF NOT EXISTS automation_rules_business_enabled_idx
  ON public.business_automation_rules (business_id, enabled, event_type);

ALTER TABLE public.business_automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_rules_tenant ON public.business_automation_rules;
CREATE POLICY automation_rules_tenant
  ON public.business_automation_rules
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.my_business_ids()));

REVOKE ALL ON TABLE public.business_automation_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_automation_rules TO authenticated;
GRANT ALL ON TABLE public.business_automation_rules TO service_role;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_confirmation_text text;

ALTER TABLE public.business_evolution_config
  ADD COLUMN IF NOT EXISTS webhook_secret text;

-- Default rules for businesses that already exist.
INSERT INTO public.business_automation_rules
  (business_id, rule_key, name, event_type, offset_minutes, enabled, message_template, requires_reply_confirmation, is_system, sort_order)
SELECT b.id, v.rule_key, v.name, v.event_type, v.offset_minutes, v.enabled, v.message_template, v.requires_reply_confirmation, true, v.sort_order
FROM public.businesses b
CROSS JOIN (VALUES
  (
    'confirmation_request',
    'Pedir confirmação do agendamento',
    'appointment_created',
    0,
    true,
    E'Olá, {cliente}! 👋\n\nSeu horário de *{servico}* está reservado para *{data} às {hora}*.\n\nResponda *SIM* para confirmar seu agendamento.\n\n— {empresa}',
    true,
    10
  ),
  (
    'reminder_24h',
    'Lembrete 1 dia antes',
    'appointment_before',
    1440,
    true,
    E'Olá, {cliente}! 😊\n\nPassando para lembrar que amanhã você tem *{servico}* às *{hora}*.\n\n📅 {data}\n📍 {endereco}\n\nSe precisar alterar o horário, fale com a gente.\n\n— {empresa}',
    false,
    20
  ),
  (
    'reminder_1h',
    'Lembrete 1 hora antes',
    'appointment_before',
    60,
    true,
    E'Olá, {cliente}! Seu atendimento de *{servico}* é daqui a aproximadamente 1 hora, às *{hora}*. 💚\n\nAté já!\n— {empresa}',
    false,
    30
  ),
  (
    'thank_you',
    'Mensagem após o atendimento',
    'appointment_after',
    30,
    true,
    E'Olá, {cliente}! 💚\n\nObrigada pela confiança no atendimento de hoje. Espero que você tenha gostado!\n\nSe precisar de algo, estou por aqui.\n\n— {empresa}',
    false,
    40
  ),
  (
    'reactivation_30d',
    'Reativação após 30 dias',
    'reactivation',
    43200,
    false,
    E'Olá, {cliente}! Faz um tempinho desde seu último atendimento por aqui. 😊\n\nSe quiser reservar um novo horário, é só me chamar.\n\n— {empresa}',
    false,
    50
  ),
  (
    'birthday',
    'Mensagem de aniversário',
    'birthday',
    0,
    false,
    E'Feliz aniversário, {cliente}! 🎉💚\n\nDesejamos um dia maravilhoso para você!\n\n— {empresa}',
    false,
    60
  )
) AS v(rule_key, name, event_type, offset_minutes, enabled, message_template, requires_reply_confirmation, sort_order)
ON CONFLICT (business_id, rule_key) DO NOTHING;

-- Seed the same defaults for every new business.
CREATE OR REPLACE FUNCTION public.seed_agelya_automation_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.business_automation_rules
    (business_id, rule_key, name, event_type, offset_minutes, enabled, message_template, requires_reply_confirmation, is_system, sort_order)
  VALUES
    (NEW.id, 'confirmation_request', 'Pedir confirmação do agendamento', 'appointment_created', 0, true,
      E'Olá, {cliente}! 👋\n\nSeu horário de *{servico}* está reservado para *{data} às {hora}*.\n\nResponda *SIM* para confirmar seu agendamento.\n\n— {empresa}', true, true, 10),
    (NEW.id, 'reminder_24h', 'Lembrete 1 dia antes', 'appointment_before', 1440, true,
      E'Olá, {cliente}! 😊\n\nPassando para lembrar que amanhã você tem *{servico}* às *{hora}*.\n\n📅 {data}\n📍 {endereco}\n\nSe precisar alterar o horário, fale com a gente.\n\n— {empresa}', false, true, 20),
    (NEW.id, 'reminder_1h', 'Lembrete 1 hora antes', 'appointment_before', 60, true,
      E'Olá, {cliente}! Seu atendimento de *{servico}* é daqui a aproximadamente 1 hora, às *{hora}*. 💚\n\nAté já!\n— {empresa}', false, true, 30),
    (NEW.id, 'thank_you', 'Mensagem após o atendimento', 'appointment_after', 30, true,
      E'Olá, {cliente}! 💚\n\nObrigada pela confiança no atendimento de hoje. Espero que você tenha gostado!\n\nSe precisar de algo, estou por aqui.\n\n— {empresa}', false, true, 40),
    (NEW.id, 'reactivation_30d', 'Reativação após 30 dias', 'reactivation', 43200, false,
      E'Olá, {cliente}! Faz um tempinho desde seu último atendimento por aqui. 😊\n\nSe quiser reservar um novo horário, é só me chamar.\n\n— {empresa}', false, true, 50),
    (NEW.id, 'birthday', 'Mensagem de aniversário', 'birthday', 0, false,
      E'Feliz aniversário, {cliente}! 🎉💚\n\nDesejamos um dia maravilhoso para você!\n\n— {empresa}', false, true, 60)
  ON CONFLICT (business_id, rule_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_agelya_automation_rules() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_seed_agelya_automation_rules ON public.businesses;
CREATE TRIGGER trg_seed_agelya_automation_rules
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.seed_agelya_automation_rules();
