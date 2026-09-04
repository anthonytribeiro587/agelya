# Agelya

**Organize. Atenda. Cresça.**

Agelya é uma plataforma de agenda e gestão para profissionais de beleza, bem-estar e terapias, com o primeiro fluxo voltado à massoterapia.

## Recursos atuais

- agenda administrativa e página pública de agendamento;
- prevenção de conflito de horários;
- cadastro e histórico de clientes;
- prontuário de massoterapia com anamnese versionada, consentimentos e evolução por atendimento;
- pacotes de sessões com saldo e vínculo a atendimentos concluídos;
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

## Vertical de massoterapia

O fluxo de massoterapia inclui:

- criação e acompanhamento de pacotes de sessões;
- consumo de sessão vinculado a atendimento concluído/pago, sem duplicidade por agendamento;
- anamnese com histórico de versões;
- registro e revogação de consentimentos;
- evolução clínica com escala de dor, regiões trabalhadas, técnicas, resposta do cliente e recomendações;
- dados clínicos protegidos por autenticação e RLS, sem leitura pelo papel público/anon.

A aplicação permanece preparada para expansão a outros verticais de beleza, bem-estar e terapias.

## Licenças

A Agelya utiliza e modifica software de terceiros sob licenças compatíveis. Os avisos e atribuições legais aplicáveis permanecem preservados no arquivo `LICENSE` e no histórico do repositório.
