-- ============================================================================
-- Finanças — Seeds default pra novos usuários
--
-- Quando um usuário cria conta (bootstrap_household), além de categorias,
-- agora ele recebe:
--   - ~40 regras de categorização universais brasileiras
--   - Preferências de notificação razoáveis
--   - Preferências FIRE com defaults sensatos
--
-- Tudo idempotente (ON CONFLICT DO NOTHING / WHERE NOT EXISTS) — não
-- sobrescreve dados de usuários existentes.
-- ============================================================================

set search_path = public;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Regras de categorização (universais BR)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.seed_default_category_rules(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_mercado uuid;
  c_restaurantes uuid;
  c_delivery uuid;
  c_transporte uuid;
  c_saude uuid;
  c_cuidado uuid;
  c_lazer uuid;
  c_assinaturas uuid;
  c_educacao uuid;
  c_moradia uuid;
  c_contas uuid;
  c_salario uuid;
  c_renda_passiva uuid;
  c_outras_receitas uuid;
begin
  -- Mapeia categorias por nome (já criadas via seed_default_categories)
  select id into c_mercado from categories where household_id = p_household_id and name = 'Mercado' limit 1;
  select id into c_restaurantes from categories where household_id = p_household_id and name = 'Restaurantes' limit 1;
  select id into c_delivery from categories where household_id = p_household_id and name = 'Delivery' limit 1;
  select id into c_transporte from categories where household_id = p_household_id and name = 'Transporte' limit 1;
  select id into c_saude from categories where household_id = p_household_id and name = 'Saúde' limit 1;
  select id into c_cuidado from categories where household_id = p_household_id and name = 'Cuidado pessoal' limit 1;
  select id into c_lazer from categories where household_id = p_household_id and name = 'Lazer' limit 1;
  select id into c_assinaturas from categories where household_id = p_household_id and name = 'Assinaturas' limit 1;
  select id into c_educacao from categories where household_id = p_household_id and name = 'Educação' limit 1;
  select id into c_moradia from categories where household_id = p_household_id and name = 'Moradia' limit 1;
  select id into c_contas from categories where household_id = p_household_id and name = 'Contas' limit 1;
  select id into c_salario from categories where household_id = p_household_id and name = 'Salário' limit 1;
  select id into c_renda_passiva from categories where household_id = p_household_id and name = 'Renda passiva' limit 1;
  select id into c_outras_receitas from categories where household_id = p_household_id and name = 'Outras receitas' limit 1;

  -- Insere ~40 regras universais brasileiras. ON CONFLICT DO NOTHING não
  -- aplica aqui (sem unique constraint relevante), mas usamos WHERE NOT
  -- EXISTS pra idempotência.
  insert into category_rules (household_id, pattern, category_id, kind, priority)
  select p_household_id, x.pattern, x.cat, x.kind, x.priority
  from (values
    -- Delivery
    ('ifood',         c_delivery, 'expense', 10),
    ('rappi',         c_delivery, 'expense', 10),
    ('ubereats',      c_delivery, 'expense', 10),
    ('james',         c_delivery, 'expense', 10),
    -- Mercado
    ('carrefour',     c_mercado, 'expense', 10),
    ('atacadao',      c_mercado, 'expense', 10),
    ('assai',         c_mercado, 'expense', 10),
    ('pao de acucar', c_mercado, 'expense', 10),
    ('extra',         c_mercado, 'expense', 10),
    ('mercadolivre',  c_mercado, 'expense', 10),
    ('zona sul',      c_mercado, 'expense', 10),
    ('mercado',       c_mercado, 'expense', 0),
    -- Transporte
    ('uber',          c_transporte, 'expense', 10),
    ('uberrides',     c_transporte, 'expense', 10),
    ('99pop',         c_transporte, 'expense', 10),
    ('posto',         c_transporte, 'expense', 5),
    ('ipiranga',      c_transporte, 'expense', 10),
    ('shell',         c_transporte, 'expense', 10),
    ('br ',           c_transporte, 'expense', 10),
    -- Saúde
    ('drogasil',      c_saude, 'expense', 10),
    ('drogaraia',     c_saude, 'expense', 10),
    ('panvel',        c_saude, 'expense', 10),
    ('amil',          c_saude, 'expense', 10),
    ('unimed',        c_saude, 'expense', 10),
    ('bradesco saude',c_saude, 'expense', 10),
    ('hapvida',       c_saude, 'expense', 10),
    ('drogaria',      c_saude, 'expense', 5),
    -- Restaurantes
    ('outback',       c_restaurantes, 'expense', 10),
    ('mcdonalds',     c_restaurantes, 'expense', 10),
    ('starbucks',     c_restaurantes, 'expense', 10),
    ('restaurante',   c_restaurantes, 'expense', 0),
    -- Lazer / viagem
    ('cinema',        c_lazer, 'expense', 10),
    ('airbnb',        c_lazer, 'expense', 10),
    ('booking',       c_lazer, 'expense', 10),
    ('latam',         c_lazer, 'expense', 10),
    ('gol linhas',    c_lazer, 'expense', 10),
    -- Assinaturas
    ('netflix',       c_assinaturas, 'expense', 10),
    ('spotify',       c_assinaturas, 'expense', 10),
    ('disney',        c_assinaturas, 'expense', 10),
    ('amazon prime',  c_assinaturas, 'expense', 10),
    ('hbo',           c_assinaturas, 'expense', 10),
    ('claude',        c_assinaturas, 'expense', 10),
    ('chatgpt',       c_assinaturas, 'expense', 10),
    ('github',        c_assinaturas, 'expense', 10),
    -- Moradia / contas
    ('sabesp',        c_moradia, 'expense', 10),
    ('cedae',         c_moradia, 'expense', 10),
    ('enel',          c_moradia, 'expense', 10),
    ('light',         c_moradia, 'expense', 10),
    ('cemig',         c_moradia, 'expense', 10),
    ('comgas',        c_moradia, 'expense', 10),
    ('aluguel',       c_moradia, 'expense', 5),
    ('vivo',          c_contas, 'expense', 10),
    ('claro',         c_contas, 'expense', 10),
    ('tim',           c_contas, 'expense', 10),
    -- Receitas
    ('salário',       c_salario, 'income', 5),
    ('salario',       c_salario, 'income', 5),
    ('dividendo',     c_renda_passiva, 'income', 10),
    ('jcp',           c_renda_passiva, 'income', 10),
    ('aluguel receb', c_renda_passiva, 'income', 10),
    ('estorno',       c_outras_receitas, 'income', 5),
    ('cashback',      c_outras_receitas, 'income', 5)
  ) as x(pattern, cat, kind, priority)
  where x.cat is not null
    and not exists (
      select 1 from category_rules
      where household_id = p_household_id and pattern = x.pattern and kind = x.kind
    );
end;
$$;

revoke all on function public.seed_default_category_rules(uuid) from public;
grant execute on function public.seed_default_category_rules(uuid) to authenticated, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 2) Notification preferences default
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.seed_default_notification_prefs(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Tabela notification_preferences pode não existir ainda em todos os
  -- ambientes — só popula se existir.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'notification_preferences'
  ) then
    insert into notification_preferences (user_id, channel_email, channel_push, weekly_digest, monthly_recap)
    values (p_user_id, true, false, true, true)
    on conflict (user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.seed_default_notification_prefs(uuid) from public;
grant execute on function public.seed_default_notification_prefs(uuid) to authenticated, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 3) Atualiza bootstrap_household pra chamar todos os seeds em sequência
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.bootstrap_household(
  p_household_name text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'must be authenticated';
  end if;

  select household_id into v_household_id from public.users where id = v_user_id;
  if found then
    return v_household_id;
  end if;

  insert into public.households (name)
  values (coalesce(nullif(trim(p_household_name), ''), 'Nosso lar'))
  returning id into v_household_id;

  insert into public.users (id, household_id, display_name, role)
  values (v_user_id, v_household_id, coalesce(nullif(trim(p_display_name), ''), 'Sem nome'), 'admin');

  -- Seeds essenciais: categorias + regras de categorização + prefs
  perform public.seed_default_categories(v_household_id);
  perform public.seed_default_category_rules(v_household_id);
  perform public.seed_default_notification_prefs(v_user_id);

  return v_household_id;
end;
$$;

revoke all on function public.bootstrap_household(text, text) from public;
grant execute on function public.bootstrap_household(text, text) to authenticated;
