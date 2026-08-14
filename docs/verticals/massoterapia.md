# Vertical inicial — Massoterapia

A primeira implantação comercial da Agelya é voltada para uma profissional de massoterapia. O objetivo é manter o painel simples para uso diário, aproveitando a agenda e o CRM maduros da base Pronto e adicionando somente os recursos específicos que geram valor para esse atendimento.

## MVP operacional

1. **Agenda** — dia/semana, criação manual, agendamento público, confirmação, cancelamento, falta e prevenção de conflito.
2. **Clientes** — cadastro, contato, aniversário, observações, tags e histórico de atendimentos.
3. **Serviços** — nome, duração, preço, capacidade e intervalo de preparação após a sessão.
4. **Caixa** — recebimentos de sessões e produtos, forma de pagamento e histórico.
5. **Pacotes** — quantidade contratada, sessões utilizadas, validade e vínculo com atendimentos.
6. **Anamnese e consentimento** — dados sensíveis protegidos por RLS e nunca disponíveis ao papel público/anon.
7. **Evolução de sessão** — regiões trabalhadas, técnicas, escala de dor, resposta e recomendações.
8. **WhatsApp** — confirmação, lembrete e reativação; Evolution API entra como integração separada.

## Ordem de implementação da interface

- Fase A: colocar Agenda, Clientes e Caixa em produção para a primeira cliente.
- Fase B: telas de Pacotes, Anamnese e Evolução usando as tabelas da migration 035.
- Fase C: Evolution API, sinal de reserva, política de cancelamento e automações.
- Fase D: multiempresa SaaS, cobrança e painel administrativo.

## Regra de produto

Módulos que não fizerem sentido para um negócio devem poder ser ocultados. A Agelya deve continuar servindo massoterapia, estética, lash/brow, salão e outros serviços sem obrigar todos os clientes a usar estoque ou PDV completo.
