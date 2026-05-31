-- ============================================================================
-- Billing: idempotência de webhooks + colunas de estado (ROADMAP Billing)
-- ============================================================================
-- O Stripe não garante ordem nem entrega única (at-least-once). Esta tabela
-- registra cada evento processado pra o handler ser idempotente. Colunas de
-- billing já existem em households (subscription_*/stripe_*); adicionamos só o
-- que falta pra dunning e cancelamento agendado.

set search_path = public;

create table if not exists public.stripe_webhook_events (
  id            text primary key,           -- event.id do Stripe
  type          text not null,
  processed_at  timestamptz not null default now(),
  -- guarda o objeto mínimo pra auditoria/replay (sem PII de cartão)
  payload_summary jsonb
);

comment on table public.stripe_webhook_events is
  'Eventos de webhook do Stripe já processados — garante idempotência (o mesmo '
  'event.id nunca é aplicado duas vezes).';

-- Escrito só pelo handler (service-role). RLS nega acesso direto.
alter table public.stripe_webhook_events enable row level security;

-- Colunas de billing que faltavam:
alter table public.households
  -- Cancelamento agendado pro fim do período (Stripe cancel_at_period_end).
  add column if not exists subscription_cancel_at timestamptz,
  -- Desde quando está past_due (pra o cron de dunning medir o grace).
  add column if not exists past_due_since timestamptz,
  -- Marca override manual (ex.: lifetime comp) — o cron de dunning ignora.
  add column if not exists subscription_manual_override boolean not null default false;

comment on column public.households.subscription_manual_override is
  'Quando true, o tier foi concedido manualmente (admin/lifetime) e o cron de '
  'dunning/expiração NÃO mexe nele.';
