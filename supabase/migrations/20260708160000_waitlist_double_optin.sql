-- Double opt-in da lista de espera: o email só CONTA como demanda depois de CONFIRMADO pelo link
-- enviado por email. Protege contra inscrever email de terceiros (spoof) e é o padrão LGPD/GDPR de
-- consentimento. `confirmed_at` null = pendente; `confirm_token` = segredo do link de confirmação.
alter table public.investor_waitlist
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirm_token text;

-- O RPC admin passa a expor confirmed_at — o contador de demanda real = confirmados.
drop function if exists public.admin_investor_waitlist();
create function public.admin_investor_waitlist()
returns table(email text, lang text, created_at timestamptz, confirmed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select w.email, w.lang, w.created_at, w.confirmed_at from public.investor_waitlist w order by w.created_at desc;
end $$;
revoke all on function public.admin_investor_waitlist() from public;
grant execute on function public.admin_investor_waitlist() to authenticated;
