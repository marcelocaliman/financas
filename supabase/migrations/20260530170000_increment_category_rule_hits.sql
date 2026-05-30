-- ============================================================================
-- increment_category_rule_hits: contador de aplicações de regra (analytics)
-- ============================================================================
-- Bug (auditoria, automacao#2): matchCategoryRule fazia update({ hits: 0 }) a
-- cada match — ZERAVA o contador em vez de somar +1. A coluna "Aplicações" na
-- UI ficava sempre 0. Esta função faz o incremento atômico.
-- ============================================================================
create or replace function public.increment_category_rule_hits(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.category_rules
  set hits = coalesce(hits, 0) + 1
  where id = p_id;
$$;

revoke all on function public.increment_category_rule_hits(uuid) from public;
grant execute on function public.increment_category_rule_hits(uuid) to authenticated;
