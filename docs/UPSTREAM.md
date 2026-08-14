# Sincronização com o Pronto

A Agelya foi inicializada a partir do Pronto self-hosted para aproveitar uma base de agenda/CRM/POS já madura.

Upstream: `SGrappelli/pronto`

Commit importado inicialmente: `899cb21818cac86ce89b838d48265fb8ef4f1376` (13/08/2026).

## Estratégia

A Agelya não deve fazer merge cego de todo o upstream depois que os domínios começarem a divergir. Para atualizações futuras:

1. buscar o último commit do Pronto;
2. revisar correções de booking, segurança, Supabase, mobile e notificações;
3. portar/cherry-pick apenas mudanças relevantes;
4. executar build e revisar migrations/RLS antes de produção.

Correções de concorrência de agenda, segurança e compatibilidade têm prioridade sobre novidades comerciais do upstream.
