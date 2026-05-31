-- ============================================================================
-- RLS causa-raiz: account_id sempre pertence ao MESMO household da linha
-- (ROADMAP RLS). A RLS de transactions/investments checa household_id =
-- current_household_id(), mas a FK de account_id só garante existência — uma
-- linha podia, em tese, referenciar uma conta de outro household. Aqui um
-- trigger garante a invariante no banco (defense-in-depth, independente da app).
-- ============================================================================

set search_path = public;

-- Aborta a migration se já houver inconsistência (auditado: 0 hoje).
do $$
declare v_bad integer;
begin
  select count(*) into v_bad from public.transactions t
    join public.accounts a on a.id = t.account_id
   where a.household_id <> t.household_id;
  if v_bad > 0 then
    raise exception 'Abortando: % transação(ões) com conta de outro household. Corrija antes.', v_bad;
  end if;
  select count(*) into v_bad from public.investments i
    join public.accounts a on a.id = i.account_id
   where a.household_id <> i.household_id;
  if v_bad > 0 then
    raise exception 'Abortando: % investimento(s) com conta de outro household.', v_bad;
  end if;
end $$;

create or replace function public.tg_assert_account_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acct_household uuid;
begin
  if new.account_id is null then
    return new;
  end if;
  select household_id into v_acct_household
    from public.accounts where id = new.account_id;
  if v_acct_household is null then
    raise exception 'Conta % inexistente', new.account_id;
  end if;
  if v_acct_household <> new.household_id then
    raise exception 'Conta % pertence a outro household (% ≠ %)',
      new.account_id, v_acct_household, new.household_id;
  end if;
  return new;
end;
$$;

comment on function public.tg_assert_account_household is
  'Garante que account_id da linha pertence ao mesmo household_id. Invariante '
  'de tenancy aplicada no banco (transactions, investments).';

drop trigger if exists transactions_assert_account_household on public.transactions;
create trigger transactions_assert_account_household
  before insert or update of account_id, household_id on public.transactions
  for each row execute function public.tg_assert_account_household();

drop trigger if exists investments_assert_account_household on public.investments;
create trigger investments_assert_account_household
  before insert or update of account_id, household_id on public.investments
  for each row execute function public.tg_assert_account_household();
