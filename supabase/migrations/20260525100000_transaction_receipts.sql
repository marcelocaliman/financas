-- ============================================================================
-- Finanças — Comprovantes em transactions (PDF/foto do recibo)
--
-- Adiciona campos pra anexar comprovante a qualquer transaction (não só
-- ir_deductible_payments). Útil pra IR (saúde, educação) e pra controle
-- de gastos em geral.
--
-- Storage: reusa bucket existente "ir-receipts" (path: tx/{tx_id}/{file}).
-- ============================================================================

set search_path = public;

alter table public.transactions
  add column if not exists receipt_storage_path text,
  add column if not exists receipt_mime_type text,
  add column if not exists receipt_size_bytes bigint,
  add column if not exists receipt_uploaded_at timestamptz;

comment on column public.transactions.receipt_storage_path is
  'Path no bucket ir-receipts (formato tx/{tx_id}/{file}). Anexo de PDF/imagem '
  'do comprovante da transação. Útil pra IR, garantia, devolução.';
