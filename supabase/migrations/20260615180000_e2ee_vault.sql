-- ============================================================================
-- Fase 0b — Backend do cofre E2EE.
-- O servidor só guarda CIPHERTEXT + metadados de KDF/embrulho. NUNCA vê texto
-- claro nem a chave. RLS isola cada usuário; a escrita do blob só passa por um
-- RPC com compare-and-swap (anti lost-update) + PROVA DE POSSE DA DEK (impede que
-- uma sessão sem a chave — ex.: login obtido só por reset de e-mail — destrua o
-- cofre). Incorpora os fixes da revisão adversarial de segurança.
-- ============================================================================

-- ── Tabelas ─────────────────────────────────────────────────────────────────
create table public.vaults (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  kdf                     text   not null default 'argon2id',
  kdf_params              jsonb  not null,
  salt                    bytea  not null,
  salt_recovery           bytea  not null,
  wrapped_dek_pw          bytea  not null,
  wrapped_dek_pw_iv       bytea  not null,
  wrapped_dek_recovery    bytea  not null,
  wrapped_dek_recovery_iv bytea  not null,
  iv_counter              bigint not null default 0,
  vault_version           bigint not null default 0,
  updated_at              timestamptz not null default now()
);

create table public.vault_blobs (
  user_id       uuid   not null references auth.users(id) on delete cascade,
  shard         text   not null default 'main',
  vault_version bigint not null,
  ciphertext    bytea  not null,
  iv            bytea  not null,
  updated_at    timestamptz not null default now(),
  primary key (user_id, shard)
);

-- Prova de posse da DEK (HMAC derivado da DEK). Tabela SEPARADA e SEM política de
-- leitura → nem o dono lê pela API; só os RPCs (SECURITY DEFINER) acessam. Uma
-- sessão sem a DEK não lê nem recomputa o tag → não consegue sobrescrever o cofre.
create table public.vault_auth (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  auth_tag   bytea not null,
  created_at timestamptz not null default now()
);

