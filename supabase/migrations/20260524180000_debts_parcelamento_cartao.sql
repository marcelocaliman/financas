-- ============================================================================
-- Finanças — Tipo "Parcelamento no cartão" pra dívidas
-- Separa parcelamento (juros baixos/zero, prazo definido) de rotativo
-- (juros 300%+ a.a.) que estavam no mesmo bucket antes.
-- ============================================================================

set search_path = public;

alter table public.debts
  drop constraint if exists debts_kind_check;

alter table public.debts
  add constraint debts_kind_check check (kind in (
    'financiamento_imovel',
    'financiamento_veiculo',
    'emprestimo_pessoal',
    'emprestimo_cheque_especial',
    'emprestimo_cartao_credito',
    'parcelamento_cartao',
    'emprestimo_pj',
    'emprestimo_pessoa_fisica',
    'outros'
  ));
