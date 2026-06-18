-- ============================================================================
-- Painel Super-Admin — acesso SÓ a METADADOS (LGPD / E2EE).
--
-- O admin NUNCA lê dado financeiro nem chave: o ciphertext e os wraps continuam
-- inacessíveis. Estes RPCs são SECURITY DEFINER (owner = postgres, que tem
-- BYPASSRLS) e devolvem APENAS agregados/metadados de:
--   • auth.users            (e-mail, datas de cadastro/login/confirmação)
--   • auth.audit_log_entries(logs de acesso do Supabase Auth)
--   • public.vaults         (versão, updated_at, kdf — sem segredos)
--   • public.vault_blobs    (SÓ octet_length do ciphertext — volume, nunca o conteúdo)
--   • public.email_optin    (consentimento)
--   • public.app_events      (analytics próprio, eventos NÃO-sensíveis)
-- Toda função checa public.is_admin() ANTES de qualquer leitura.
--
-- Analytics próprio: tabela app_events, escrita SÓ pelo backend (/api/track via
-- service_role) com eventos não-identificáveis (anon_id pseudônimo, sem cookie,
-- sem dado financeiro, sem user_id). Leitura só por estes RPCs de admin.
-- ============================================================================

-- ── Quem é admin ────────────────────────────────────────────────────────────
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.admins force row level security;
revoke all on public.admins from anon, authenticated;  -- só via is_admin()/RPCs

-- Bootstrap: o dono entra como admin (idempotente; depende da conta já existir).
insert into public.admins (user_id)
select id from auth.users where email = 'marcelo.salgado.caliman@gmail.com'
on conflict (user_id) do nothing;

-- Caller é admin? SECURITY DEFINER → lê public.admins ignorando RLS. auth.uid()
-- vem do JWT da requisição (continua válido dentro de um definer).
create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ── Analytics próprio (eventos não-sensíveis) ───────────────────────────────
-- Sem user_id POR DESIGN: os eventos nunca são ligados a uma conta. anon_id é um
-- id aleatório de 1ª-parte (localStorage), pseudônimo, sem cookie e sem PII.
create table public.app_events (
  id         bigint generated always as identity primary key,
  surface    text not null,                       -- 'landing' | 'app'
  name       text not null,                       -- evento (allowlist no /api/track)
  anon_id    text,                                -- pseudônimo de 1ª-parte (sem cookie)
  path       text,
  lang       text,
  props      jsonb not null default '{}'::jsonb,  -- só metadados de UI (nunca financeiro)
  created_at timestamptz not null default now()
);
create index app_events_created_idx on public.app_events (created_at desc);
create index app_events_name_idx    on public.app_events (surface, name, created_at desc);
alter table public.app_events enable row level security;
alter table public.app_events force row level security;
-- Escrita só via service_role (/api/track, bypassa RLS); leitura só via RPC admin.
revoke all on public.app_events from anon, authenticated;

-- ── RPCs de admin (SECURITY DEFINER; sempre checam is_admin) ─────────────────

