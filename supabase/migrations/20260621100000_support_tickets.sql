-- ============================================================================
-- Suporte (tickets) — central de atendimento. Multiusuário + CONVIDADO (landing).
--
-- IMPORTANTE: correspondência de suporte é TEXTO CLARO (não é o cofre E2EE). Pra
-- responder, o dono precisa LER — então a mensagem não pode ser cifrada com a chave
-- do usuário. Protegido por RLS: o usuário lê só os PRÓPRIOS tickets; o dono lê todos
-- (is_admin). O convidado (sem conta) NÃO tem acesso via RLS — só pelo serverless que
-- valida o access_token (capability link). Escrita: SÓ via service_role (/api/ticket)
-- ou RPC SECURITY DEFINER. Nunca guardar dado financeiro aqui (avisado nos formulários).
-- ============================================================================

create table public.tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,  -- nulo = convidado (landing)
  email           text not null,
  name            text,
  subject         text not null,
  category        text not null default 'duvida',   -- duvida | problema | sugestao | conta | outro
  status          text not null default 'open',      -- open (aberto) | closed (resolvido)
  surface         text not null default 'app',       -- app | landing
  locale          text,
  meta            jsonb not null default '{}'::jsonb, -- versão/navegador/seção… (NUNCA financeiro)
  access_token    text unique,                       -- só convidado: link rastreável
  last_author     text not null default 'user',      -- user | admin (quem mandou a última)
  user_read_at    timestamptz,                       -- até quando o usuário leu (badge in-app)
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets(id) on delete cascade,
  author      text not null,                          -- user | admin
  body        text not null,
  created_at  timestamptz not null default now()
);

create index tickets_user_idx     on public.tickets (user_id, last_message_at desc);
create index tickets_status_idx   on public.tickets (status, last_message_at desc);
create index ticket_messages_idx  on public.ticket_messages (ticket_id, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.tickets         enable row level security;  alter table public.tickets         force row level security;
alter table public.ticket_messages enable row level security;  alter table public.ticket_messages force row level security;

-- Escrita só via service_role (serverless) ou RPC definer; authenticated só LÊ.
revoke all on public.tickets         from anon, authenticated;
revoke all on public.ticket_messages from anon, authenticated;
grant select on public.tickets         to authenticated;
grant select on public.ticket_messages to authenticated;

-- Usuário lê os próprios; dono lê todos (políticas permissivas = OR).
create policy tickets_select_own   on public.tickets         for select using (user_id = auth.uid());
create policy tickets_select_admin on public.tickets         for select using (public.is_admin());
create policy tmsg_select_own      on public.ticket_messages for select using (
  exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy tmsg_select_admin    on public.ticket_messages for select using (public.is_admin());

-- ── RPCs do dono (SECURITY DEFINER; sempre checam is_admin) ──────────────────

-- Lista de tickets (opcionalmente filtrada por status), mais recentes primeiro.
create function public.admin_tickets_list(p_status text default null, p_limit int default 200)
returns table(
  id uuid, email text, name text, subject text, category text, status text, surface text,
  last_author text, created_at timestamptz, last_message_at timestamptz, msgs bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select t.id, t.email, t.name, t.subject, t.category, t.status, t.surface,
         t.last_author, t.created_at, t.last_message_at,
         (select count(*) from public.ticket_messages m where m.ticket_id = t.id)
  from public.tickets t
  where p_status is null or t.status = p_status
  order by t.last_message_at desc
  limit greatest(p_limit, 1);
end $$;

-- Detalhe + thread completa de um ticket.
create function public.admin_ticket_thread(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'id', t.id, 'user_id', t.user_id, 'email', t.email, 'name', t.name,
    'subject', t.subject, 'category', t.category, 'status', t.status, 'surface', t.surface,
    'locale', t.locale, 'meta', t.meta, 'last_author', t.last_author,
    'created_at', t.created_at, 'last_message_at', t.last_message_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'author', m.author, 'body', m.body, 'created_at', m.created_at
      ) order by m.created_at)
      from public.ticket_messages m where m.ticket_id = t.id
    ), '[]'::jsonb)
  ) into r
  from public.tickets t where t.id = p_id;
  if r is null then raise exception 'ticket_not_found'; end if;
  return r;
end $$;

-- Contador de tickets que precisam da SUA resposta (abertos, última do usuário).
create function public.admin_tickets_unread()
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return (select count(*)::int from public.tickets where status = 'open' and last_author = 'user');
end $$;

-- Muda o status (open/closed) de um ticket.
create function public.admin_ticket_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_status not in ('open', 'closed') then raise exception 'invalid_status'; end if;
  update public.tickets set status = p_status, updated_at = now() where id = p_id;
  if not found then raise exception 'ticket_not_found'; end if;
end $$;

-- Usuário marca o próprio ticket como lido (limpa o badge in-app). Só o dono do ticket.
create function public.ticket_mark_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.tickets set user_read_at = now() where id = p_id and user_id = auth.uid();
end $$;

-- ── Grants (a guarda is_admin/ownership é a segurança real) ──────────────────
revoke all on function public.admin_tickets_list(text, int)        from public;
revoke all on function public.admin_ticket_thread(uuid)            from public;
revoke all on function public.admin_tickets_unread()               from public;
revoke all on function public.admin_ticket_set_status(uuid, text)  from public;
revoke all on function public.ticket_mark_read(uuid)               from public;

grant execute on function public.admin_tickets_list(text, int)       to authenticated;
grant execute on function public.admin_ticket_thread(uuid)           to authenticated;
grant execute on function public.admin_tickets_unread()              to authenticated;
grant execute on function public.admin_ticket_set_status(uuid, text) to authenticated;
grant execute on function public.ticket_mark_read(uuid)              to authenticated;

-- ── Realtime: badge do dono + thread ao vivo do usuário (RLS é respeitada) ───
do $$
begin
  alter publication supabase_realtime add table public.tickets;
  alter publication supabase_realtime add table public.ticket_messages;
exception when others then null;  -- idempotente (já publicado)
end $$;
