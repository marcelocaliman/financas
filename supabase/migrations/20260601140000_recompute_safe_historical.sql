-- ============================================================================
-- Correção do recompute de saldo: NÃO sobrescrever do zero + respeitar históricas.
-- ============================================================================
-- A versão anterior recalculava current_balance = soma de TODOS os lançamentos
-- com date<=hoje, o que (a) incluía is_historical_ir_only (que o trigger exclui
-- do saldo) e (b) descartava o saldo de ABERTURA de quem começa no meio do ano
-- (saldo real que não vem de lançamento). Resultado: saldos inflados.
--
-- Nova versão: conserta apenas as flags balance_applied_at inconsistentes e deixa
-- o TRIGGER ajustar o current_balance pelo delta — preservando a abertura e
-- excluindo históricas. Sem callers automáticos (removidos do app).

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
begin
  select household_id into v_hh from public.accounts where id = p_account_id;
  if v_hh is null then
    raise exception 'Conta % não encontrada', p_account_id;
  end if;
  if v_caller is not null and v_hh <> v_caller then
    raise exception 'Sem permissão pra recalcular conta de outro household';
  end if;

  -- "Aplicado" SSE date<=hoje E não-histórica. Conserta só linhas inconsistentes;
  -- o trigger BEFORE UPDATE ajusta o current_balance pelo delta (preserva abertura).
  update public.transactions
    set balance_applied_at = case
      when date <= v_today and is_historical_ir_only = false then now() else null end
    where account_id = p_account_id
      and (balance_applied_at is not null)
        is distinct from (date <= v_today and is_historical_ir_only = false);

  return (select current_balance from public.accounts where id = p_account_id);
end;
$$;
