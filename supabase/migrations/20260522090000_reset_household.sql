-- ============================================================================
-- Finanças — RPC para zerar todos os dados do household
-- ============================================================================
-- Apaga tudo exceto users + households. Re-seed das categorias padrão pra
-- deixar o lar como recém-criado. Operação irreversível; UI exige
-- confirmação por digitação.
-- ============================================================================

set search_path = public;

create or replace function public.reset_household_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
begin
  if v_household is null then
    raise exception 'no household';
  end if;

  -- Ordem importa por causa de foreign keys (alguns têm CASCADE, outros não)
  delete from public.redemption_intents where household_id = v_household;
  delete from public.yield_rules where household_id = v_household;
  delete from public.investment_movements where household_id = v_household;
  delete from public.investment_yields where household_id = v_household;
  delete from public.investments where household_id = v_household;
  delete from public.transactions where household_id = v_household;
  delete from public.physical_assets where household_id = v_household;
  delete from public.goals where household_id = v_household;
  delete from public.accounts where household_id = v_household;
  delete from public.categories where household_id = v_household;

  -- Re-seed das categorias padrão (mesmas 15 do bootstrap)
  perform public.seed_default_categories(v_household);
end;
$$;

revoke all on function public.reset_household_data() from public;
grant execute on function public.reset_household_data() to authenticated;
