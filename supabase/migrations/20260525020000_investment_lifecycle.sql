-- ============================================================================
-- Finanças — ciclo de vida do investimento (liquidado/vencido) + ponte caixa
--
-- Antes: só tinha is_active (bool). Arquivado vs vendido vs vencido tudo igual.
-- Agora:
--   closed_at            → quando o ativo encerrou
--   closed_reason        → 'sold' | 'matured' | 'archived'
--   gross_proceeds       → valor bruto recebido na venda/vencimento
--   ir_withheld_on_close → IR retido na fonte (renda fixa pública/privada)
--   proceeds_account_id  → conta que recebeu o caixa (opcional)
--   proceeds_tx_id       → transaction (kind=income) criada como ponte (opcional)
--
-- is_active vira espelho: closed_at IS NULL → ativo; senão inativo. UI e
-- queries continuam usando is_active; novos campos adicionam semântica.
-- ============================================================================

set search_path = public;

alter table public.investments
  add column if not exists closed_at date,
  add column if not exists closed_reason text,
  add column if not exists gross_proceeds_on_close numeric(14, 2),
  add column if not exists ir_withheld_on_close numeric(14, 2),
  add column if not exists proceeds_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists proceeds_tx_id uuid references public.transactions(id) on delete set null;

-- Constraint do reason
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'investments_closed_reason_check'
  ) then
    alter table public.investments
      add constraint investments_closed_reason_check
      check (closed_reason is null or closed_reason in ('sold', 'matured', 'archived'));
  end if;
end$$;

-- Coerência: se closed_at preenchido, closed_reason obrigatório
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'investments_closed_pair_check'
  ) then
    alter table public.investments
      add constraint investments_closed_pair_check
      check (
        (closed_at is null and closed_reason is null)
        or (closed_at is not null and closed_reason is not null)
      );
  end if;
end$$;

comment on column public.investments.closed_at is
  'Data em que o ativo deixou de existir na carteira (venda, vencimento ou arquivamento). NULL = ainda ativo.';
comment on column public.investments.closed_reason is
  'sold = vendido antes do vencimento; matured = chegou ao vencimento natural; archived = encerrado manualmente sem venda formal.';
comment on column public.investments.gross_proceeds_on_close is
  'Valor BRUTO recebido na liquidação (antes do IR retido). Usado pra cálculo de ganho de capital no IR.';
comment on column public.investments.ir_withheld_on_close is
  'IR retido na fonte na liquidação (renda fixa pública/privada). Vai pro informe da fonte pagadora no IR/N+1.';
comment on column public.investments.proceeds_account_id is
  'Conta que recebeu o caixa da liquidação. Opcional. Se preenchido, há entry em transactions vinculada.';
comment on column public.investments.proceeds_tx_id is
  'Transaction (kind=income) que registra a entrada de caixa da liquidação. Auto-criada quando proceeds_account_id é informado.';

-- Index pra listar liquidados por período (aba "Liquidados em {ano}")
create index if not exists investments_closed_at_idx
  on public.investments (household_id, closed_at desc)
  where closed_at is not null;

