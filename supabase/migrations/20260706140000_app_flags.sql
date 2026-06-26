-- Feature flags controláveis pelo SUPER-ADMIN (sem deploy). Hoje: 'quotes_live'
-- (liga a cotação ao vivo PAGA pros assinantes do Pro Investidor). Padrão OFF =
-- comportamento atual (cotação só no admin, brapi free 4×/dia).
create table if not exists public.app_flags (
  key        text primary key,
  enabled    boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
alter table public.app_flags force row level security;
-- Ninguém lê/escreve direto; só via funções SECURITY DEFINER abaixo (service_role bypassa RLS).
revoke all on public.app_flags from anon, authenticated;

insert into public.app_flags (key, enabled) values ('quotes_live', false)
  on conflict (key) do nothing;

-- Lê uma flag (metadado público; qualquer autenticado pode checar).
create or replace function public.flag_on(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.app_flags where key = p_key), false);
$$;
grant execute on function public.flag_on(text) to authenticated;

-- Alterna uma flag — SÓ super-admin.
create or replace function public.set_flag(p_key text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.app_flags (key, enabled, updated_at) values (p_key, p_enabled, now())
    on conflict (key) do update set enabled = excluded.enabled, updated_at = now();
  return p_enabled;
end $$;
grant execute on function public.set_flag(text, boolean) to authenticated;

-- Quem pode receber COTAÇÃO AO VIVO: admin SEMPRE (brapi free, uso pessoal); assinante do
-- Pro Investidor só quando a flag 'quotes_live' estiver ON (= dono já assinou o brapi pago).
create or replace function public.can_live_quotes()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.flag_on('quotes_live') and exists (
      select 1 from public.pro_subscriptions s
      where s.user_id = auth.uid()
        and s.plan in ('investor_monthly','investor_annual')
        and ( s.status in ('active','trialing')
           or (s.trial_ends_at is not null and s.trial_ends_at > now())
           or (s.status = 'canceled' and s.cancel_at_period_end is true
               and s.current_period_end is not null and s.current_period_end > now()) )
    )
  );
$$;
grant execute on function public.can_live_quotes() to authenticated;