-- Visão geral: KPIs de usuários, atividade/churn, sync e opt-in.
create function public.admin_overview()
returns jsonb language plpgsql stable security definer
set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_users',            (select count(*) from auth.users),
    'confirmed_users',        (select count(*) from auth.users where email_confirmed_at is not null),
    'unconfirmed_users',      (select count(*) from auth.users where email_confirmed_at is null),
    'active_1d',              (select count(*) from auth.users where last_sign_in_at > now() - interval '1 day'),
    'active_7d',              (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active_30d',             (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'dormant_30d',            (select count(*) from auth.users where last_sign_in_at <= now() - interval '30 days'),
    'dormant_60d',            (select count(*) from auth.users where last_sign_in_at <= now() - interval '60 days'),
    'dormant_90d',            (select count(*) from auth.users where last_sign_in_at <= now() - interval '90 days'),
    'new_7d',                 (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_30d',                (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'vault_users',            (select count(*) from public.vaults),
    'synced_users',           (select count(*) from public.vault_blobs),
    'optin_count',            (select count(*) from public.email_optin),
    'admins_count',           (select count(*) from public.admins),
    'total_ciphertext_bytes', (select coalesce(sum(octet_length(ciphertext)), 0) from public.vault_blobs),
    'avg_ciphertext_bytes',   (select coalesce(round(avg(octet_length(ciphertext))), 0) from public.vault_blobs)
  ) into r;
  return r;
end $$;

-- Série diária de cadastros (preenchendo dias vazios via generate_series).
create function public.admin_signups_daily(p_days int default 30)
returns table(day date, signups bigint, confirmed bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  with days as (
    select generate_series(current_date - (greatest(p_days, 1) - 1), current_date, interval '1 day')::date as d
  )
  select days.d,
    (select count(*) from auth.users u where (u.created_at at time zone 'UTC')::date = days.d),
    (select count(*) from auth.users u where (u.created_at at time zone 'UTC')::date = days.d and u.email_confirmed_at is not null)
  from days
  order by days.d;
end $$;

-- Lista/busca de usuários (paginada). total_count repete em cada linha (janela total).
create function public.admin_users_list(
  p_search text default null, p_limit int default 50, p_offset int default 0, p_sort text default 'recent'
)
returns table(
  user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz,
  email_confirmed_at timestamptz, vault_version bigint, vault_updated_at timestamptz,
  ciphertext_bytes bigint, opted_in boolean, is_admin boolean, total_count bigint
) language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  with base as (
    select u.id, u.email::text as email, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
           v.vault_version, v.updated_at as vault_updated_at,
           octet_length(b.ciphertext)::bigint as ciphertext_bytes,
           (o.email is not null) as opted_in,
           (a.user_id is not null) as is_admin
    from auth.users u
    left join public.vaults v      on v.user_id = u.id
    left join public.vault_blobs b on b.user_id = u.id and b.shard = 'main'
    left join public.email_optin o on o.user_id = u.id
    left join public.admins a      on a.user_id = u.id
    where p_search is null or u.email ilike '%' || p_search || '%'
  )
  select base.id, base.email, base.created_at, base.last_sign_in_at, base.email_confirmed_at,
         base.vault_version, base.vault_updated_at, base.ciphertext_bytes, base.opted_in, base.is_admin,
         (select count(*) from base)::bigint as total_count
  from base
  order by
    (case when p_sort = 'active' then base.last_sign_in_at end) desc nulls last,
    (case when p_sort = 'email'  then base.email end) asc nulls last,
    base.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end $$;

-- Detalhe de um usuário (só metadados; nunca ciphertext).
create function public.admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'user_id', u.id, 'email', u.email,
    'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at,
    'vault_version', v.vault_version, 'vault_updated_at', v.updated_at,
    'kdf', v.kdf, 'kdf_params', v.kdf_params,
    'ciphertext_bytes', octet_length(b.ciphertext), 'blob_updated_at', b.updated_at,
    'opted_in', (o.email is not null), 'consent_at', o.consent_at, 'consent_text_version', o.consent_text_version,
    'is_admin', exists (select 1 from public.admins a where a.user_id = u.id)
  ) into r
  from auth.users u
  left join public.vaults v      on v.user_id = u.id
  left join public.vault_blobs b on b.user_id = u.id and b.shard = 'main'
  left join public.email_optin o on o.user_id = u.id
  where u.id = p_user_id;
  if r is null then raise exception 'user_not_found'; end if;
  return r;
end $$;

-- Logs de acesso (Supabase Auth): login, signup, recuperação, logout… com IP.
create function public.admin_audit_log(p_limit int default 50, p_offset int default 0)
returns table(id uuid, created_at timestamptz, action text, actor_email text, ip text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select e.id, e.created_at,
         (e.payload::jsonb ->> 'action')::text,
         (e.payload::jsonb ->> 'actor_username')::text,
         coalesce(e.ip_address::text, e.payload::jsonb ->> 'ip_address')
  from auth.audit_log_entries e
  order by e.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end $$;

-- Exclusão de conta (apagamento LGPD). Defesa em profundidade num caminho IRREVERSÍVEL:
-- além de is_admin() e da trava cannot_delete_admin, exige a CONFIRMAÇÃO do e-mail do alvo
-- (p_confirm_email tem que bater) — uma única chamada errada não apaga ninguém por engano.
create function public.admin_delete_user(p_user_id uuid, p_confirm_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.admins where user_id = p_user_id) then raise exception 'cannot_delete_admin'; end if;
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'user_not_found'; end if;
  if lower(coalesce(p_confirm_email, '')) <> lower(v_email) then raise exception 'confirm_mismatch'; end if;
  delete from public.email_optin where user_id = p_user_id or email = v_email;
  delete from auth.users where id = p_user_id;  -- cascade: vaults/blobs/vault_auth/admins
end $$;

-- Lista de administradores.
create function public.admin_admins_list()
returns table(user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select a.user_id, u.email::text, a.created_at
  from public.admins a join auth.users u on u.id = a.user_id
  order by a.created_at;
end $$;

-- Concede/retira admin por e-mail. Nunca deixa remover o último admin.
create function public.admin_set_role(p_email text, p_make_admin boolean)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then raise exception 'user_not_found'; end if;
  if p_make_admin then
    insert into public.admins(user_id) values (v_uid) on conflict (user_id) do nothing;
  else
    if (select count(*) from public.admins) <= 1 then raise exception 'cannot_remove_last_admin'; end if;
    delete from public.admins where user_id = v_uid;
  end if;
  return true;
end $$;

-- ── Analytics próprio — leituras agregadas ──────────────────────────────────
create function public.admin_analytics_overview(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_lv bigint; v_su bigint;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select count(*) into v_lv from public.app_events where name = 'landing_view' and created_at > now() - (greatest(p_days,1) || ' days')::interval;
  select count(*) into v_su from public.app_events where name = 'signup'       and created_at > now() - (greatest(p_days,1) || ' days')::interval;
  select jsonb_build_object(
    'events_total',    (select count(*) from public.app_events where created_at > now() - (greatest(p_days,1) || ' days')::interval),
    'landing_views',   v_lv,
    'unique_visitors', (select count(distinct anon_id) from public.app_events where surface = 'landing' and created_at > now() - (greatest(p_days,1) || ' days')::interval),
    'cta_clicks',      (select count(*) from public.app_events where name = 'cta_click' and created_at > now() - (greatest(p_days,1) || ' days')::interval),
    'signups',         v_su,
    'logins',          (select count(*) from public.app_events where name = 'login'    and created_at > now() - (greatest(p_days,1) || ' days')::interval),
    'app_opens',       (select count(*) from public.app_events where name = 'app_open' and created_at > now() - (greatest(p_days,1) || ' days')::interval),
    'conversion_pct',  (case when v_lv > 0 then round(100.0 * v_su / v_lv, 2) else 0 end)
  ) into r;
  return r;
end $$;

create function public.admin_events_daily(p_days int default 30)
returns table(day date, landing_views bigint, cta_clicks bigint, signups bigint, app_opens bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  with days as (
    select generate_series(current_date - (greatest(p_days, 1) - 1), current_date, interval '1 day')::date as d
  )
  select days.d,
    (select count(*) from public.app_events e where (e.created_at at time zone 'UTC')::date = days.d and e.name = 'landing_view'),
    (select count(*) from public.app_events e where (e.created_at at time zone 'UTC')::date = days.d and e.name = 'cta_click'),
    (select count(*) from public.app_events e where (e.created_at at time zone 'UTC')::date = days.d and e.name = 'signup'),
    (select count(*) from public.app_events e where (e.created_at at time zone 'UTC')::date = days.d and e.name = 'app_open')
  from days
  order by days.d;
end $$;

create function public.admin_top_events(p_days int default 30)
returns table(surface text, name text, count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select e.surface, e.name, count(*)::bigint
  from public.app_events e
  where e.created_at > now() - (greatest(p_days, 1) || ' days')::interval
  group by e.surface, e.name
  order by count(*) desc
  limit 50;
end $$;

-- ── Grants (a guarda is_admin é a segurança real; o grant só abre a porta) ────
revoke all on function public.admin_overview()                              from public;
revoke all on function public.admin_signups_daily(int)                      from public;
revoke all on function public.admin_users_list(text, int, int, text)        from public;
revoke all on function public.admin_user_detail(uuid)                       from public;
revoke all on function public.admin_audit_log(int, int)                     from public;
revoke all on function public.admin_delete_user(uuid, text)                 from public;
revoke all on function public.admin_admins_list()                          from public;
revoke all on function public.admin_set_role(text, boolean)                from public;
revoke all on function public.admin_analytics_overview(int)                from public;
revoke all on function public.admin_events_daily(int)                      from public;
revoke all on function public.admin_top_events(int)                        from public;

grant execute on function public.admin_overview()                            to authenticated;
grant execute on function public.admin_signups_daily(int)                    to authenticated;
grant execute on function public.admin_users_list(text, int, int, text)      to authenticated;
grant execute on function public.admin_user_detail(uuid)                     to authenticated;
grant execute on function public.admin_audit_log(int, int)                   to authenticated;
grant execute on function public.admin_delete_user(uuid, text)               to authenticated;
grant execute on function public.admin_admins_list()                        to authenticated;
grant execute on function public.admin_set_role(text, boolean)               to authenticated;
grant execute on function public.admin_analytics_overview(int)               to authenticated;
grant execute on function public.admin_events_daily(int)                     to authenticated;
grant execute on function public.admin_top_events(int)                       to authenticated;
