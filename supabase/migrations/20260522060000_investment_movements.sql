-- ============================================================================
-- Finanças — Lotes de investimento (extrato por ativo)
-- ============================================================================
-- investment_movements: source de verdade. Cada compra/venda/provento é um lote.
-- investments.quantity e investments.initial_amount são DERIVADAS via trigger.
-- Preço médio = initial_amount / quantity (calculado on-the-fly na UI).
--
-- Modelo de custo: ÁVERAGE COST (custo médio). Quando vende, remove proporcional
-- do custo. Não é FIFO/LIFO — modelo equivalente ao usado pela maioria dos
-- brasileiros pra apuração de IR em ações.
-- ============================================================================

set search_path = public;

-- Adiciona quantity em investments (denormalizado, atualizado por trigger)
alter table public.investments
  add column quantity numeric(18, 8) default null;


-- ============================================================================
-- investment_movements
-- ============================================================================
create table public.investment_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  kind text not null check (kind in ('buy', 'sell', 'dividend', 'split')),
  date date not null,
  quantity numeric(18, 8) not null check (quantity > 0),
  unit_price numeric(14, 4) not null check (unit_price >= 0),
  total_amount numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  fees numeric(14, 2) not null default 0 check (fees >= 0),
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index investment_movements_investment_idx
  on public.investment_movements(investment_id, date desc);
create index investment_movements_household_idx
  on public.investment_movements(household_id, date desc);

alter table public.investment_movements enable row level security;

create policy "movements: full access within household"
  on public.investment_movements for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- ============================================================================
-- Trigger: recalcula investments.{quantity, initial_amount} a partir
-- dos movimentos. Custo médio ponderado: cada VENDA remove o custo
-- proporcional baseado no preço médio na hora da venda.
-- ============================================================================
create or replace function public.tg_recompute_investment_aggregates()
returns trigger
language plpgsql
as $$
declare
  v_id uuid;
  v_total_qty numeric(18, 8) := 0;
  v_total_cost numeric(14, 2) := 0;
  v_row record;
begin
  v_id := coalesce(new.investment_id, old.investment_id);

  -- Iterar movimentos em ordem cronológica (date, created_at)
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
      -- Remove custo proporcional (preço médio × qty vendida)
      if v_total_qty > 0 then
        v_total_cost := v_total_cost - (v_total_cost / v_total_qty) * v_row.quantity;
      end if;
      v_total_qty := v_total_qty - v_row.quantity;
    end if;
    -- 'dividend' e 'split' não afetam quantity/cost diretamente (split TODO futuro)
  end loop;

  update public.investments
  set quantity = v_total_qty,
      initial_amount = greatest(0, round(v_total_cost, 2)),
      updated_at = now()
  where id = v_id;

  return new;
end;
$$;

create trigger investment_movements_recompute
  after insert or update or delete on public.investment_movements
  for each row execute function public.tg_recompute_investment_aggregates();


-- ============================================================================
-- RPC add_movement — facilita inserção do client (preenche household + user)
-- ============================================================================
create or replace function public.add_investment_movement(
  p_investment_id uuid,
  p_kind text,
  p_date date,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_user uuid := auth.uid();
  v_id uuid;
  v_inv public.investments;
begin
  if v_household is null then raise exception 'no household'; end if;
  if p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if p_unit_price < 0 then raise exception 'unit_price must be >= 0'; end if;

  select * into v_inv from public.investments
    where id = p_investment_id and household_id = v_household;
  if not found then raise exception 'investment not found'; end if;

  -- Pra sell, validar que há quantidade suficiente
  if p_kind = 'sell' then
    if coalesce(v_inv.quantity, 0) < p_quantity then
      raise exception 'insufficient quantity (have %, trying to sell %)',
        coalesce(v_inv.quantity, 0), p_quantity;
    end if;
  end if;

  insert into public.investment_movements
    (household_id, investment_id, kind, date, quantity, unit_price, fees, notes, created_by)
  values
    (v_household, p_investment_id, p_kind, p_date, p_quantity, p_unit_price,
     coalesce(p_fees, 0), p_notes, v_user)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_investment_movement(uuid, text, date, numeric, numeric, numeric, text) from public;
grant execute on function public.add_investment_movement(uuid, text, date, numeric, numeric, numeric, text) to authenticated;


-- Realtime
alter publication supabase_realtime add table public.investment_movements;
