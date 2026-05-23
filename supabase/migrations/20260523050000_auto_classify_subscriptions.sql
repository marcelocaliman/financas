-- ============================================================================
-- 20260523050000_auto_classify_subscriptions.sql
--
-- Trigger que auto-classifica recurring_rules como 'subscription' baseado em
-- keywords no description. Funciona em INSERT e UPDATE de description.
--
-- Antes desta migration, a classificação só rodava na migration original
-- (backfill). Regras criadas depois ficavam sem o tag a menos que o usuário
-- marcasse manualmente. Agora qualquer nova regra com keyword conhecida
-- pega o tag automaticamente.
--
-- Lista de keywords replica a da migration anterior + adiciona novos
-- (claude.ai, openai, anthropic, perplexity, midjourney, stability, etc).
-- ============================================================================

create or replace function public.tg_auto_classify_subscription()
returns trigger
language plpgsql
as $$
declare
  v_matches boolean;
begin
  -- Só interessa pra despesas com frequência mensal/anual
  if new.kind != 'expense' or new.frequency not in ('monthly', 'yearly') then
    return new;
  end if;

  -- Já tem o tag? Nada a fazer
  if 'subscription' = any(new.tags) then
    return new;
  end if;

  -- Match: case-insensitive whole-word
  v_matches := new.description ~* '\m(netflix|spotify|amazon prime|apple|apple music|apple tv|google one|google workspace|microsoft|office 365|adobe|creative cloud|canva|notion|figma|chatgpt|claude|claude\.ai|openai|anthropic|perplexity|midjourney|stability|huggingface|copilot|github|vercel|cloudflare|aws|gcp|azure|youtube premium|disney|hbo|paramount|globoplay|deezer|tidal|kindle|audible|scribd|skoob|dropbox|icloud|onedrive|backblaze|nordvpn|expressvpn|surfshark|mullvad|protonvpn|lastpass|1password|bitwarden|dashlane|wikipedia|duolingo|coursera|udemy|masterclass|babbel|rosetta|gym|smart fit|bodytech|pilates|crossfit|yoga|alura|hotmart|streaming|assinatura|subscription|plano|mensalidade)\M';

  if v_matches then
    new.tags := array_append(new.tags, 'subscription');
  end if;

  return new;
end;
$$;

drop trigger if exists recurring_rules_auto_subscription on public.recurring_rules;
create trigger recurring_rules_auto_subscription
  before insert or update of description, kind, frequency
  on public.recurring_rules
  for each row execute function public.tg_auto_classify_subscription();

-- Backfill: roda em todas as regras existentes (caso usuário tenha criado
-- algumas entre a migration anterior e essa). Idempotente.
update public.recurring_rules
set description = description
where kind = 'expense'
  and frequency in ('monthly', 'yearly')
  and not ('subscription' = any(tags));
