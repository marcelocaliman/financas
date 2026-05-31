-- ============================================================================
-- Auth: auto-cura do bootstrap (conta órfã nunca mais) — ROADMAP AUTH
-- ============================================================================
-- Risco: se o bootstrap_household chamado pela app falhar, o usuário fica com
-- auth.users mas sem public.users/household → loop /dashboard↔/login. Este
-- trigger AFTER INSERT em auth.users cria o lar como FALLBACK definitivo.
--
-- De quebra, conserta um BUG pré-existente: seed_default_notification_prefs
-- inseria em notification_preferences(user_id, ...) mas a tabela é keyed por
-- household_id — a função sempre falhava (e derrubava o bootstrap).

set search_path = public;

-- 1) Conserta o seed de preferências de notificação (household-keyed).
create or replace function public.seed_default_notification_prefs(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.users where id = p_user_id;
  if v_household is null then
    return;
  end if;
  -- Booleans têm default no schema; só garantimos a linha do household.
  insert into public.notification_preferences (household_id)
  values (v_household)
  on conflict (household_id) do nothing;
end;
$$;

-- 2) Trigger de auto-cura. NUNCA aborta o signup; idempotente; só modo
--    create/orphan ('join'/'accountant' seguem o fluxo da app). Cada seed roda
--    em sub-bloco pra que uma falha de seed não desfaça o lar/perfil.
create or replace function public.tg_auth_user_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode    text := new.raw_user_meta_data->>'signup_mode';
  v_display text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Sem nome'
  );
  v_hh_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'household_name'), ''), 'Nosso lar');
  v_household uuid;
begin
  if exists (select 1 from public.users where id = new.id) then
    return new;  -- app já bootstrapou
  end if;
  if v_mode in ('join', 'accountant') then
    return new;  -- fluxo próprio na app
  end if;

  insert into public.households (name) values (v_hh_name) returning id into v_household;
  insert into public.users (id, household_id, display_name, role)
    values (new.id, v_household, v_display, 'admin');

  begin perform public.seed_default_categories(v_household); exception when others then null; end;
  begin perform public.seed_default_category_rules(v_household); exception when others then null; end;
  begin perform public.seed_default_notification_prefs(new.id); exception when others then null; end;

  return new;
exception
  when others then
    return new;  -- jamais quebra o signup
end;
$$;

comment on function public.tg_auth_user_bootstrap is
  'Fallback de bootstrap: cria lar+perfil no INSERT de auth.users se a app não '
  'tiver feito. Idempotente, never-abort, só modo create/orphan.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_auth_user_bootstrap();
