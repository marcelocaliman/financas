-- ============================================================================
-- 20260523030000_subscriptions.sql
--
-- Adiciona tags em recurring_rules pra classificar regras (ex: 'subscription').
-- Auto-populate tag 'subscription' pra regras cujo nome bate com keywords
-- conhecidas — usuário pode adicionar/remover depois pelo UI.
-- ============================================================================

alter table public.recurring_rules
  add column if not exists tags text[] not null default '{}';

create index if not exists recurring_rules_tags_idx
  on public.recurring_rules using gin (tags);

-- Auto-classifica como 'subscription' baseado em keywords comuns
update public.recurring_rules
set tags = array_append(tags, 'subscription')
where kind = 'expense'
  and frequency in ('monthly', 'yearly')
  and not ('subscription' = any(tags))
  and (
    description ~* '\m(netflix|spotify|amazon prime|apple|google one|google workspace|microsoft|office|adobe|creative cloud|canva|notion|figma|chatgpt|claude|github|vercel|cloudflare|aws|gcp|azure|youtube premium|disney|hbo|paramount|deezer|tidal|kindle|audible|dropbox|icloud|onedrive|backblaze|nordvpn|expressvpn|surfshark|mullvad|lastpass|1password|bitwarden|wikipedia|duolingo|coursera|udemy|masterclass|babbel|rosetta|gym|smart fit|bodytech|pilates|crossfit|yoga|streaming|assinatura|plano)\M'
  );
