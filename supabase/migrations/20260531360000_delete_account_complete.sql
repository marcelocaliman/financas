-- ============================================================================
-- LGPD: exclusão de conta verificável e automágica (art. 18 VI) — ROADMAP LGPD
-- ============================================================================
-- Auditoria: TODOS os FKs household_id são ON DELETE CASCADE (só logs
-- operacionais são SET NULL). Logo, apagar o household remove as 43 tabelas de
-- dados em cascata, atomicamente. A RPC também apaga os auth.users e registra
-- uma PROVA anonimizada (só ids/contagens/timestamp — sem PII).

set search_path = public;

-- Prova de eliminação (retenção legal). Sem PII; household_id é só um UUID.
create table if not exists public.deletion_proofs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_count   integer not null,
  proof        jsonb not null,
  created_at   timestamptz not null default now()
);
alter table public.deletion_proofs enable row level security;
comment on table public.deletion_proofs is
  'Prova anonimizada de exclusão de conta (LGPD). Sem PII — só ids/contagens/timestamp.';

create or replace function public.delete_account_complete(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ids uuid[];
  v_tx       integer;
  v_proof    jsonb;
begin
  if p_household_id is null then
    raise exception 'household obrigatório';
  end if;

  v_user_ids := array(select id from public.users where household_id = p_household_id);
  select count(*) into v_tx from public.transactions where household_id = p_household_id;

  -- Tabelas escopadas por user_id (apaga antes do cascade, por garantia).
  if array_length(v_user_ids, 1) is not null then
    delete from public.user_consents          where user_id = any(v_user_ids);
    delete from public.data_access_requests   where user_id = any(v_user_ids);
    delete from public.announcement_dismissals where user_id = any(v_user_ids);
    delete from public.platform_admins        where user_id = any(v_user_ids);
  end if;

  -- Household → cascata apaga as 43 tabelas household-scoped.
  delete from public.households where id = p_household_id;

  -- Apaga as contas de autenticação.
  if array_length(v_user_ids, 1) is not null then
    delete from auth.users where id = any(v_user_ids);
  end if;

  v_proof := jsonb_build_object(
    'household_id', p_household_id,
    'users', coalesce(array_length(v_user_ids, 1), 0),
    'transactions', v_tx,
    'deleted_at', now()
  );
  insert into public.deletion_proofs (household_id, user_count, proof)
  values (p_household_id, coalesce(array_length(v_user_ids, 1), 0), v_proof);

  return v_proof;
end;
$$;

comment on function public.delete_account_complete is
  'Exclui um household por completo (cascade nas 43 tabelas + auth.users) e '
  'registra prova anonimizada. Chamável só pelo service-role (server action '
  'valida ownership + reauth antes).';

-- Só o service-role chama (a server action valida dono + reauth antes).
revoke all on function public.delete_account_complete(uuid) from public;
revoke all on function public.delete_account_complete(uuid) from authenticated;
grant execute on function public.delete_account_complete(uuid) to service_role;
