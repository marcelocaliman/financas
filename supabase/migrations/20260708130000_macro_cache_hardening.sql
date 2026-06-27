-- Alinha o macro_cache (criado em 20260705100000) à convenção de hardening de RLS das demais
-- tabelas sensíveis (app_flags, vaults, tickets…): além de `enable`, também `force` (RLS vale
-- até pro owner) e `revoke` dos grants default de anon/authenticated. Defesa em profundidade —
-- o dado é público (juros/inflação), mas mantém a consistência e protege contra um futuro
-- `create policy` acidental. Sem mudança de comportamento pro service_role (/api/macro).
alter table public.macro_cache force row level security;
revoke all on public.macro_cache from anon, authenticated;
