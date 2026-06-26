-- ============================================================================
-- Assinatura Pro (freemium) — entitlement por METADADO (E2EE intacto).
--
-- Espelha o padrão de public.admins/is_admin(): a fonte de verdade do gate é a
-- função is_pro() SECURITY DEFINER. NENHUM dado financeiro aqui — só o estado da
-- assinatura (status, datas, ids do Stripe). A ESCRITA vem do webhook do Stripe
-- (service_role, /api/stripe-webhook) e da concessão de trial (start_trial).
-- O dono pode LER só a própria linha (mostrar status/trial na UI).
-- ============================================================================

create table public.pro_subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  status                 text not null default 'trialing'
                           check (status in ('trialing','active','past_due','canceled','incomplete')),
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  price_id               text,
  plan                   text,                              -- 'monthly' | 'annual' | 'founder'
  trial_started          boolean not null default false,   -- trava anti re-trial
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index pro_sub_customer_idx     on public.pro_subscriptions (stripe_customer_id)     where stripe_customer_id is not null;
create unique index pro_sub_subscription_idx on public.pro_subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.pro_subscriptions enable row level security;
alter table public.pro_subscriptions force row level security;
revoke all on public.pro_subscriptions from anon, authenticated;  -- escrita só via service_role/RPC
-- Dono lê SÓ a própria linha (status do plano na UI). Sem insert/update/delete p/ authenticated.
create policy pro_sub_select_own on public.pro_subscriptions
  for select to authenticated using (user_id = auth.uid());
grant select on public.pro_subscriptions to authenticated;

-- Caller é Pro? Admin é sempre Pro (dogfooding). Senão: assinatura ativa, OU dentro
-- do trial, OU cancelada mas ainda no período pago. SECURITY DEFINER → auth.uid() do JWT.
create function public.is_pro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.pro_subscriptions s
    where s.user_id = auth.uid()
      and ( s.status = 'active'
         or (s.trial_ends_at is not null and s.trial_ends_at > now())
         or (s.status = 'canceled' and s.current_period_end is not null and s.current_period_end > now()) )
  );
$$;
revoke all on function public.is_pro() from public;
grant execute on function public.is_pro() to authenticated;

-- Concede o trial de 14 dias — UMA vez por conta (trava trial_started anti re-trial).
-- Não rebaixa quem já é active/canceled. Retorna a linha resultante.
create function public.start_trial()
returns public.pro_subscriptions language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row public.pro_subscriptions;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_row from public.pro_subscriptions where user_id = v_uid;
  if v_row.user_id is null then
    insert into public.pro_subscriptions (user_id, status, trial_ends_at, trial_started)
      values (v_uid, 'trialing', now() + interval '14 days', true)
      returning * into v_row;
  elsif not v_row.trial_started then
    update public.pro_subscriptions
      set trial_ends_at = now() + interval '14 days', trial_started = true,
          status = case when status in ('active','canceled') then status else 'trialing' end,
          updated_at = now()
      where user_id = v_uid returning * into v_row;
  end if;  -- se já usou o trial, retorna a linha como está (sem novo trial)
  return v_row;
end $$;
revoke all on function public.start_trial() from public;
grant execute on function public.start_trial() to authenticated;
