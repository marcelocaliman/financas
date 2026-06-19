-- ============================================================================
-- ACESSO DA FAMÍLIA — compartilhar o cofre SÓ-LEITURA via link + PIN, sem conta.
--
-- E2EE preservado: o link carrega um SEGREDO (256 bits) só no fragmento "#" → nunca
-- chega ao servidor. A DEK é re-embrulhada sob esse segredo no cliente; aqui guardamos
-- apenas `wrapped_dek_share` (cifrado) + o ciphertext do cofre. O servidor NUNCA vê o
-- segredo nem o texto claro.
--
-- O PIN (4 dígitos) é um PORTÃO com rate-limit/lockout no próprio RPC (bcrypt/pgcrypto).
-- `share_open` é SECURITY DEFINER e pode ser chamado por anon (o viewer não tem sessão):
-- exige token (capability, 192 bits) + PIN; o lockout por linha impede brute-force.
--
-- `secret_enc` guarda {segredo, pin} cifrado pela DEK — só pro DONO reexibir o link
-- (lido por RLS na sessão dele). NUNCA é devolvido pelo share_open ao viewer.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table public.vault_shares (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users(id) on delete cascade,
  token                text unique not null,        -- capability do link (24 bytes hex, gerado no cliente)
  pin_hash             text not null,               -- bcrypt do PIN (pgcrypto)
  pin_attempts         int  not null default 0,
  pin_locked_until     timestamptz,
  salt_share           bytea not null,              -- p/ derivar a chave de embrulho do segredo
  wrapped_dek_share    bytea not null,              -- DEK embrulhada pelo segredo (servidor não desembrulha)
  wrapped_dek_share_iv bytea not null,
  secret_enc           bytea not null,              -- {segredo,pin} cifrado pela DEK (reexibição do dono)
  secret_iv            bytea not null,
  label                text,
  revoked              boolean not null default false,
  created_at           timestamptz not null default now(),
  accessed_at          timestamptz
);
create index vault_shares_owner_idx on public.vault_shares(owner_id, created_at desc);
create index vault_shares_token_idx on public.vault_shares(token) where not revoked;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.vault_shares enable row level security;
alter table public.vault_shares force row level security;
-- Dono LÊ os próprios (pra listar/reexibir). Criar/revogar/abrir só via RPC.
create policy vshares_select_own on public.vault_shares for select using (auth.uid() = owner_id);
revoke insert, update, delete on public.vault_shares from anon, authenticated;

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- DONO cria um acesso. Recebe o material já preparado no cliente (E2EE) + o PIN em
-- claro (bcryptado aqui). Token vem do cliente (capability aleatória).
create function public.create_vault_share(
  p_token text, p_pin text, p_salt_share bytea, p_wrapped bytea, p_wrapped_iv bytea,
  p_secret_enc bytea, p_secret_iv bytea, p_label text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_pin is null or length(p_pin) < 4 then raise exception 'pin_too_short'; end if;
  if p_token is null or length(p_token) < 32 then raise exception 'bad_token'; end if;
  insert into public.vault_shares(
    owner_id, token, pin_hash, salt_share, wrapped_dek_share, wrapped_dek_share_iv,
    secret_enc, secret_iv, label
  ) values (
    v_uid, p_token, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
    p_salt_share, p_wrapped, p_wrapped_iv, p_secret_enc, p_secret_iv, nullif(p_label, '')
  ) returning id into v_id;
  return v_id;
end $$;

-- DONO revoga (apaga). Acesso morre na hora.
create function public.revoke_vault_share(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  delete from public.vault_shares where id = p_id and owner_id = v_uid;
  if not found then raise exception 'share_not_found'; end if;
end $$;

-- VIEWER (anon) abre: verifica o PIN com lockout exponencial por linha e, se ok,
-- devolve o material (cifrado) + o blob do cofre. Retorna jsonb discriminado (sem
-- exceção) pra carregar retry_after no lockout. NUNCA devolve secret_enc/pin_hash.
create function public.share_open(p_token text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vault_shares%rowtype; v_blob public.vault_blobs%rowtype; v_wait int;
begin
  select * into v from public.vault_shares where token = p_token and not revoked;
  if v.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  if v.pin_locked_until is not null and v.pin_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'retry_after', greatest(1, ceil(extract(epoch from (v.pin_locked_until - now())))::int));
  end if;

  if p_pin is null or extensions.crypt(p_pin, v.pin_hash) <> v.pin_hash then
    v_wait := power(2, least(v.pin_attempts, 5))::int; -- 1,2,4,8,16,32s
    update public.vault_shares
       set pin_attempts = pin_attempts + 1, pin_locked_until = now() + (v_wait * interval '1 second')
     where id = v.id;
    return jsonb_build_object('ok', false, 'error', 'pin', 'retry_after', v_wait);
  end if;

  update public.vault_shares set pin_attempts = 0, pin_locked_until = null, accessed_at = now()
   where id = v.id;

  select * into v_blob from public.vault_blobs where user_id = v.owner_id and shard = 'main';
  if v_blob.user_id is null then return jsonb_build_object('ok', false, 'error', 'empty'); end if;

  return jsonb_build_object(
    'ok', true,
    'owner_id', v.owner_id,
    'salt_share', encode(v.salt_share, 'base64'),
    'wrapped_dek_share', encode(v.wrapped_dek_share, 'base64'),
    'wrapped_dek_share_iv', encode(v.wrapped_dek_share_iv, 'base64'),
    'vault_version', v_blob.vault_version,
    'ciphertext', encode(v_blob.ciphertext, 'base64'),
    'iv', encode(v_blob.iv, 'base64')
  );
end $$;

-- ── Grants ───────────────────────────────────────────────────────────────────
revoke all on function public.create_vault_share(text, text, bytea, bytea, bytea, bytea, bytea, text) from public, anon;
revoke all on function public.revoke_vault_share(uuid) from public, anon;
revoke all on function public.share_open(text, text) from public;
grant execute on function public.create_vault_share(text, text, bytea, bytea, bytea, bytea, bytea, text) to authenticated;
grant execute on function public.revoke_vault_share(uuid) to authenticated;
grant execute on function public.share_open(text, text) to anon, authenticated;
