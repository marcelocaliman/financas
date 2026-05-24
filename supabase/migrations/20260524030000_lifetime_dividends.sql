-- ============================================================================
-- Finanças — Dividendos no rendimento acumulado
-- ============================================================================
-- Antes, lançar um movimento 'dividend' não somava no "rendimento acumulado"
-- do ativo — só caía no caixa via transaction. O usuário esperava ver o
-- dividendo refletido como rendimento.
--
-- Agora: investments.lifetime_dividends_received guarda o total de proventos
-- recebidos (somatório de total_amount dos movimentos 'dividend'), e o cálculo
-- de rendimento em renda variável passa a ser:
--     accumulated_yield = (derived_balance - initial_amount) + lifetime_dividends
--
-- Renda fixa não tem dividendos — fica igual.
-- ============================================================================

set search_path = public;

-- 1) Nova coluna
alter table public.investments
  add column lifetime_dividends_received numeric(14, 2) not null default 0;

comment on column public.investments.lifetime_dividends_received is
  'Soma de total_amount dos investment_movements kind=dividend. Mantido pelo trigger tg_recompute_investment_aggregates.';

-- 2) Trigger atualizado — agora também soma proventos
create or replace function public.tg_recompute_investment_aggregates()
returns trigger
language plpgsql
as $$
declare
  v_id uuid;
  v_total_qty numeric(18, 8) := 0;
  v_total_cost numeric(14, 2) := 0;
  v_total_dividends numeric(14, 2) := 0;
  v_row record;
begin
  v_id := coalesce(new.investment_id, old.investment_id);

  for v_row in
    select kind, quantity, unit_price, fees, total_amount
      from public.investment_movements
      where investment_id = v_id
      order by date asc, created_at asc
  loop
    if v_row.kind = 'buy' then
      v_total_qty := v_total_qty + v_row.quantity;
      v_total_cost := v_total_cost + v_row.total_amount + coalesce(v_row.fees, 0);
    elsif v_row.kind = 'sell' then
      if v_total_qty > 0 then
        v_total_cost := v_total_cost - (v_total_cost / v_total_qty) * v_row.quantity;
      end if;
      v_total_qty := v_total_qty - v_row.quantity;
    elsif v_row.kind = 'dividend' then
      -- Provento: total_amount = qty * unit_price = caixa recebido
      v_total_dividends := v_total_dividends + coalesce(v_row.total_amount, 0);
    end if;
    -- 'split' ainda não afeta nada (TODO futuro)
  end loop;

  update public.investments
  set quantity = v_total_qty,
      initial_amount = greatest(0, round(v_total_cost, 2)),
      lifetime_dividends_received = round(v_total_dividends, 2),
      updated_at = now()
  where id = v_id;

  return new;
end;
$$;

-- 3) Backfill: força recálculo de todos os investments existentes que já
-- tenham movimentos dividend. Re-executa o trigger via UPDATE no-op em
-- um movimento qualquer de cada ativo.
do $$
declare
  r record;
begin
  for r in
    select distinct investment_id
      from public.investment_movements
      where kind = 'dividend'
  loop
    update public.investments
    set lifetime_dividends_received = (
      select coalesce(sum(total_amount), 0)
        from public.investment_movements
        where investment_id = r.investment_id
          and kind = 'dividend'
    )
    where id = r.investment_id;
  end loop;
end $$;
