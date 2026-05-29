-- ============================================================================
-- Finanças — Mais 6 categorias de despesa (Viagem, Vestuário, Pets,
-- Presentes, Impostos, Investimento)
--
-- Motivação: o seed original cobre 13 despesas que pegam ~85% dos casos
-- comuns, mas deixa buracos perceptíveis. Viagem em particular vinha sendo
-- relatado: sem categoria dedicada, passagens/hospedagem ficavam em "Lazer"
-- ou "Outros gastos" e perdiam visibilidade.
--
-- Granularidade fina ("Passagem aérea", "Hospedagem" separados) é
-- propositalmente evitada porque:
--   1. A página /viagens já divide gastos por categoria interna
--      (Passagem, Hospedagem, Comida, etc.) via trip_budget_items quando
--      a tx é vinculada a uma viagem cadastrada.
--   2. Pra gastos avulsos, uma categoria "Viagem" + descrição livre
--      ("Aéreo SP-RJ", "Hotel Lumen") é mais usável que dezenas de
--      sub-categorias no select.
-- ============================================================================

set search_path = public;

-- ============================================================================
-- 1) Atualiza seed_default_categories pra incluir os 6 novos pra futuros
--    usuários. sort_order escolhido pra agrupar com famílias existentes:
--      270 Viagem        (depois de Assinaturas 250)
--      280 Vestuário
--      290 Pets
--      300 Presentes
--      310 Impostos
--      320 Investimento
--      990 Outros gastos (mantém último)
-- ============================================================================
create or replace function public.seed_default_categories(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (household_id, name, icon, kind, sort_order) values
    -- Receitas
    (p_household_id, 'Salário',           'briefcase',     'income',  10),
    (p_household_id, 'Renda passiva',     'sparkles',      'income',  20),
    (p_household_id, 'Outras receitas',   'plus-circle',   'income',  30),
    -- Despesas essenciais
    (p_household_id, 'Mercado',           'shopping-cart', 'expense', 110),
    (p_household_id, 'Moradia',           'home',          'expense', 120),
    (p_household_id, 'Contas',            'receipt',       'expense', 130),
    (p_household_id, 'Transporte',        'car',           'expense', 140),
    (p_household_id, 'Saúde',             'heart-pulse',   'expense', 150),
    (p_household_id, 'Educação',          'book-open',     'expense', 160),
    -- Despesas variáveis
    (p_household_id, 'Delivery',          'utensils',      'expense', 210),
    (p_household_id, 'Restaurantes',      'forks',         'expense', 220),
    (p_household_id, 'Lazer',             'music',         'expense', 230),
    (p_household_id, 'Cuidado pessoal',   'scissors',      'expense', 240),
    (p_household_id, 'Assinaturas',       'rotate-ccw',    'expense', 250),
    (p_household_id, 'Pagamento de dívidas', 'hand-coins', 'expense', 260),
    -- Novas (29/05/2026)
    (p_household_id, 'Viagem',            'plane',         'expense', 270),
    (p_household_id, 'Vestuário',         'shirt',         'expense', 280),
    (p_household_id, 'Pets',              'paw-print',     'expense', 290),
    (p_household_id, 'Presentes',         'gift',          'expense', 300),
    (p_household_id, 'Impostos',          'landmark',      'expense', 310),
    (p_household_id, 'Investimento',      'trending-up',   'expense', 320),
    -- Catch-all
    (p_household_id, 'Outros gastos',     'circle',        'expense', 990);
end;
$$;

-- ============================================================================
-- 2) Backfill — adiciona as 6 novas em households existentes que ainda não
--    tenham (idempotente, pula se já existir uma categoria com mesmo nome).
-- ============================================================================
do $$
declare
  v_household record;
  v_new_cats text[][] := array[
    array['Viagem',       'plane',       '270'],
    array['Vestuário',    'shirt',       '280'],
    array['Pets',         'paw-print',   '290'],
    array['Presentes',    'gift',        '300'],
    array['Impostos',     'landmark',    '310'],
    array['Investimento', 'trending-up', '320']
  ];
  v_cat text[];
begin
  for v_household in (select id from public.households) loop
    foreach v_cat slice 1 in array v_new_cats loop
      insert into public.categories (household_id, name, icon, kind, sort_order)
      select v_household.id, v_cat[1], v_cat[2], 'expense', v_cat[3]::int
      where not exists (
        select 1 from public.categories
        where household_id = v_household.id and name = v_cat[1]
      );
    end loop;
  end loop;
end;
$$;
