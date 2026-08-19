# Agelya

**Organize. Atenda. Cresça.**

Agelya é uma plataforma de agenda e gestão para profissionais de beleza, bem-estar e terapias, com o primeiro fluxo voltado à massoterapia.

## Recursos atuais

- agenda administrativa e página pública de agendamento;
- prevenção de conflito de horários;
- cadastro e histórico de clientes;
- serviços e profissionais;
- caixa e histórico de recebimentos;
- WhatsApp via Evolution API;
- automações configuráveis de confirmação, lembretes e pós-atendimento;
- confirmação do agendamento por resposta no WhatsApp;
- resumo diário das confirmações do dia seguinte;
- autenticação com Supabase e isolamento de dados por negócio.

## Automação de mensagens

Os lembretes e resumos automáticos são processados periodicamente pelo endpoint protegido de notificações. No Supabase, as extensões `pg_cron` e `pg_net` precisam estar habilitadas para que a migration `007_cron_jobs.sql` crie o agendador `agelya-notify`.

## Fundação técnica

- Next.js 14 + React + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Tailwind CSS
- Vercel
- Evolution API

## Status

MVP em validação final para a primeira implantação com cliente.

## Próximas etapas do vertical de massoterapia

A estrutura de banco já contempla pacotes de sessões, anamnese, consentimento e evolução de atendimento. As respectivas telas serão incorporadas conforme o produto evoluir.

## Licenças

A Agelya utiliza e modifica software de terceiros sob licenças compatíveis. Os avisos e atribuições legais aplicáveis permanecem preservados no arquivo `LICENSE` e no histórico do repositório.
