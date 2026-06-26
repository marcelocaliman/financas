-- Tier "Pro Investidor" (cotação ao vivo) — ESTRUTURA pronta, DESLIGADA por ora.
-- is_investor() = admin OU assinatura ativa de um plano 'investor_*'. Hoje retorna o
-- mesmo que is_admin() (ninguém tem plano investor ainda). Quando o brapi PAGO entrar,
-- a guarda da cotação (api/quote.js + use-quotes-sync + patrimonio) passa a usar isto.
create or replace function public.is_investor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.pro_subscriptions s
    where s.user_id = auth.uid()
      and s.plan in ('investor_monthly','investor_annual')
      and ( s.status in ('active','trialing')
         or (s.trial_ends_at is not null and s.trial_ends_at > now())
         or (s.status = 'canceled' and s.cancel_at_period_end is true
             and s.current_period_end is not null and s.current_period_end > now()) )
  );
$$;
grant execute on function public.is_investor() to authenticated;
