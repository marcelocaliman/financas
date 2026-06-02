-- ============================================================================
-- Backfill do activity_log + blindagem do undo_activity contra perda de dados.
-- ============================================================================
--
-- PARTE 1 — undo_activity mais seguro (revisão adversarial pegou 2 buracos reais)
--
--   (a) CASCADE silencioso: undo de um 'insert' faz DELETE da linha. accounts,
--       investments, goals, physical_assets têm filhos ON DELETE CASCADE
--       (snapshots, movements, contribuições, vendas, cobertura IR...). Um clique
--       em "Desfazer a criação" apagaria esse histórico em cascata, sem registro
--       e sem recuperação. Já debts/recurring_rules só têm filhos SET NULL (sem
--       perda) e transactions só cascateia sub-linhas suas (splits) — esses são
--       seguros. Solução: ANTES de apagar, checar genericamente (pelo catálogo de
--       FKs) se existe alguma linha-filha via CASCADE-não-própria ou RESTRICT; se
--       existir, recusa com mensagem clara. Entidade recém-criada (sem filhos)
--       continua reversível; com histórico, não. Vale p/ dados novos também.
--
--   (b) Transferência = 2 lançamentos com transfer_pair_id (não é FK). undo de um
--       'insert' apagaria só uma perna, orfanando a outra. Guarda: qualquer undo
--       de lançamento com transfer_pair_id é recusado (gerencie pela tela de
--       transferências, que trata as duas pernas).
--
-- PARTE 2 — backfill: 1 entrada 'insert' ("Criou…") por linha que já existe, pra
--   /atividade não nascer vazia. Datada pelo created_at real. Idempotente
--   (NOT EXISTS). Insere direto no activity_log → não dispara o trigger. Não dá
--   pra reconstruir edições/exclusões passadas (nunca foram capturadas).
--   actor blindado contra FK pendurada (households.created_by aponta p/ auth.users;
--   se não houver perfil em public.users, degrada p/ NULL = "sistema").
-- ============================================================================

-- ---------- PARTE 1 ----------
create or replace function public.undo_activity(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v public.activity_log;
  v_setexpr text;
  fk record;
  v_exists boolean;
  -- sub-linhas "donas" do próprio registro: apagar junto é correto, não é perda.
  v_owned constant text[] := array['transaction_splits', 'aport_suggestion_dismissals'];
begin
  select * into v from public.activity_log
    where id = p_log_id
      and household_id = public.current_household_id()
      and undone_at is null;
  if not found then
    return jsonb_build_object('error', 'Ação não encontrada ou já desfeita.');
  end if;

  -- Guarda de transferência (duas pernas; não dá pra desfazer só uma).
  if v.table_name = 'transactions'
     and coalesce(v.new_data->>'transfer_pair_id', v.old_data->>'transfer_pair_id') is not null then
    return jsonb_build_object('error',
      'Isso faz parte de uma transferência (dois lançamentos). Gerencie pela tela de transferências, não pelo histórico.');
  end if;

  -- Segurança do undo de criação: não apagar algo que já tem dependências
  -- (apagaria histórico em cascata, ou violaria RESTRICT).
  if v.action = 'insert' then
    for fk in
      select c.conrelid::regclass::text as child_tbl, a.attname as child_col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f'
        and c.confrelid = format('public.%I', v.table_name)::regclass
        and array_length(c.conkey, 1) = 1
        and (
          (c.confdeltype = 'c' and c.conrelid::regclass::text <> all (v_owned)) -- cascade não-própria
          or c.confdeltype in ('r', 'a')                                        -- restrict / no action
        )
    loop
      execute format('select exists(select 1 from %s where %I = $1)', fk.child_tbl, fk.child_col)
        into v_exists using v.row_id;
      if v_exists then
        return jsonb_build_object('error',
          'Não dá pra desfazer a criação: esse item já tem dados ligados a ele (lançamentos, histórico, aportes…). Exclua pela tela correspondente, se for o caso.');
      end if;
    end loop;
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
  perform set_config('app.audit_suppress', 'off', true);
  return jsonb_build_object('ok', true, 'action', v.action, 'table', v.table_name);

exception when others then
  perform set_config('app.audit_suppress', 'off', true);
  return jsonb_build_object('error', 'Não deu pra desfazer: ' || SQLERRM);
end;
$function$;

-- ---------- PARTE 2 ----------
do $$
declare
  r record;
  v_actor_expr text;
  v_sql text;
  v_count int;
  v_total int := 0;
begin
  for r in
    select tbl, has_cb from (values
      ('transactions',          true),
      ('recurring_rules',       true),
      ('accounts',              false),
      ('investments',           false),
      ('debts',                 false),
      ('physical_assets',       false),
      ('goals',                 false),
      ('ir_deductible_payments', false)
    ) as x(tbl, has_cb)
  loop
    -- actor validado contra public.users (degrada p/ NULL se não houver perfil).
    v_actor_expr := case
      when r.has_cb then
        'coalesce((select u.id from public.users u where u.id = t.created_by),'
        || '(select u.id from public.users u where u.id = h.created_by))'
      else
        '(select u.id from public.users u where u.id = h.created_by)'
    end;

    v_sql := format($f$
      insert into public.activity_log
        (household_id, actor_user_id, table_name, row_id, action, new_data, created_at)
      select t.household_id, %s, %L, t.id, 'insert', to_jsonb(t), t.created_at
      from public.%I t
      left join public.households h on h.id = t.household_id
      where not exists (
        select 1 from public.activity_log al
        where al.table_name = %L and al.row_id = t.id and al.action = 'insert'
      )
    $f$, v_actor_expr, r.tbl, r.tbl, r.tbl);

    execute v_sql;
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
    raise notice 'backfill %: % linha(s)', r.tbl, v_count;
  end loop;

  raise notice 'TOTAL backfill activity_log: % linha(s)', v_total;
end $$;
