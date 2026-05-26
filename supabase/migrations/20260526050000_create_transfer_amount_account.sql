-- ============================================================================
-- Finanças — Fix crítico: create_transfer não setava amount_account
--
-- BUG: A RPC create_transfer inseria transactions sem amount_account, então
-- o default 0 era usado. O trigger tg_apply_transaction_to_balance lê
-- amount_account pra calcular o delta — com amount_account=0, transferências
-- NÃO atualizam saldo das contas. Bug silencioso: o registro existe, mas
-- o saldo não muda.
--
-- Afeta:
--   - Transferências criadas pelo dialog (createTransaction action)
--   - Transferências materializadas de recorrências
--   - Auto-sync de pagamento de fatura de cartão
--
-- FIX:
--   1) Atualiza create_transfer pra setar amount_account = p_amount.
--      Assume mesma moeda nas duas contas (caso comum BR).
--   2) Backfill: existing transfers com amount_account = 0 viram amount_account
--      = amount. Não toca balance_applied_at (preserva estado de aplicação).
-- ============================================================================

set search_path = public;

create or replace function public.create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text default null
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

  v_desc := coalesce(nullif(trim(p_description), ''), 'Transferência');

  -- ✅ FIX: agora seta amount_account explicitamente.
  -- Assume mesma moeda em ambas as contas (típico BR). Multi-currency
  -- exigiria conversão e mudança de signature (não suportado por ora).
  insert into public.transactions
    (household_id, account_id, kind, amount, amount_account, currency, description,
     date, created_by, transfer_pair_id, transfer_direction)
  values
    (v_household, p_from_account_id, 'transfer', p_amount, p_amount, v_from.currency,
     v_desc || ' → ' || v_to.name, p_date, v_user, v_pair, 'out');

  insert into public.transactions
    (household_id, account_id, kind, amount, amount_account, currency, description,
     date, created_by, transfer_pair_id, transfer_direction)
  values
    (v_household, p_to_account_id, 'transfer', p_amount, p_amount, v_to.currency,
     v_desc || ' ← ' || v_from.name, p_date, v_user, v_pair, 'in');

  return v_pair;
end;
$$;

revoke all on function public.create_transfer(uuid, uuid, numeric, date, text) from public;
grant execute on function public.create_transfer(uuid, uuid, numeric, date, text) to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- Backfill: transfers existentes com amount_account = 0 → amount_account = amount.
--
-- Importante: NÃO toca balance_applied_at. Isso significa:
--   - Transfers futuras (não aplicadas): quando forem aplicadas (cron ou
--     materialize_recurrence), o trigger usará amount_account correto. ✓
--   - Transfers já aplicadas com amount_account=0: balance está stale
--     (não recebeu o delta correto). Manual fix se quiser corrigir o saldo
--     retroativamente — preferi não tocar pra evitar risco em households
--     que tenham outros tipos de divergência.
-- ────────────────────────────────────────────────────────────────────────────
update public.transactions
set amount_account = amount
where kind = 'transfer'
  and amount_account = 0
  and amount > 0;
