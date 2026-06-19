-- ============================================================================
-- Tickets v2: leitura do DONO (badge limpa ao LER, não só ao responder) + ESCALA
-- (busca + paginação na lista do painel) + realtime confiável (replica identity).
-- ============================================================================

-- Quando o dono leu cada ticket (espelha o user_read_at do usuário). Nulo = nunca aberto = NOVO.
alter table public.tickets add column if not exists admin_read_at timestamptz;

-- Realtime em UPDATE/DELETE respeitando RLS exige o payload completo da linha (replica identity full).
-- Sem isso, marcar como lido podia não propagar e o badge "não sumia". Volume é baixo → custo ok.
alter table public.tickets         replica identity full;
alter table public.ticket_messages replica identity full;

-- O dono marca um ticket como lido (ao abrir a conversa). Limpa o "não lido" dele.
create or replace function public.admin_ticket_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.tickets set admin_read_at = now() where id = p_id;
end $$;
revoke all on function public.admin_ticket_read(uuid) from public;
grant execute on function public.admin_ticket_read(uuid) to authenticated;

-- Lista PAGINADA + BUSCA (email/assunto/nome), NÃO-LIDOS primeiro, com flag de não-lido e total.
drop function if exists public.admin_tickets_list(text, int);
create function public.admin_tickets_list(
  p_status text default null, p_search text default null, p_limit int default 30, p_offset int default 0
)
returns table(
  id uuid, email text, name text, subject text, category text, status text, surface text,
  last_author text, created_at timestamptz, last_message_at timestamptz, msgs bigint,
  unread boolean, total_count bigint
) language plpgsql stable security definer set search_path = public as $$
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
           t.email ilike '%' || p_search || '%' or
           t.subject ilike '%' || p_search || '%' or
           coalesce(t.name, '') ilike '%' || p_search || '%')
  )
  select base.id, base.email, base.name, base.subject, base.category, base.status, base.surface,
         base.last_author, base.created_at, base.last_message_at,
         (select count(*) from public.ticket_messages m where m.ticket_id = base.id),
         base.unread,
         (select count(*) from base)::bigint
  from base
  order by base.unread desc, base.last_message_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end $$;
revoke all on function public.admin_tickets_list(text, text, int, int) from public;
grant execute on function public.admin_tickets_list(text, text, int, int) to authenticated;

-- Contadores do painel: total, abertos, NÃO-LIDOS (precisam de atenção) e NOVOS (nunca abertos).
create or replace function public.admin_tickets_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total',  (select count(*) from public.tickets),
    'open',   (select count(*) from public.tickets where status = 'open'),
    'unread', (select count(*) from public.tickets where last_author = 'user' and last_message_at > coalesce(admin_read_at, 'epoch'::timestamptz)),
    'novos',  (select count(*) from public.tickets where last_author = 'user' and admin_read_at is null)
  );
end $$;
revoke all on function public.admin_tickets_counts() from public;
grant execute on function public.admin_tickets_counts() to authenticated;

-- admin_tickets_unread passa a refletir LIDO/NÃO-LIDO (limpa quando o dono lê), não mais só status.
create or replace function public.admin_tickets_unread()
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return (select count(*)::int from public.tickets where last_author = 'user' and last_message_at > coalesce(admin_read_at, 'epoch'::timestamptz));
end $$;
