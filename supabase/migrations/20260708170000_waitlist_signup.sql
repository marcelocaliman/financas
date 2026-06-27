-- Inscrição ATÔMICA na lista de espera (1 round-trip). Substitui o upsert do /api/waitlist por uma
-- lógica condicional correta: INSERT se novo; se já existe e está PENDENTE, regenera o token (link
-- novo) e reenvia; se já está CONFIRMADO, NÃO toca no token e NÃO reenvia. Nunca zera confirmed_at,
-- e nunca rotaciona o token de quem já confirmou (fecha o achado de "token rotacionável" da revisão).
-- Devolve was_confirmed (p/ a mensagem do cliente) e send_token (null = não enviar email).
--
-- SECURITY INVOKER: roda como quem chama (o serverless via service_role, BYPASSRLS), então escreve
-- mesmo com a force-RLS ligada. Só o service_role chama.
create or replace function public.waitlist_signup(p_email text, p_lang text, p_token text)
returns table(was_confirmed boolean, send_token text)
language plpgsql security invoker set search_path = public as $$
declare v_confirmed timestamptz;
begin
  select confirmed_at into v_confirmed from public.investor_waitlist where email = p_email;
  if not found then
    insert into public.investor_waitlist (email, lang, confirm_token) values (p_email, p_lang, p_token);
    return query select false, p_token;
  elsif v_confirmed is not null then
    return query select true, null::text;            -- já confirmado: não mexe no token, não reenvia
  else
    update public.investor_waitlist set confirm_token = p_token, lang = p_lang where email = p_email;
    return query select false, p_token;              -- pendente: link novo, reenvia
  end if;
end $$;
revoke all on function public.waitlist_signup(text, text, text) from public, anon, authenticated;
grant execute on function public.waitlist_signup(text, text, text) to service_role;
