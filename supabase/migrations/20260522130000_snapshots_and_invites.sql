-- ============================================================================
-- patrimonio_snapshots — fotografias mensais do patrimônio total por household.
-- Permite que /dashboard mostre evolução real (não aproximação) ao longo dos
-- meses, mesmo pra investimentos e bens físicos que não têm histórico próprio.
--
-- Cron: /api/cron/snapshot-patrimonio dispara no primeiro dia útil de cada
-- mês e grava o "fim do mês anterior". A primeira execução grava também
-- todos os meses retroativos vazios pra dar um histórico inicial.
-- ============================================================================
create table public.patrimonio_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- Último dia do mês de referência (ex: 2026-04-30)
  month_end date not null,
  -- Composição em displayCurrency do dia do snapshot
  liquid numeric(14, 2) not null default 0,
  fixed_income numeric(14, 2) not null default 0,
  variable_income numeric(14, 2) not null default 0,
  physical numeric(14, 2) not null default 0,
  credit_card_debt numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  unique (household_id, month_end)
);

create index patrimonio_snapshots_household_idx
  on public.patrimonio_snapshots(household_id, month_end desc);

alter table public.patrimonio_snapshots enable row level security;

create policy "patrimonio_snapshots: full access within household"
  on public.patrimonio_snapshots for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- household_invites — convite pra parceira(o) ingressar no household.
--
-- Fluxo:
--   1. Admin do lar gera um convite via UI (/configuracoes) → recebe um código
--      curto (8 caracteres hex aleatório).
--   2. Compartilha o código com a parceira.
--   3. Parceira no /cadastro insere o código junto com nome+email+senha.
--   4. Após signup confirmado, ao invés de `bootstrap_household` (que cria
--      household novo), o sistema chama `redeem_household_invite` que:
--       - valida o código (não expirado, não usado)
--       - adiciona o user.id ao household existente como 'member'
--       - marca o convite como usado
--       - copia categorias se house ainda não tem (defensivo)
--
-- Códigos expiram em 14 dias por default. Admin pode revogar.
-- ============================================================================
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  used_by uuid references auth.users(id),
  revoked_at timestamptz
);

create index household_invites_code_idx on public.household_invites(code);
create index household_invites_household_idx on public.household_invites(household_id);

alter table public.household_invites enable row level security;

-- Membros do lar veem convites do lar
create policy "household_invites: members read household invites"
  on public.household_invites for select to authenticated
  using (household_id = public.current_household_id());

-- Apenas admin do lar cria/atualiza convites
create policy "household_invites: admin manages"
  on public.household_invites for all to authenticated
  using (
    household_id = public.current_household_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    household_id = public.current_household_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );


-- ============================================================================
-- RPC: generate_household_invite()
-- Gera um código novo pro lar do usuário. Apenas admin. Retorna o código.
-- ============================================================================
create or replace function public.generate_household_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_role text;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'must be authenticated';
  end if;

  select household_id, role into v_household_id, v_role
  from public.users where id = v_user_id;

  if v_household_id is null then
    raise exception 'no household';
  end if;
  if v_role <> 'admin' then
    raise exception 'only admin can invite';
  end if;

  -- Código curto, fácil de digitar — 8 chars hex.
  -- Loop defensivo: regenera se colidir.
  loop
    v_code := upper(encode(gen_random_bytes(4), 'hex'));
    begin
      insert into public.household_invites (household_id, code, created_by)
      values (v_household_id, v_code, v_user_id);
      exit;
    exception when unique_violation then
      -- tenta de novo
    end;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.generate_household_invite() from public;
grant execute on function public.generate_household_invite() to authenticated;


-- ============================================================================
-- RPC: revoke_household_invite(code)
-- Admin marca um convite como revogado (não pode ser usado).
-- ============================================================================
create or replace function public.revoke_household_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_role text;
begin
  select household_id, role into v_household_id, v_role
  from public.users where id = v_user_id;

  if v_role <> 'admin' then
    raise exception 'only admin can revoke';
  end if;

  update public.household_invites
  set revoked_at = now()
  where code = p_code
    and household_id = v_household_id
    and used_at is null
    and revoked_at is null;
