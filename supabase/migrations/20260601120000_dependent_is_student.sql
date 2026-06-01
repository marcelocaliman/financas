-- ============================================================================
-- Dependente estudante (regra de idade do IRPF).
-- ============================================================================
-- Filho/enteado é dependente até 21 anos, OU até 24 se cursando ensino superior
-- ou escola técnica. O flag is_student habilita a faixa 21–24 e alimenta a
-- validação do checklist (antes a idade nunca era conferida).

alter table public.ir_dependents
  add column if not exists is_student boolean not null default false;
