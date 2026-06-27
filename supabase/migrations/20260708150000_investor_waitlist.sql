-- Lista de espera do Pro Investidor. Enquanto a flag quotes_live está OFF, o card na landing
-- mostra "Em breve" e capta o email de quem quer ser avisado. É o SINAL DE DEMANDA (quantos
-- querem) + a lista pra notificar quando o plano for ligado — quebra o galinha-e-ovo (vê a
-- demanda ANTES de pagar brapi/Finnhub). Texto claro (NÃO é o cofre E2EE): é uma lista de contato
-- com consentimento, como email_optin/tickets. Email único (dedupe por PK).
--
-- Escrita SÓ pelo serverless /api/waitlist (service_role); leitura SÓ pelo RPC admin abaixo.
-- RLS force + revoke: anon/authenticated não tocam.
create table if not exists public.investor_waitlist (
  email      text primary key,
  lang       text,
  created_at timestamptz not null default now()
);
alter table public.investor_waitlist enable row level security;
alter table public.investor_waitlist force row level security;
revoke all on public.investor_waitlist from anon, authenticated;

-- Lista/contagem pro painel super-admin (contador de demanda + emails pra notificar). SECURITY
-- DEFINER (owner postgres = BYPASSRLS) + guarda is_admin(), igual aos demais RPCs de admin.
create or replace function public.admin_investor_waitlist()
returns table(email text, lang text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select w.email, w.lang, w.created_at from public.investor_waitlist w order by w.created_at desc;
end $$;
revoke all on function public.admin_investor_waitlist() from public;
grant execute on function public.admin_investor_waitlist() to authenticated;
