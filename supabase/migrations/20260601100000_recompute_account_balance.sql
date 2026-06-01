-- ============================================================================
-- Recálculo canônico de saldo de conta (date-aware) — conserta DRIFT.
-- ============================================================================
-- O current_balance é um saldo corrente mutado por trigger + promovido pelo
-- cron (advance_pending_balances). Importações em lote e edições podiam deixar
-- o current_balance fora de sincronia com a soma real dos lançamentos (e flags
-- balance_applied_at de lançamentos futuros marcadas como aplicadas).
--
-- Estas funções RE-DERIVAM o saldo das transações (a fonte da verdade), tornando
-- o saldo reconciliável e auto-curável. Saldo canônico = soma dos deltas dos
-- lançamentos com date <= hoje (mesma semântica date-aware do trigger).
-- Idempotente.

create or replace function public.recompute_account_balance(p_account_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_hh uuid;
  v_caller uuid := public.current_household_id();
  v_balance numeric(14, 2);
begin
  select household_id into v_hh from public.accounts where id = p_account_id;
  if v_hh is null then
    raise exception 'Conta % não encontrada', p_account_id;
  end if;
  -- Sessão autenticada só recalcula contas do próprio household. Chamada de
  -- serviço (sem JWT → current_household_id() null) é permitida (cron/repair).
  if v_caller is not null and v_hh <> v_caller then
    raise exception 'Sem permissão pra recalcular conta de outro household';
  end if;

  -- 1) Conserta flags: aplicado SSE date <= hoje. (O UPDATE dispara o trigger
  --    BEFORE, que mexe no current_balance — sobrescrito no passo 3.)
  update public.transactions
    set balance_applied_at = case when date <= v_today then now() else null end
    where account_id = p_account_id
      and (balance_applied_at is not null) is distinct from (date <= v_today);

  -- 2) Saldo canônico = soma dos deltas com date <= hoje (independe das flags).
  select round(coalesce(sum(
           public.transaction_balance_delta(kind, transfer_direction, amount_account)
         ), 0), 2)
    into v_balance
    from public.transactions
    where account_id = p_account_id and date <= v_today;

  -- 3) Sobrescreve current_balance (autoritativo — descarta o drift).
  update public.accounts set current_balance = v_balance where id = p_account_id;
  return v_balance;
end;
$$;

revoke all on function public.recompute_account_balance(uuid) from public;
grant execute on function public.recompute_account_balance(uuid) to authenticated, service_role;

-- Recalcula TODAS as contas do household do chamador. Backing do botão
-- "recalcular saldos" e chamado pela importação pra nunca deixar drift.
create or replace function public.recompute_household_balances()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hh uuid := public.current_household_id();
  v_count integer := 0;
  r record;
begin
  if v_hh is null then
    raise exception 'Sem household no contexto';
  end if;
  for r in select id from public.accounts where household_id = v_hh loop
    perform public.recompute_account_balance(r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.recompute_household_balances() from public;
grant execute on function public.recompute_household_balances() to authenticated, service_role;