-- Convites (signup fechado). Guarda só o HASH do código (nunca o código em claro).
create table public.invites (
  code_hash  text primary key,
  label      text,
  used       boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Opt-in de e-mail — SEPARADA do dado financeiro, mas com user_id pra erasure LGPD.
create table public.email_optin (
  email                text primary key,
  user_id              uuid references auth.users(id) on delete cascade,
  consent_at           timestamptz not null default now(),
  consent_text_version text
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.vaults      enable row level security;  alter table public.vaults      force row level security;
alter table public.vault_blobs enable row level security;  alter table public.vault_blobs force row level security;
alter table public.vault_auth  enable row level security;  alter table public.vault_auth  force row level security;
alter table public.invites     enable row level security;  alter table public.invites     force row level security;
alter table public.email_optin enable row level security;  alter table public.email_optin force row level security;

-- Leitura própria (PULL/unlock). vaults também permite INSERT próprio (criação
-- inicial do cofre). Atualização de versão/wraps só via RPC.
create policy vaults_select_own on public.vaults      for select using (auth.uid() = user_id);
create policy vaults_insert_own on public.vaults      for insert with check (auth.uid() = user_id);
create policy blobs_select_own  on public.vault_blobs for select using (auth.uid() = user_id);
create policy optin_own         on public.email_optin for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- vault_auth e invites: SEM política → ninguém (anon/authenticated) acessa direto.

-- Escrita direta proibida (só via RPC). vaults: update/delete bloqueados (insert
-- liberado pela policy acima). vault_blobs/vault_auth/invites: tudo bloqueado.
revoke update, delete         on public.vaults      from anon, authenticated;
revoke insert, update, delete on public.vault_blobs from anon, authenticated;
revoke all                    on public.vault_auth  from anon, authenticated;
revoke all                    on public.invites     from anon, authenticated;

-- ── RPCs (SECURITY DEFINER; sempre checam auth.uid()) ───────────────────────

-- Planta a prova de posse da DEK UMA vez (na criação do cofre). on conflict do
-- nothing → uma sessão sem a DEK não consegue plantar a própria prova depois.
create function public.set_vault_auth(p_auth_tag bytea)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  insert into public.vault_auth(user_id, auth_tag) values (v_uid, p_auth_tag)
  on conflict (user_id) do nothing;
  return found;
end $$;

-- Push do blob: prova de posse + compare-and-swap na versão + upsert atômico
-- (bumpa vaults e grava vault_blobs na MESMA transação → sem split-brain).
create function public.push_vault(
  p_expected_version bigint, p_ciphertext bytea, p_iv bytea,
  p_auth_tag bytea, p_shard text default 'main'
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_stored bytea; v_new bigint;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select auth_tag into v_stored from public.vault_auth where user_id = v_uid;
  if v_stored is null or v_stored <> p_auth_tag then raise exception 'dek_proof_failed'; end if;
  update public.vaults
     set vault_version = vault_version + 1, iv_counter = iv_counter + 1, updated_at = now()
   where user_id = v_uid and vault_version = p_expected_version
   returning vault_version into v_new;
  if v_new is null then raise exception 'version_conflict'; end if;
  insert into public.vault_blobs(user_id, shard, vault_version, ciphertext, iv, updated_at)
       values (v_uid, p_shard, v_new, p_ciphertext, p_iv, now())
  on conflict (user_id, shard) do update
     set vault_version = excluded.vault_version, ciphertext = excluded.ciphertext,
         iv = excluded.iv, updated_at = now();
  return v_new;
end $$;

-- Troca de senha: atualiza salt + wrapped_dek_pw atômico (o cliente já fez o
-- self-test antes de chamar). Não recifra o cofre (DEK não muda).
create function public.rewrap_password(p_salt bytea, p_kdf_params jsonb, p_wrapped bytea, p_iv bytea)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  update public.vaults set salt = p_salt, kdf_params = p_kdf_params,
         wrapped_dek_pw = p_wrapped, wrapped_dek_pw_iv = p_iv, updated_at = now()
   where user_id = v_uid;
  if not found then raise exception 'vault_not_found'; end if;
end $$;

-- Rotação do código de recuperação.
create function public.rewrap_recovery(p_salt_recovery bytea, p_wrapped bytea, p_iv bytea)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  update public.vaults set salt_recovery = p_salt_recovery,
         wrapped_dek_recovery = p_wrapped, wrapped_dek_recovery_iv = p_iv, updated_at = now()
   where user_id = v_uid;
  if not found then raise exception 'vault_not_found'; end if;
end $$;

-- Exclusão de conta (a UI exige re-auth antes). Apaga o próprio usuário; o cascade
-- leva vault/blobs/vault_auth. Também remove o opt-in de e-mail (erasure LGPD).
create function public.delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select email into v_email from auth.users where id = v_uid;
  delete from public.email_optin where user_id = v_uid or (v_email is not null and email = v_email);
  delete from auth.users where id = v_uid;
end $$;

-- Convite (signup fechado): consome atômico (single-use, expiry). Recebe o HASH.
create function public.redeem_invite(p_code_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  update public.invites set used = true
   where code_hash = p_code_hash and used = false
     and (expires_at is null or expires_at > now())
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

-- Grants de execução
revoke all on function public.set_vault_auth(bytea)                          from public;
revoke all on function public.push_vault(bigint, bytea, bytea, bytea, text)  from public;
revoke all on function public.rewrap_password(bytea, jsonb, bytea, bytea)    from public;
revoke all on function public.rewrap_recovery(bytea, bytea, bytea)           from public;
revoke all on function public.delete_account()                               from public;
revoke all on function public.redeem_invite(text)                            from public;
grant execute on function public.set_vault_auth(bytea)                         to authenticated;
grant execute on function public.push_vault(bigint, bytea, bytea, bytea, text) to authenticated;
grant execute on function public.rewrap_password(bytea, jsonb, bytea, bytea)   to authenticated;
grant execute on function public.rewrap_recovery(bytea, bytea, bytea)          to authenticated;
grant execute on function public.delete_account()                             to authenticated;
grant execute on function public.redeem_invite(text)                           to anon, authenticated;

-- Anti-rollback: vault_version nunca regride (defesa em profundidade; o CAS é o principal).
create function public.no_version_regress() returns trigger language plpgsql as $$
begin
  if NEW.vault_version < OLD.vault_version then raise exception 'version_regress'; end if;
  return NEW;
end $$;
create trigger trg_vaults_no_regress before update on public.vaults
  for each row execute function public.no_version_regress();
