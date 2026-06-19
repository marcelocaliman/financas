-- ============================================================================
-- Tickets v2 — correções da revisão adversarial:
--  1) Paginação determinística: desempate por id (sem desempate, LIMIT/OFFSET podia
--     PULAR silenciosamente um ticket entre páginas quando last_message_at empata).
--  2) Busca literal: escapa curingas LIKE (_ e %) — antes "bob_test" casava "bobXtest".
--  3) "Ler" à prova de relógio: admin_read_at/user_read_at = greatest(now, last_message_at),
--     pois last_message_at é gravado pelo clock do app (api/ticket.js) e admin_read_at pelo
--     clock do banco. Sem isso, abrir podia não limpar o "não lido" por skew de relógio.
--  4) Remove admin_tickets_unread() (código morto — a UI usa admin_tickets_counts().unread).
--  5) Higiene de grants: revoga também de anon (o default ACL do Supabase concede a anon;
--     revoke from public não tira). A guarda is_admin() continua sendo a segurança real.
-- ============================================================================

-- (3) Dono marca como lido — ancora no MESMO instante da última mensagem (à prova de skew).
create or replace function public.admin_ticket_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.tickets set admin_read_at = greatest(now(), last_message_at) where id = p_id;
end $$;
revoke all on function public.admin_ticket_read(uuid) from public, anon;
grant execute on function public.admin_ticket_read(uuid) to authenticated;

-- (3) Usuário marca o próprio como lido — mesma âncora à prova de skew.
create or replace function public.ticket_mark_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.tickets set user_read_at = greatest(now(), last_message_at)
   where id = p_id and user_id = auth.uid();
end $$;
revoke all on function public.ticket_mark_read(uuid) from public, anon;
grant execute on function public.ticket_mark_read(uuid) to authenticated;

-- (1)+(2) Lista paginada + busca: desempate por id e curingas LIKE escapados.
create or replace function public.admin_tickets_list(
  p_status text default null, p_search text default null, p_limit int default 30, p_offset int default 0
)
returns table(
  id uuid, email text, name text, subject text, category text, status text, surface text,
  last_author text, created_at timestamptz, last_message_at timestamptz, msgs bigint,
  unread boolean, total_count bigint
) language plpgsql stable security definer set search_path = public as $$
declare
  -- escapa \ % _ para busca por substring LITERAL (curingas do usuário não viram wildcard)
  v_pat text := '%' || replace(replace(replace(coalesce(p_search, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  with base as (
    select t.id, t.email, t.name, t.subject, t.category, t.status, t.surface,
           t.last_author, t.created_at, t.last_message_at,
           (t.last_author = 'user' and t.last_message_at > coalesce(t.admin_read_at, 'epoch'::timestamptz)) as unread
    from public.tickets t
    where (p_status is null or t.status = p_status)
      and (p_search is null or p_search = '' or
           t.email ilike v_pat or
           t.subject ilike v_pat or
           coalesce(t.name, '') ilike v_pat)
  )
  select base.id, base.email, base.name, base.subject, base.category, base.status, base.surface,
         base.last_author, base.created_at, base.last_message_at,
         (select count(*) from public.ticket_messages m where m.ticket_id = base.id),
         base.unread,
         (select count(*) from base)::bigint
  from base
  order by base.unread desc, base.last_message_at desc, base.id desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end $$;
revoke all on function public.admin_tickets_list(text, text, int, int) from public, anon;
grant execute on function public.admin_tickets_list(text, text, int, int) to authenticated;

-- (5) Re-afirma higiene de grants nas demais RPCs de ticket (tira anon do default ACL).
revoke all on function public.admin_tickets_counts() from public, anon;
grant execute on function public.admin_tickets_counts() to authenticated;

-- (4) admin_tickets_unread() é código morto (a UI usa counts.unread); remove para não divergir.
drop function if exists public.admin_tickets_unread();
