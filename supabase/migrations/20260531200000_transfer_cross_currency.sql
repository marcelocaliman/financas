-- ============================================================================
-- FIN: transferência cross-currency não corrompe mais saldo (ROADMAP FIN, D12)
-- ============================================================================
-- BUG: create_transfer creditava o destino com o MESMO número da origem, mesmo
-- em moedas diferentes (BRL R$1.000 → conta USD virava +1.000 USD). Corrompia
-- o saldo silenciosamente.
--
-- FIX (D12): o usuário informa o valor RECEBIDO na conta destino (p_amount_to).
--   - Mesma moeda: p_amount_to default = p_amount (comportamento atual, ok).
--   - Moedas diferentes: p_amount_to obrigatório; sem ele, BLOQUEIA (raise) em
--     vez de corromper. Nunca mais credita número de moeda errada.

set search_path = public;

-- Remove a assinatura antiga (5 args) pra não conviver com a nova (overload).
drop function if exists public.create_transfer(uuid, uuid, numeric, date, text);

create or replace function public.create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text default null,
  p_amount_to numeric default null   -- valor recebido na conta destino
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_user uuid := auth.uid();
  v_pair uuid := gen_random_uuid();
  v_from public.accounts;
  v_to   public.accounts;
  v_desc text;
  v_amount_to numeric;
begin
  if v_household is null then
    raise exception 'no household for user';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'from and to accounts must differ';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select * into v_from from public.accounts
    where id = p_from_account_id and household_id = v_household;
  if not found then
    raise exception 'invalid source account';
  end if;

  select * into v_to from public.accounts
    where id = p_to_account_id and household_id = v_household;
  if not found then
    raise exception 'invalid destination account';
  end if;

  -- Valor no destino: mesma moeda usa o mesmo número; moeda diferente EXIGE
  -- o valor informado (nunca converte às cegas nem credita moeda errada).
  if v_from.currency = v_to.currency then
    v_amount_to := p_amount;
  elsif p_amount_to is not null and p_amount_to > 0 then
    v_amount_to := p_amount_to;
  else
    raise exception
      'Transferência entre moedas diferentes (% → %) exige o valor recebido no destino.',
      v_from.currency, v_to.currency;
  end if;

  v_desc := coalesce(nullif(trim(p_description), ''), 'Transferência');

  -- Perna de SAÍDA — moeda/valor da conta origem.
  insert into public.transactions
    (household_id, account_id, kind, amount, amount_account, currency, description,
     date, created_by, transfer_pair_id, transfer_direction)
  values
    (v_household, p_from_account_id, 'transfer', p_amount, p_amount, v_from.currency,
     v_desc || ' → ' || v_to.name, p_date, v_user, v_pair, 'out');

  -- Perna de ENTRADA — moeda/valor da conta destino (convertido/informado).
  insert into public.transactions
    (household_id, account_id, kind, amount, amount_account, currency, description,
     date, created_by, transfer_pair_id, transfer_direction)
  values
    (v_household, p_to_account_id, 'transfer', v_amount_to, v_amount_to, v_to.currency,
     v_desc || ' ← ' || v_from.name, p_date, v_user, v_pair, 'in');

  return v_pair;
end;
$$;

revoke all on function public.create_transfer(uuid, uuid, numeric, date, text, numeric) from public;
grant execute on function public.create_transfer(uuid, uuid, numeric, date, text, numeric) to authenticated;
