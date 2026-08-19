-- Agelya — confirmação real 1 dia antes + resumo diário para a profissional.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS confirmation_summary_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confirmation_summary_time time NOT NULL DEFAULT '19:00';

ALTER TABLE public.business_automation_rules
  ADD COLUMN IF NOT EXISTS decline_keywords text[] NOT NULL DEFAULT ARRAY['nao', 'não', 'cancelar', 'cancelo', 'desmarcar']::text[];

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_declined_at timestamptz;

-- A confirmação deixa de acontecer na criação e passa a ser solicitada 24h antes.
UPDATE public.business_automation_rules
SET
  name = 'Confirmar 1 dia antes',
  event_type = 'appointment_before',
  offset_minutes = 1440,
  enabled = true,
  message_template = E'Olá, {cliente}! 👋\n\nVocê tem *{servico}* amanhã, *{data} às {hora}*.\n\nVocê confirma seu horário?\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.\n\n— {empresa}',
  requires_reply_confirmation = true,
  confirmation_keywords = ARRAY['sim', 'confirmo', 'confirmado']::text[],
  decline_keywords = ARRAY['nao', 'não', 'cancelar', 'cancelo', 'desmarcar']::text[],
  sort_order = 20,
  updated_at = now()
WHERE rule_key = 'confirmation_request';

-- A antiga mensagem de 24h fica redundante; a confirmação acima assume esse papel.
DELETE FROM public.business_automation_rules
WHERE rule_key = 'reminder_24h' AND is_system = true;

-- Mensagem imediata apenas informa que a reserva foi recebida; não pede confirmação.
INSERT INTO public.business_automation_rules
  (business_id, rule_key, name, event_type, offset_minutes, enabled, message_template,
   requires_reply_confirmation, is_system, sort_order)
SELECT
  b.id,
  'booking_received',
  'Reserva recebida',
  'appointment_created',
  0,
  true,
  E'Olá, {cliente}! 👋\n\nSeu horário de *{servico}* foi reservado para *{data} às {hora}*.\n\nNo dia anterior ao atendimento enviaremos uma mensagem para você confirmar o horário. 💚\n\n— {empresa}',
  false,
  true,
  10
FROM public.businesses b
ON CONFLICT (business_id, rule_key) DO NOTHING;

-- Novos negócios já nascem com o fluxo correto.
CREATE OR REPLACE FUNCTION public.seed_agelya_automation_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.business_automation_rules
    (business_id, rule_key, name, event_type, offset_minutes, enabled, message_template,
     requires_reply_confirmation, confirmation_keywords, decline_keywords, is_system, sort_order)
  VALUES
    (NEW.id, 'booking_received', 'Reserva recebida', 'appointment_created', 0, true,
      E'Olá, {cliente}! 👋\n\nSeu horário de *{servico}* foi reservado para *{data} às {hora}*.\n\nNo dia anterior ao atendimento enviaremos uma mensagem para você confirmar o horário. 💚\n\n— {empresa}',
      false, ARRAY['sim', 'confirmo', 'confirmado']::text[], ARRAY['nao', 'não', 'cancelar']::text[], true, 10),
    (NEW.id, 'confirmation_request', 'Confirmar 1 dia antes', 'appointment_before', 1440, true,
      E'Olá, {cliente}! 👋\n\nVocê tem *{servico}* amanhã, *{data} às {hora}*.\n\nVocê confirma seu horário?\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.\n\n— {empresa}',
      true, ARRAY['sim', 'confirmo', 'confirmado']::text[], ARRAY['nao', 'não', 'cancelar', 'cancelo', 'desmarcar']::text[], true, 20),
    (NEW.id, 'reminder_1h', 'Lembrete 1 hora antes', 'appointment_before', 60, true,
      E'Olá, {cliente}! Seu atendimento de *{servico}* é daqui a aproximadamente 1 hora, às *{hora}*. 💚\n\nAté já!\n— {empresa}',
      false, ARRAY['sim']::text[], ARRAY['nao']::text[], true, 30),
    (NEW.id, 'thank_you', 'Mensagem após o atendimento', 'appointment_after', 30, true,
      E'Olá, {cliente}! 💚\n\nObrigada pela confiança no atendimento de hoje. Espero que você tenha gostado!\n\nSe precisar de algo, estou por aqui.\n\n— {empresa}',
      false, ARRAY['sim']::text[], ARRAY['nao']::text[], true, 40),
    (NEW.id, 'reactivation_30d', 'Reativação após 30 dias', 'reactivation', 43200, false,
      E'Olá, {cliente}! Faz um tempinho desde seu último atendimento por aqui. 😊\n\nSe quiser reservar um novo horário, é só me chamar.\n\n— {empresa}',
      false, ARRAY['sim']::text[], ARRAY['nao']::text[], true, 50),
    (NEW.id, 'birthday', 'Mensagem de aniversário', 'birthday', 0, false,
      E'Feliz aniversário, {cliente}! 🎉💚\n\nDesejamos um dia maravilhoso para você!\n\n— {empresa}',
      false, ARRAY['sim']::text[], ARRAY['nao']::text[], true, 60)
  ON CONFLICT (business_id, rule_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_agelya_automation_rules() FROM PUBLIC;