end;
$$;

revoke all on function public.revoke_household_invite(text) from public;
grant execute on function public.revoke_household_invite(text) to authenticated;


-- ============================================================================
-- RPC: redeem_household_invite(code, display_name)
-- Chamada PÓS-signup ao invés de bootstrap_household quando o usuário
-- recebeu um código. Adiciona o user ao household existente como member.
--
-- IMPORTANTE: SECURITY DEFINER pra poder escrever em public.users (que tem
-- RLS estrito de "edit self"). O código atua como autorização — quem tem
-- o código pode ingressar.
-- ============================================================================
create or replace function public.redeem_household_invite(
  p_code text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_invite_id uuid;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_revoked_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'must be authenticated';
  end if;

  -- Já tem perfil? Não pode ingressar de novo
  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'already has household';
  end if;

  select id, household_id, expires_at, used_at, revoked_at
    into v_invite_id, v_household_id, v_expires_at, v_used_at, v_revoked_at
  from public.household_invites
  where code = upper(p_code)
  for update;

  if v_invite_id is null then
    raise exception 'invite not found';
  end if;
  if v_used_at is not null then
    raise exception 'invite already used';
  end if;
  if v_revoked_at is not null then
    raise exception 'invite revoked';
  end if;
  if v_expires_at < now() then
    raise exception 'invite expired';
  end if;

  -- Adiciona como member (não admin)
  insert into public.users (id, household_id, display_name, role)
  values (
    v_user_id,
    v_household_id,
    coalesce(nullif(trim(p_display_name), ''), 'Sem nome'),
    'member'
  );

  update public.household_invites
  set used_at = now(), used_by = v_user_id
  where id = v_invite_id;

  return v_household_id;
end;
$$;

revoke all on function public.redeem_household_invite(text, text) from public;
grant execute on function public.redeem_household_invite(text, text) to authenticated;


-- ============================================================================
-- RPC: merge_categories(source, target)
-- Move todas as transações + recorrências da categoria source pra target,
-- e arquiva a source. Útil pra consolidar categorias duplicadas.
-- Apenas categorias do mesmo household e mesmo `kind`.
-- ============================================================================
create or replace function public.merge_categories(
  p_source_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid := public.current_household_id();
  v_source_kind text;
  v_target_kind text;
  v_source_household uuid;
  v_target_household uuid;
begin
  if v_household_id is null then
    raise exception 'no household';
  end if;
  if p_source_id = p_target_id then
    raise exception 'source equals target';
  end if;

  select kind, household_id into v_source_kind, v_source_household
  from public.categories where id = p_source_id;
  select kind, household_id into v_target_kind, v_target_household
  from public.categories where id = p_target_id;

  if v_source_household <> v_household_id or v_target_household <> v_household_id then
    raise exception 'category from other household';
  end if;
  if v_source_kind <> v_target_kind then
    raise exception 'kinds differ — cannot merge';
  end if;

  -- Move transações
  update public.transactions
  set category_id = p_target_id
  where category_id = p_source_id
    and household_id = v_household_id;

  -- Move regras recorrentes
  update public.recurring_rules
  set category_id = p_target_id
  where category_id = p_source_id
    and household_id = v_household_id;

  -- Arquiva a fonte (não deleta — preserva auditoria)
  update public.categories
  set is_archived = true
  where id = p_source_id
    and household_id = v_household_id;
end;
$$;

revoke all on function public.merge_categories(uuid, uuid) from public;
grant execute on function public.merge_categories(uuid, uuid) to authenticated;


-- ============================================================================
-- RPC: reorder_categories(ordered_ids)
-- Recebe array de UUIDs ordenado e atualiza sort_order em bulk.
-- Apenas categorias do household do user.
-- ============================================================================
create or replace function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid := public.current_household_id();
  i int;
begin
  if v_household_id is null then
    raise exception 'no household';
  end if;
  for i in 1 .. array_length(p_ids, 1) loop
    update public.categories
    set sort_order = i
    where id = p_ids[i]
      and household_id = v_household_id;
  end loop;
end;
$$;

revoke all on function public.reorder_categories(uuid[]) from public;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
