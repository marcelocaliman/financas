-- ============================================================================
-- "Último acesso" por usuário (retenção real no admin) — METADADO, não dado financeiro.
--
-- Problema: o app reabre SEM re-login (sessão persistente), então last_sign_in_at fica
-- velho — quem entra todo dia mas nunca desloga parecia "dormante". Logo, os baldes de
-- atividade/dormência do admin estavam ENGANANDO. Aqui registramos um carimbo por usuário
-- a cada abertura autenticada e corrigimos os RPCs pra usar o acesso REAL.
--
-- É só um timestamp (quando, nunca o quê) — coerente com a regra "admin só vê metadado".
-- Tabela sem acesso direto (RLS forçada + revoke); só os definers escrevem/leem.
-- ============================================================================

create table public.user_last_seen (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.user_last_seen enable row level security;
alter table public.user_last_seen force row level security;
revoke all on public.user_last_seen from anon, authenticated;  -- só via mark_seen()/RPCs de admin

-- O usuário carimba o PRÓPRIO "último acesso" (uma vez por sessão, no boot autenticado).
create function public.mark_seen()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;  -- sem sessão: no-op
  insert into public.user_last_seen (user_id, last_seen_at, updated_at)
  values (v_uid, now(), now())
  on conflict (user_id) do update set last_seen_at = now(), updated_at = now();
end $$;
revoke all on function public.mark_seen() from public;
grant execute on function public.mark_seen() to authenticated;

-- Seed: baseline dos usuários ATUAIS (maior entre cadastro e último login) — é prospectivo,
-- mas dá um ponto de partida em vez de "nunca acessou".
insert into public.user_last_seen (user_id, last_seen_at)
select u.id, greatest(u.created_at, coalesce(u.last_sign_in_at, u.created_at))
from auth.users u
on conflict (user_id) do nothing;

-- ── Corrige os RPCs do admin pra usar o acesso REAL ─────────────────────────────
-- Acesso efetivo = o mais recente entre o carimbo (user_last_seen) e o último login.

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer
set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  with la as (
    select u.id,
           greatest(coalesce(s.last_seen_at, u.created_at), coalesce(u.last_sign_in_at, u.created_at)) as seen
    from auth.users u
    left join public.user_last_seen s on s.user_id = u.id
  )
  select jsonb_build_object(
    'total_users',            (select count(*) from auth.users),
    'confirmed_users',        (select count(*) from auth.users where email_confirmed_at is not null),
    'unconfirmed_users',      (select count(*) from auth.users where email_confirmed_at is null),
    'active_1d',              (select count(*) from la where seen > now() - interval '1 day'),
    'active_7d',              (select count(*) from la where seen > now() - interval '7 days'),
    'active_30d',             (select count(*) from la where seen > now() - interval '30 days'),
    'dormant_30d',            (select count(*) from la where seen <= now() - interval '30 days'),
    'dormant_60d',            (select count(*) from la where seen <= now() - interval '60 days'),
    'dormant_90d',            (select count(*) from la where seen <= now() - interval '90 days'),
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

-- admin_users_list muda de assinatura (nova coluna) → drop + create.
drop function if exists public.admin_users_list(text, int, int, text);
create function public.admin_users_list(
  p_search text default null, p_limit int default 50, p_offset int default 0, p_sort text default 'recent'
)
returns table(
  user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, last_seen_at timestamptz,
  email_confirmed_at timestamptz, vault_version bigint, vault_updated_at timestamptz,
  ciphertext_bytes bigint, opted_in boolean, is_admin boolean, total_count bigint
) language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  with base as (
    select u.id, u.email::text as email, u.created_at, u.last_sign_in_at,
           greatest(coalesce(s.last_seen_at, u.created_at), coalesce(u.last_sign_in_at, u.created_at)) as last_seen_at,
           u.email_confirmed_at,
           v.vault_version, v.updated_at as vault_updated_at,
           octet_length(b.ciphertext)::bigint as ciphertext_bytes,
           (o.email is not null) as opted_in,
           (a.user_id is not null) as is_admin
    from auth.users u
    left join public.user_last_seen s on s.user_id = u.id
    left join public.vaults v        on v.user_id = u.id
    left join public.vault_blobs b   on b.user_id = u.id and b.shard = 'main'
    left join public.email_optin o   on o.user_id = u.id
    left join public.admins a        on a.user_id = u.id
    where p_search is null or u.email ilike '%' || p_search || '%'
  )
  select base.id, base.email, base.created_at, base.last_sign_in_at, base.last_seen_at, base.email_confirmed_at,
         base.vault_version, base.vault_updated_at, base.ciphertext_bytes, base.opted_in, base.is_admin,
         (select count(*) from base)::bigint as total_count
  from base
  order by
    (case when p_sort = 'active' then base.last_seen_at end) desc nulls last,
    (case when p_sort = 'email'  then base.email end) asc nulls last,
    base.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end $$;
revoke all on function public.admin_users_list(text, int, int, text) from public;
grant execute on function public.admin_users_list(text, int, int, text) to authenticated;

create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'user_id', u.id, 'email', u.email,
    'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'last_seen_at', greatest(coalesce(s.last_seen_at, u.created_at), coalesce(u.last_sign_in_at, u.created_at)),
    'email_confirmed_at', u.email_confirmed_at,
    'vault_version', v.vault_version, 'vault_updated_at', v.updated_at,
    'kdf', v.kdf, 'kdf_params', v.kdf_params,
    'ciphertext_bytes', octet_length(b.ciphertext), 'blob_updated_at', b.updated_at,
    'opted_in', (o.email is not null), 'consent_at', o.consent_at, 'consent_text_version', o.consent_text_version,
    'is_admin', exists (select 1 from public.admins a where a.user_id = u.id)
  ) into r
  from auth.users u
  left join public.user_last_seen s on s.user_id = u.id
  left join public.vaults v        on v.user_id = u.id
  left join public.vault_blobs b   on b.user_id = u.id and b.shard = 'main'
  left join public.email_optin o   on o.user_id = u.id
  where u.id = p_user_id;
  if r is null then raise exception 'user_not_found'; end if;
  return r;
end $$;
