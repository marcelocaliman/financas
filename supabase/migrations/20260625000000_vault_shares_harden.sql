-- ============================================================================
-- ENDURECIMENTO do "Acesso da família" (revisão adversarial de segurança).
--
-- Corrige, no portão `share_open` + tabela `vault_shares`:
--  1. CRÍTICO — corrida de concorrência fura o lockout do PIN: o SELECT não travava
--     a linha, então N requisições paralelas liam o MESMO pin_attempts/lock (READ
--     COMMITTED) e cada uma adivinhava antes do backoff valer. → `SELECT … FOR UPDATE`.
--  2. ALTO — oráculo por timing: caminho "not_found" retornava sem bcrypt (instantâneo),
--     enquanto "pin errado" rodava bcrypt (~100ms), distinguindo token-existe por latência.
--     → exatamente UMA verificação bcrypt em todo caminho (real se achou; dummy se não).
--  3. MÉDIO — RLS é por LINHA, não por COLUNA: o dono podia ler pin_hash/pin_attempts/
--     pin_locked_until via PostgREST. → SELECT por coluna (esconde o estado do lockout).
--  + Backoff mais forte: teto do expoente 5→7 (máx 32s → 128s ≈ 2min) contra brute-force
--    de um link vazado. Usuário legítimo não é afetado (PIN certo zera o contador).
-- ============================================================================

-- ── #3: privilégio por COLUNA (esconde lockout/pin_hash de selects diretos) ───────
-- A RLS continua filtrando LINHAS (vshares_select_own); aqui restringimos as COLUNAS.
-- anon não seleciona a tabela diretamente (usa só o RPC share_open).
revoke select on public.vault_shares from anon, authenticated;
grant select (
  id, owner_id, token, label, created_at, accessed_at,
  salt_share, wrapped_dek_share, wrapped_dek_share_iv,
  secret_enc, secret_iv, revoked
) on public.vault_shares to authenticated;

-- ── #1 + #2 + backoff: substitui share_open ──────────────────────────────────────
create or replace function public.share_open(p_token text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.vault_shares%rowtype;
  v_blob public.vault_blobs%rowtype;
  v_wait int;
  v_hash text;
  -- bcrypt fixo (hash de string descartável, NÃO é segredo) p/ tempo constante no
  -- caminho "not_found": garante exatamente UMA verificação bcrypt em qualquer caminho,
  -- sem oráculo de timing que separe token-existe de token-inexistente.
  v_dummy constant text := '$2a$08$scegMyATSz/qdDiN34MoWe180UhafFxCRsp0RewJiNyj6Sx35EiTC';
begin
  -- FOR UPDATE: serializa tentativas concorrentes na MESMA linha → backoff exponencial
  -- é respeitado mesmo sob requisições paralelas (sem isso, dá pra furar o lockout).
  select * into v from public.vault_shares where token = p_token and not revoked for update;

  -- Lockout (só existe p/ linha encontrada) — retorno explícito antes do bcrypt.
  if v.id is not null and v.pin_locked_until is not null and v.pin_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'retry_after', greatest(1, ceil(extract(epoch from (v.pin_locked_until - now())))::int));
  end if;

  -- Exatamente UMA verificação bcrypt em TODO caminho (real se achou; dummy se não) →
  -- latência uniforme entre "not_found" e "pin errado".
  v_hash := coalesce(v.pin_hash, v_dummy);
  if extensions.crypt(coalesce(p_pin, ''), v_hash) <> v_hash or v.id is null then
    if v.id is null then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    v_wait := power(2, least(v.pin_attempts, 7))::int; -- 1,2,4,8,16,32,64,128s
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

-- create or replace preserva grants, mas reafirmamos por idempotência.
revoke all on function public.share_open(text, text) from public;
grant execute on function public.share_open(text, text) to anon, authenticated;
