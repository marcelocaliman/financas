-- ============================================================================
-- Realtime do "online agora" — Postgres Changes (admin-push).
--
-- O painel do DONO assina as mudanças de public.presence (entrou = INSERT, saiu = DELETE)
-- e reconta na hora via admin_online(). O Realtime aplica a RLS abaixo → SÓ o admin recebe
-- os eventos; a contagem segue PRIVADA (nenhum usuário abre conexão nem enxerga o número).
-- A escrita continua exclusivamente via service_role (serverless /api/presence), que ignora RLS.
-- ============================================================================

-- Privilégio + policy: authenticated só lê presence se for admin (igual ao padrão de app_events).
grant select on public.presence to authenticated;
drop policy if exists presence_select_admin on public.presence;
create policy presence_select_admin on public.presence
  for select using (public.is_admin());

-- Publica a tabela no Realtime (postgres_changes respeita a RLS acima).
do $$
begin
  alter publication supabase_realtime add table public.presence;
exception when others then null;  -- idempotente (já publicada)
end $$;
