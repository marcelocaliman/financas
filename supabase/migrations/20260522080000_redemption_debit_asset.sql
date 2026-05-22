-- ============================================================================
-- Finanças — execute_redemption agora debita o ATIVO (não só o caixa)
-- ============================================================================
-- Antes: saque só transferia entre contas. O ativo ficava com saldo intacto,
-- continuando a render sobre o valor pré-saque (incorreto conceitualmente).
--
-- Agora:
--   Renda fixa (Tesouro, CDB, LCI…): debita investments.current_balance
--     e ajusta initial_amount proporcionalmente, mantendo o preço unitário
--     médio (necessário pra apuração de IR regressivo).
--   Renda variável (FII/ação/ETF/cripto): falha com mensagem clara
--     pedindo pra usar "Vender" via investment_movements (registra
--     quantity vendida + preço, calcula resultado).
-- ============================================================================

set search_path = public;

create or replace function public.execute_redemption(
  p_intent_id uuid,
  p_amount numeric
)
returns uuid -- transfer_pair_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_user uuid := auth.uid();
  v_intent public.redemption_intents;
  v_rule public.yield_rules;
  v_inv public.investments;
  v_pair uuid;
  v_ratio numeric;
  v_new_balance numeric;
  v_new_initial numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select * into v_intent from public.redemption_intents
    where id = p_intent_id and household_id = v_household;
  if not found then raise exception 'intent not found'; end if;
  if v_intent.status = 'executed' then raise exception 'intent already executed'; end if;

  select * into v_rule from public.yield_rules where id = v_intent.yield_rule_id;
  select * into v_inv from public.investments where id = v_rule.investment_id;

  -- Renda variável: o saque correto é via movement 'sell' (quantity-based)
  if v_inv.asset_type in ('fii', 'stock', 'etf', 'crypto') then
    raise exception 'Para % use Vender no menu do ativo (operação por quantidade de cotas).', v_inv.ticker;
  end if;

  -- Renda fixa: precisa ter saldo suficiente
  if coalesce(v_inv.current_balance, 0) < p_amount then
    raise exception 'Saldo do ativo (% ) menor que o valor solicitado (%).',
      v_inv.current_balance, p_amount;
  end if;

  -- Cria a transferência entre contas (debita caixa da corretora, credita destino)
  v_pair := public.create_transfer(
    v_inv.account_id,
    v_rule.destination_account_id,
    p_amount,
    current_date,
    'Saque · ' || v_inv.ticker
  );

  -- Debita o ATIVO. Ajusta initial_amount proporcionalmente pra preservar
  -- o "preço médio" (saldo / qty é o mesmo após o saque). IR regressivo
  -- usa o purchase_date original como referência.
  v_ratio := p_amount / v_inv.current_balance; -- fração que está saindo
  v_new_balance := round(v_inv.current_balance - p_amount, 2);
  v_new_initial := round(v_inv.initial_amount * (1 - v_ratio), 2);

  update public.investments
    set current_balance = v_new_balance,
        initial_amount = v_new_initial,
        last_yield_at = current_date,
        updated_at = now()
    where id = v_inv.id;

  -- Marca o intent como executado
  update public.redemption_intents
    set status = 'executed',
        executed_amount = p_amount,
        transfer_pair_id = v_pair,
        decided_at = now(),
        decided_by = v_user
    where id = p_intent_id;

  return v_pair;
end;
$$;

revoke all on function public.execute_redemption(uuid, numeric) from public;
grant execute on function public.execute_redemption(uuid, numeric) to authenticated;


-- ============================================================================
-- RPC add_to_fixed_income — aporta valor num ativo de renda fixa.
-- Soma ao current_balance + initial_amount, opcionalmente debita uma conta
-- (mesma lógica do auto-débito do cadastro de ativo).
-- ============================================================================
create or replace function public.add_to_fixed_income(
  p_investment_id uuid,
  p_amount numeric,
  p_date date,
  p_debit_account_id uuid default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_user uuid := auth.uid();
  v_inv public.investments;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select * into v_inv from public.investments
    where id = p_investment_id and household_id = v_household;
  if not found then raise exception 'investment not found'; end if;

  if v_inv.asset_type not in ('fixed_income_public', 'fixed_income_private') then
    raise exception 'Aporte direto só vale pra renda fixa. Use Novo aporte (movement) pra ativos de mercado.';
  end if;

  -- Atualiza saldo e custo
  update public.investments
    set current_balance = round(coalesce(current_balance, 0) + p_amount, 2),
        initial_amount = round(coalesce(initial_amount, 0) + p_amount, 2),
        updated_at = now()
    where id = p_investment_id;

  -- Se solicitado, debita conta de origem
  if p_debit_account_id is not null then
    insert into public.transactions
      (household_id, account_id, kind, amount, description, date, created_by,
       category_source, metadata)
    values
      (v_household, p_debit_account_id, 'expense', p_amount,
       coalesce(p_notes, 'Aporte · ' || v_inv.ticker),
       p_date, v_user, 'manual',
       jsonb_build_object('auto', true, 'investment_id', p_investment_id, 'kind', 'add_to_rf'));
  end if;
end;
$$;

revoke all on function public.add_to_fixed_income(uuid, numeric, date, uuid, text) from public;
grant execute on function public.add_to_fixed_income(uuid, numeric, date, uuid, text) to authenticated;
