# Auth — configuração e ciclo de vida

Como o app trata cadastro, confirmação de e-mail e anti-abuso.

## Ciclo de vida da conta

- **Bootstrap auto-curável.** Um trigger `AFTER INSERT` em `auth.users`
  (`tg_auth_user_bootstrap`) cria o lar + perfil como fallback definitivo —
  conta órfã (auth sem `public.users`) não acontece mais. Idempotente e
  never-abort (nunca quebra o signup). Modos `join`/`accountant` seguem o fluxo
  da app; `create`/orphan são montados pelo trigger.
- **Anti-abuso no signup:** rate-limit por IP (`consume_rate_limit`, base da
  Fase 0) + captcha Turnstile (engatilhado). Ambos no-op se não configurados.

## Settings do Supabase (dashboard ou config.toml)

Configurar em **Authentication → Settings** (estes são os valores pretendidos —
versionados aqui já que o projeto não usa o Supabase CLI linkado):

- **Confirm email: ON.** O usuário só recebe sessão após confirmar (o app trata
  `needsConfirmation`). Decisão D28: manter confirmação, mas o produto pode
  evoluir pra confirmação não-bloqueante com um banner — hoje seguimos o padrão
  do Supabase (bloqueante até confirmar).
- **Secure email change: ON** (exige confirmar nos dois endereços).
- **Minimum password length: 8** (alinhado ao Zod do signup).
- **Bot/abuse protection (Turnstile):** se ativar o captcha no app, ative também
  no Supabase Auth (Settings → Bot and Abuse Protection) e passe o
  `options.captchaToken` no signUp — assim o GoTrue valida do lado dele também.
- **Login social (Google):** opcional (D28). Habilite o provider Google e
  configure o OAuth redirect `https://SEU_DOMINIO/callback`.

## Env vars (anti-abuso — engatilhado)

```
# Cloudflare Turnstile (captcha). Sem estas, o captcha é no-op.
TURNSTILE_SECRET_KEY=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
# Desliga o rate-limit de auth (apenas dev/e2e):
AUTH_RATELIMIT_DISABLED=false
```

Ligar o captcha: crie um widget Turnstile em https://dash.cloudflare.com →
Turnstile, copie as duas chaves, e o widget aparece sozinho no formulário de
cadastro (`components/auth/turnstile-widget.tsx`).
