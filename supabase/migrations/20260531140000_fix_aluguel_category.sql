-- ============================================================================
-- IR: aluguel recebido é TRIBUTÁVEL, não "Renda passiva" isenta (ROADMAP IR-2)
-- ============================================================================
-- A regra de seed 'aluguel receb' apontava pra categoria genérica "Renda
-- passiva", que o motor de IR tratava como isenta (dividendos cód. 09).
-- Aluguel de PF é tributável (carnê-leão). Aqui:
--   1) New users: a função de seed passa a criar/usar "Aluguel recebido".
--   2) Backfill: households existentes ganham a categoria e a regra é
--      repontada. NÃO recategorizamos transações já lançadas (respeita
--      overrides do usuário); o motor de IR agora as sinaliza via warning.

set search_path = public;

-- ----------------------------------------------------------------------------
-- 1) New users — seed self-contained: cria "Aluguel recebido" se faltar e
--    aponta a regra 'aluguel receb' pra ela (em vez de "Renda passiva").
-- ----------------------------------------------------------------------------
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
  c_aluguel uuid;
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

  -- Categoria de aluguel (separada da renda passiva genérica). Cria se faltar.
  select id into c_aluguel from categories where household_id = p_household_id and name = 'Aluguel recebido' limit 1;
  if c_aluguel is null then
    insert into categories (household_id, name, icon, kind, sort_order)
    values (p_household_id, 'Aluguel recebido', 'home', 'income', 25)
    returning id into c_aluguel;
  end if;

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
    ('aluguel receb', c_aluguel, 'income', 10),
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

-- ----------------------------------------------------------------------------
-- 2) Backfill households existentes — idempotente. Cria a categoria e repointa
--    a regra. NÃO toca transações (o motor de IR sinaliza via warning).
-- ----------------------------------------------------------------------------
do $$
declare
  h record;
  v_aluguel uuid;
begin
  for h in select id from households loop
    -- cria "Aluguel recebido" se não existir
    select id into v_aluguel from categories
      where household_id = h.id and name = 'Aluguel recebido' limit 1;
    if v_aluguel is null then
      insert into categories (household_id, name, icon, kind, sort_order)
      values (h.id, 'Aluguel recebido', 'home', 'income', 25)
      returning id into v_aluguel;
    end if;

    -- repointa a regra 'aluguel receb' que ainda aponte pra "Renda passiva"
    update category_rules cr
       set category_id = v_aluguel
     where cr.household_id = h.id
       and cr.pattern = 'aluguel receb'
       and cr.kind = 'income'
       and cr.category_id in (
         select id from categories
          where household_id = h.id and name = 'Renda passiva'
       );
  end loop;
end;
$$;
