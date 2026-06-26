-- Endurecimento do entitlement Pro (achados da auditoria adversarial):
--
-- (1) Acesso da Família é Pro: ENFORÇAR no servidor, não só na UI. Hoje
--     create_vault_share só checa ownership; um usuário free editando o JS chamaria
--     a RPC direto e criaria links sem Pro. Adiciona a guarda public.is_pro().
--
-- (2) is_pro(): o ramo 'canceled + período futuro' vazava Pro em inadimplência
--     (o Stripe avança current_period_end ANTES de tentar cobrar a renovação; uma
--     renovação que falha vira unpaid/canceled com período futuro NÃO pago). Passa a
--     exigir cancel_at_period_end = true — só honra a janela paga no cancelamento
--     AGENDADO (onde o usuário já pagou o período corrente).

-- (1) ---------------------------------------------------------------------------
create or replace function public.create_vault_share(
  p_token text, p_pin text, p_salt_share bytea, p_wrapped bytea, p_wrapped_iv bytea,
  p_secret_enc bytea, p_secret_iv bytea, p_label text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_pro() then raise exception 'pro_required' using errcode = '42501'; end if;
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

-- (2) ---------------------------------------------------------------------------
create or replace function public.is_pro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.pro_subscriptions s
    where s.user_id = auth.uid()
      and ( s.status in ('active','trialing')
         or (s.trial_ends_at is not null and s.trial_ends_at > now())
         or (s.status = 'canceled' and s.cancel_at_period_end is true
             and s.current_period_end is not null and s.current_period_end > now()) )
  );
$$;
