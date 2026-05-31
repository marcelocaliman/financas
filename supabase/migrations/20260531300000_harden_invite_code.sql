-- ============================================================================
-- RLS: endurece o código de convite de household (ROADMAP RLS)
-- ============================================================================
-- O código tinha 8 chars hex (4 bytes = 32 bits) — adivinhável por força bruta.
-- Sobe pra 16 bytes (32 chars hex = 128 bits): inviável de adivinhar, mesmo
-- sem rate-limit. Códigos são compartilhados por link/cópia, então o tamanho
-- não atrapalha (a UI agora aceita colar). Mantém o loop anti-colisão.

set search_path = public;

create or replace function public.generate_household_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_role text;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'must be authenticated';
  end if;

  select household_id, role into v_household_id, v_role
  from public.users where id = v_user_id;

  if v_household_id is null then
    raise exception 'no household';
  end if;
  if v_role <> 'admin' then
    raise exception 'only admin can invite';
  end if;

  -- 16 bytes (128 bits) → 32 chars hex. Inviável de adivinhar.
  loop
    v_code := upper(encode(gen_random_bytes(16), 'hex'));
    begin
      insert into public.household_invites (household_id, code, created_by)
      values (v_household_id, v_code, v_user_id);
      exit;
    exception when unique_violation then
      -- colisão astronomicamente improvável; tenta de novo
    end;
  end loop;

  return v_code;
end;
$$;
