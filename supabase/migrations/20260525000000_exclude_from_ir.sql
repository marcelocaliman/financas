-- ============================================================================
-- Finanças — Flag pra excluir bem específico da declaração IRPF
--
-- Caso de uso: user tem bem físico que não quer declarar (ex.: bicicleta de
-- pouco valor, joias herdadas mantidas em segredo, etc). App continua sendo
-- útil pra controle pessoal mas o bem sai dos reports IR.
--
-- Default false (declarável). User marca explicitamente pra excluir.
-- ============================================================================

set search_path = public;

alter table public.accounts          add column if not exists exclude_from_ir boolean not null default false;
alter table public.investments       add column if not exists exclude_from_ir boolean not null default false;
alter table public.physical_assets   add column if not exists exclude_from_ir boolean not null default false;
alter table public.debts             add column if not exists exclude_from_ir boolean not null default false;

comment on column public.physical_assets.exclude_from_ir is
  'Quando true, o bem não aparece em reports do IRPF (Bens e Direitos). Útil pra coisas que o user mantém só pra controle pessoal mas não quer declarar.';
