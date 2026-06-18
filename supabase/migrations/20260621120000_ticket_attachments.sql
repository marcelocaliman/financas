-- ============================================================================
-- Anexos de IMAGEM nos tickets de suporte. As imagens vão para um bucket de Storage
-- PÚBLICO com paths ALEATÓRIOS não-adivinháveis (capability URL — mesmo modelo do
-- token do convidado). Não é E2EE (suporte é texto claro; o dono precisa ver). Upload
-- só via serverless /api/ticket?action=upload (service_role), que valida tipo/tamanho.
-- O bucket em si é criado pela Storage API (ver setup). Aqui: a coluna + o RPC.
-- ============================================================================

alter table public.ticket_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- admin_ticket_thread: passa a incluir os anexos de cada mensagem.
create or replace function public.admin_ticket_thread(p_id uuid)
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
        'id', m.id, 'author', m.author, 'body', m.body, 'created_at', m.created_at,
        'attachments', m.attachments
      ) order by m.created_at)
      from public.ticket_messages m where m.ticket_id = t.id
    ), '[]'::jsonb)
  ) into r
  from public.tickets t where t.id = p_id;
  if r is null then raise exception 'ticket_not_found'; end if;
  return r;
end $$;