-- ============================================================================
-- RPC liquidate_investment: atomicidade entre 4 escritas
--   1) insert movement kind='sell'
--   2) (opt) insert transaction (kind=income) na proceeds_account
--   3) update investment: is_active=false, closed_at, closed_reason='sold',
--      gross_proceeds_on_close, ir_withheld_on_close, proceeds_account_id,
--      proceeds_tx_id
--   4) (opt) update accounts.current_balance += líquido
-- ============================================================================
create or replace function public.liquidate_investment(
  p_investment_id uuid,
  p_date date,
  p_gross_proceeds numeric,
  p_ir_withheld numeric default 0,
  p_destination_account_id uuid default null,
  p_reason text default 'sold',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_qty numeric;
  v_unit_price numeric;
  v_movement_id uuid;
  v_tx_id uuid := null;
  v_net numeric;
  v_creator uuid;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found then
    raise exception 'Investment não encontrado: %', p_investment_id;
  end if;
  if v_inv.closed_at is not null then
    raise exception 'Investment já liquidado em %', v_inv.closed_at;
  end if;
  if p_reason not in ('sold', 'matured', 'archived') then
    raise exception 'closed_reason inválido: %', p_reason;
  end if;
  if p_gross_proceeds < 0 then
    raise exception 'gross_proceeds não pode ser negativo';
  end if;

  -- Auth fallback: tenta user atual; se RPC chamado fora de sessão (ex.: cron,
  -- script de migração), pega qualquer user ativo do household.
  v_creator := coalesce(
    auth.uid(),
    (select id from public.users where household_id = v_inv.household_id and is_active limit 1)
  );

  v_qty := coalesce(v_inv.quantity, 1);
  v_unit_price := case when v_qty > 0 then p_gross_proceeds / v_qty else p_gross_proceeds end;
  v_net := p_gross_proceeds - coalesce(p_ir_withheld, 0);

  -- 1) Movement sell — registra a venda
  insert into public.investment_movements (
    household_id, investment_id, kind, date, quantity, unit_price, fees, notes, created_by
  ) values (
    v_inv.household_id, p_investment_id, 'sell', p_date,
    v_qty, v_unit_price, 0,
    coalesce(p_notes, 'Liquidação automática'), v_creator
  )
  returning id into v_movement_id;

  -- 2) Transaction de entrada de caixa (se conta destino informada)
  if p_destination_account_id is not null then
    insert into public.transactions (
      household_id, account_id, kind, amount, amount_account, currency,
      description, date, created_by, category_source, metadata
    ) values (
      v_inv.household_id, p_destination_account_id, 'income',
      v_net, v_net, v_inv.currency,
      'Liquidação ' || v_inv.ticker || ' (líquido após IR)',
      p_date, v_creator, 'manual',
      jsonb_build_object('investment_id', p_investment_id, 'kind', 'investment_liquidation')
    )
    returning id into v_tx_id;

    -- Atualiza saldo da conta destino
    update public.accounts
      set current_balance = current_balance + v_net
      where id = p_destination_account_id;
  end if;

  -- 3) Marca o investment como liquidado
  update public.investments
    set is_active = false,
        closed_at = p_date,
        closed_reason = p_reason,
        gross_proceeds_on_close = p_gross_proceeds,
        ir_withheld_on_close = coalesce(p_ir_withheld, 0),
        proceeds_account_id = p_destination_account_id,
        proceeds_tx_id = v_tx_id,
        current_balance = 0
    where id = p_investment_id;

  return v_movement_id;
end;
$$;

revoke all on function public.liquidate_investment(uuid, date, numeric, numeric, uuid, text, text) from public;
grant execute on function public.liquidate_investment(uuid, date, numeric, numeric, uuid, text, text) to authenticated;

-- ============================================================================
-- RPC reopen_investment: reverte a liquidação (apaga movement, tx, zera campos)
-- Útil pra correção de erro de digitação na liquidação.
-- ============================================================================
create or replace function public.reopen_investment(
  p_investment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found then
    raise exception 'Investment não encontrado';
  end if;
  if v_inv.closed_at is null then
    return;
  end if;

  -- Reverter saldo da conta destino (se houve)
  if v_inv.proceeds_account_id is not null and v_inv.proceeds_tx_id is not null then
    update public.accounts
      set current_balance = current_balance - (
        coalesce(v_inv.gross_proceeds_on_close, 0) - coalesce(v_inv.ir_withheld_on_close, 0)
      )
      where id = v_inv.proceeds_account_id;
    delete from public.transactions where id = v_inv.proceeds_tx_id;
  end if;

  -- Apagar a última movement sell criada na liquidação
  delete from public.investment_movements
    where investment_id = p_investment_id
      and kind = 'sell'
      and date = v_inv.closed_at
      and notes ilike 'Liquidação%';

  -- Reabrir
  update public.investments
    set is_active = true,
        closed_at = null,
        closed_reason = null,
        gross_proceeds_on_close = null,
        ir_withheld_on_close = null,
        proceeds_account_id = null,
        proceeds_tx_id = null,
        current_balance = coalesce(initial_amount, 0)
    where id = p_investment_id;
end;
$$;

revoke all on function public.reopen_investment(uuid) from public;
grant execute on function public.reopen_investment(uuid) to authenticated;
