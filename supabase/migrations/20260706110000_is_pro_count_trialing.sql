-- is_pro() passa a contar status 'trialing' (assinatura Stripe em período de teste)
-- como Pro, além do trial NOSSO (trial_ends_at), do ativo, e do cancelado-mas-no-período.
-- Corrige o caso em que o checkout firmava a assinatura como 'trialing' mas is_pro()
-- (que só olhava 'active') devolvia false → "contratado" na tela mas sem virar Pro.
create or replace function public.is_pro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.pro_subscriptions s
    where s.user_id = auth.uid()
      and ( s.status in ('active','trialing')
         or (s.trial_ends_at is not null and s.trial_ends_at > now())
         or (s.status = 'canceled' and s.current_period_end is not null and s.current_period_end > now()) )
  );
$$;
