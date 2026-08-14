-- Agelya: agendador das automações de WhatsApp (pg_cron + pg_net)
--
-- Esta migration é opcional até as extensões pg_cron e pg_net estarem
-- habilitadas no Supabase. O runner de migrations substitui automaticamente:
--   ${NEXT_PUBLIC_APP_URL} pela URL da Agelya
--   ${CRON_SECRET} pelo segredo configurado no ambiente
--
-- O job chama /api/cron/notify a cada 15 minutos. O endpoint exige Bearer
-- CRON_SECRET e lê business_automation_rules para decidir quais mensagens enviar.

-- Remove nomes usados por versões anteriores, caso já existam.
select cron.unschedule('pronto-notify') where exists (
  select 1 from cron.job where jobname = 'pronto-notify'
);

select cron.unschedule('agelya-notify') where exists (
  select 1 from cron.job where jobname = 'agelya-notify'
);

-- Executa as regras ativas a cada 15 minutos.
select cron.schedule(
  'agelya-notify',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := '${NEXT_PUBLIC_APP_URL}/api/cron/notify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ${CRON_SECRET}'
    )
  ) as request_id;
  $$
);

-- Verificação manual após a migration:
-- SELECT jobid, jobname, schedule, active
-- FROM cron.job
-- WHERE jobname = 'agelya-notify';
--
-- Histórico:
-- SELECT *
-- FROM cron.job_run_details
-- WHERE jobname = 'agelya-notify'
-- ORDER BY start_time DESC
-- LIMIT 10;
