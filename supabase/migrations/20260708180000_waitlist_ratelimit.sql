-- Rate-limit do ENVIO de email de confirmação (a ação cara/abusável), SEM guardar IP (coerente
-- com a promessa "o IP nunca é armazenado"). Duas travas no próprio RPC:
--   • POR EMAIL: reenvia no máx. 1×/10min — impede floodar UMA vítima com re-submits.
--   • GLOBAL: teto de ~200 envios/hora — backstop contra flood de emails DISTINTOS (protege a
--     cota/reputação do Resend). Acima do teto a inscrição ainda é registrada, mas o email não é
--     enviado agora (o usuário pode reenviar depois; se confirmar é que conta como demanda).
-- last_sent_at = quando o último email de confirmação foi enviado pra essa linha (timestamp, não PII).
alter table public.investor_waitlist add column if not exists last_sent_at timestamptz;
create index if not exists investor_waitlist_last_sent_idx on public.investor_waitlist (last_sent_at);

drop function if exists public.waitlist_signup(text, text, text);
create function public.waitlist_signup(p_email text, p_lang text, p_token text)
returns table(was_confirmed boolean, send_token text, throttled boolean)
language plpgsql security invoker set search_path = public as $$
declare
  v_confirmed timestamptz;
  v_last_sent timestamptz;
  v_exists    boolean;
  v_global    int;
  v_can_send  boolean;
begin
  -- Teto global: emails enviados na última hora (proxy de destinatários recentes).
  select count(*) into v_global from public.investor_waitlist where last_sent_at > now() - interval '1 hour';

  select confirmed_at, last_sent_at into v_confirmed, v_last_sent
    from public.investor_waitlist where email = p_email;
  v_exists := found;

  -- Já confirmado: nunca reenvia, nunca rotaciona o token.
  if v_exists and v_confirmed is not null then
    return query select true, null::text, false;
    return;
  end if;

  -- Pode enviar agora? Sob o teto global E (novo OU passou 10min desde o último envio).
  v_can_send := (v_global < 200) and (v_last_sent is null or v_last_sent < now() - interval '10 minutes');

  if not v_exists then
    insert into public.investor_waitlist (email, lang, confirm_token, last_sent_at)
      values (p_email, p_lang, p_token, case when v_can_send then now() else null end);
    return query select false, (case when v_can_send then p_token else null::text end), (not v_can_send);
  elsif v_can_send then
    update public.investor_waitlist
      set confirm_token = p_token, lang = p_lang, last_sent_at = now()
      where email = p_email;
    return query select false, p_token, false;
  else
    -- Pendente, mas dentro do throttle/teto: não reenvia e NÃO rotaciona o token (link antigo segue válido).
    return query select false, null::text, true;
  end if;
end $$;
revoke all on function public.waitlist_signup(text, text, text) from public, anon, authenticated;
grant execute on function public.waitlist_signup(text, text, text) to service_role;
