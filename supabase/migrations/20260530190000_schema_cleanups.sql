-- ============================================================================
-- Limpezas de schema (auditoria: schema-db#3, #4, #5)
-- ============================================================================

set search_path = public;

-- ----------------------------------------------------------------------------
-- #3: remove código morto apply_daily_yield / selic_daily_rate
-- ----------------------------------------------------------------------------
-- Sem nenhum caller (.ts/.tsx/cron) e sem guard de idempotência (chamar 2x no
-- mesmo dia aplicaria rendimento em dobro). São security definer grantadas a
-- authenticated → superfície de risco sem uso. O mecanismo real de rendimento
-- é investment_yields + quotes. Drop.
drop function if exists public.apply_daily_yield(uuid);
drop function if exists public.selic_daily_rate();

-- ----------------------------------------------------------------------------
-- #4: NOT NULL + ON DELETE SET NULL é contraditório
-- ----------------------------------------------------------------------------
-- Se o usuário referenciado em auth.users for deletado (fluxo LGPD), o Postgres
-- tenta setar a coluna pra NULL e falha por NOT NULL — bloqueando a exclusão.
-- A linha (upload / log) deve sobreviver à exclusão do usuário, então removemos
-- o NOT NULL (mantendo o ON DELETE SET NULL).
alter table public.document_uploads alter column uploaded_by drop not null;
alter table public.admin_audit_log alter column admin_user_id drop not null;

-- ----------------------------------------------------------------------------
-- #5: ensure_pending_intents retornava contagem errada (row_count sobrescrito)
-- ----------------------------------------------------------------------------
-- 'get diagnostics v_count = row_count' dentro do loop sobrescrevia v_count a
-- cada iteração em vez de acumular. Nenhum caller usa o retorno hoje, mas
-- corrigimos pra um futuro consumidor não receber número mentiroso.
create or replace function public.ensure_pending_intents(p_months_ahead int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_rule public.yield_rules;
  v_today date := current_date;
  v_i int;
  v_due date;
  v_count int := 0;
  v_inc int;
begin
  if v_household is null then return 0; end if;

  for v_rule in
    select * from public.yield_rules
    where household_id = v_household and is_active = true
  loop
    for v_i in 0..p_months_ahead loop
      v_due := make_date(
        extract(year from v_today + (v_i || ' months')::interval)::int,
        extract(month from v_today + (v_i || ' months')::interval)::int,
        least(v_rule.day_of_month, extract(day from
          (date_trunc('month', v_today + (v_i || ' months')::interval) + interval '1 month - 1 day')::date
        )::int)
      );

      if v_due < v_today then continue; end if;
      if v_rule.mode = 'reinvest' then continue; end if;

      insert into public.redemption_intents
        (household_id, yield_rule_id, due_date, suggested_amount, status)
      values
        (v_household, v_rule.id, v_due,
         coalesce(v_rule.suggested_amount, 0),
         'pending')
      on conflict (yield_rule_id, due_date) do nothing;

      get diagnostics v_inc = row_count;
      v_count := v_count + v_inc; -- acumula (antes sobrescrevia)
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.ensure_pending_intents(int) from public;
grant execute on function public.ensure_pending_intents(int) to authenticated;
