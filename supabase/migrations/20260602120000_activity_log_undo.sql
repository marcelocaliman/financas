-- ============================================================================
-- activity_log: histórico/auditoria de TODAS as mudanças do usuário + DESFAZER
-- ============================================================================
-- Antes só existia /atividade derivado de updated_at: não capturava exclusões,
-- não guardava o "antes" e não permitia reverter. Aqui um trigger genérico
-- captura insert/update/delete das tabelas user-facing com snapshot (old/new
-- jsonb), permitindo DESFAZER uma ação errada. Filtra ruído de sistema
-- (updated_at, balance_applied_at, current_balance derivado da conta etc.) pra
-- o log ficar limpo (só o que o usuário de fato fez).

set search_path = public;

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_household_idx
  on public.activity_log(household_id, created_at desc);

alter table public.activity_log enable row level security;
drop policy if exists "activity_log: read own household" on public.activity_log;
create policy "activity_log: read own household" on public.activity_log
  for select to authenticated
  using (household_id = public.current_household_id());

-- ── Trigger genérico de auditoria ──────────────────────────────────────────
create or replace function public.tg_activity_audit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_noise text[] := array[
    'updated_at', 'balance_applied_at', 'debt_applied_at',
    'last_auto_materialize_at', 'last_yield_at'
  ];
  v_old jsonb;
  v_new jsonb;
begin
  -- Durante o próprio undo, suprime (não loga a reversão como nova ação).
  if coalesce(current_setting('app.audit_suppress', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_log(household_id, actor_user_id, table_name, row_id, action, new_data)
      values (new.household_id, auth.uid(), tg_table_name, new.id, 'insert', to_jsonb(new));
    return new;

  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    -- current_balance da conta é DERIVADO (toda transação mexe) → ruído.
    if tg_table_name = 'accounts' then v_noise := array_append(v_noise, 'current_balance'); end if;
    if (v_old - v_noise) = (v_new - v_noise) then
      return new; -- só mudou ruído de sistema → não loga
    end if;
    insert into public.activity_log(household_id, actor_user_id, table_name, row_id, action, old_data, new_data)
      values (new.household_id, auth.uid(), tg_table_name, new.id, 'update', v_old, v_new);
    return new;

  else -- DELETE
    insert into public.activity_log(household_id, actor_user_id, table_name, row_id, action, old_data)
      values (old.household_id, auth.uid(), tg_table_name, old.id, 'delete', to_jsonb(old));
    return old;
  end if;
end;
$$;

-- Aplica nas tabelas user-facing.
do $$
declare
  t text;
begin
  foreach t in array array[
    'transactions', 'accounts', 'investments', 'debts',
    'physical_assets', 'goals', 'recurring_rules', 'ir_deductible_payments'
  ]
  loop
    execute format('drop trigger if exists tg_activity_audit on public.%I', t);
    execute format(
      'create trigger tg_activity_audit after insert or update or delete on public.%I '
      'for each row execute function public.tg_activity_audit()', t);
  end loop;
end $$;

-- ── Função de DESFAZER ──────────────────────────────────────────────────────
-- insert → deleta a linha; delete → re-insere o snapshot; update → restaura os
-- valores antigos. Os triggers de saldo reaplicam o efeito correto. Suprime a
-- própria reversão do log. Limitação: funciona melhor pras ações recentes — se
-- a linha foi modificada/cascateada depois, a reversão pode falhar (retorna erro).
create or replace function public.undo_activity(p_log_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.activity_log;
  v_setexpr text;
begin
  select * into v from public.activity_log
    where id = p_log_id
      and household_id = public.current_household_id()
      and undone_at is null;
  if not found then
    return jsonb_build_object('error', 'Ação não encontrada ou já desfeita.');
  end if;

  perform set_config('app.audit_suppress', 'on', true); -- não loga a reversão

  if v.action = 'insert' then
    execute format('delete from public.%I where id = $1', v.table_name) using v.row_id;

  elsif v.action = 'delete' then
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
      v.table_name, v.table_name) using v.old_data;

  elsif v.action = 'update' then
    select string_agg(format('%I = r.%I', column_name, column_name), ', ')
      into v_setexpr
      from information_schema.columns
      where table_schema = 'public' and table_name = v.table_name and column_name <> 'id';
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2',
      v.table_name, v_setexpr, v.table_name) using v.old_data, v.row_id;
  end if;

  update public.activity_log set undone_at = now() where id = p_log_id;
  perform set_config('app.audit_suppress', 'off', true); -- não vaza pro resto da tx
  return jsonb_build_object('ok', true, 'action', v.action, 'table', v.table_name);

exception when others then
  perform set_config('app.audit_suppress', 'off', true);
  return jsonb_build_object('error', 'Não deu pra desfazer: ' || SQLERRM);
end;
$$;

revoke all on function public.undo_activity(uuid) from public;
grant execute on function public.undo_activity(uuid) to authenticated;

comment on table public.activity_log is
  'Histórico/auditoria de mudanças do usuário (insert/update/delete) com snapshot '
  'old/new pra permitir DESFAZER. Alimentado pelo trigger tg_activity_audit.';
