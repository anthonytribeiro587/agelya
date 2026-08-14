# Agelya

Plataforma de agenda e gestão para profissionais de **beleza, bem-estar e terapias**, iniciando pelo fluxo de massoterapia.

## Fundação técnica

A Agelya parte da edição self-hosted do [Pronto](https://github.com/SGrappelli/pronto), sob licença MIT, e mantém a atribuição correspondente no arquivo `LICENSE` e no histórico deste projeto.

Stack principal:

- Next.js 14 + React + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Tailwind CSS
- Agenda pública e painel administrativo
- CRM, serviços, profissionais, caixa/POS e estoque
- PWA e Docker

## Direção do produto

O primeiro vertical da Agelya é **massoterapia**, com foco em:

- agenda diária/semanal e prevenção de conflito de horários;
- cadastro e histórico de clientes;
- serviços, duração e intervalo entre sessões;
- pacotes de sessões e saldo restante;
- anamnese e consentimento;
- ficha de evolução por atendimento;
- financeiro simples;
- confirmação e lembretes por WhatsApp;
- página pública de agendamento.

## Status

Esta branch importa a versão mais recente do Pronto e aplica a fundação inicial da marca Agelya. Antes de produção ainda serão revisados multiempresa, LGPD, dados sensíveis de saúde, integrações e identidade visual final.
