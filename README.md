# Finanças

> Instrumento de navegação para a independência financeira do casal.
> Atrito zero na entrada, sofisticação no motor.

Stack: **Next.js 16** (App Router, React 19) · **TypeScript** · **Tailwind v4** ·
**Supabase** (Postgres + Auth + Realtime) · **TanStack Query** · **Motion** ·
**Recharts** · **Lucide**.

Tipografia: **Fraunces** (display itálica) + **Geist** (sans) + **JetBrains Mono** (números).

Documentos:

- [Briefing completo](docs/briefing.md)
- [Protótipo HTML de referência](docs/reference-prototype.html)

## Desenvolvimento

```bash
pnpm install
cp .env.example .env.local   # preencher credenciais do Supabase
pnpm dev                     # http://localhost:3000
```

## Banco de dados (Supabase)

Primeira configuração:

```bash
pnpm db:link        # supabase link --project-ref <PROJECT_REF>
pnpm db:push        # aplica migrations em supabase/migrations
pnpm db:types       # regenera types/database.generated.ts
```

A migration inicial (`supabase/migrations/20260522000000_init_core.sql`) cria:

- `households`, `users`, `accounts`, `categories`, `transactions`
- RLS em todas as tabelas (escopo por `household_id`)
- `bootstrap_household(p_household_name, p_display_name)` — chamada na primeira
  entrada após cadastro/magic-link, cria household + perfil + categorias padrão
- `seed_default_categories(household_id)` — 15 categorias default
- Publicação realtime para `transactions` e `accounts`

## Estrutura de pastas

```
app/
  (auth)/            grupo público (login, cadastro, callback)
  (app)/             grupo autenticado (dashboard, transações, etc.)
  globals.css        design system (Tailwind v4 + tokens)
  layout.tsx         fontes, providers, metadata
components/
  ui/                primitivas (Button, Input, Panel, Eyebrow, …)
  layout/            sidebar, mobile-nav, page-header, brand
  forms/             formulários reutilizáveis
  charts/            wrappers de gráficos
lib/
  supabase/          clients browser/server/middleware
  financial/         cálculos (money em centavos, IR, Selic)
  utils/             cn, formatters de pt-BR
services/            queries/mutations isoladas da UI
hooks/               hooks customizados
types/               types compartilhados (database.ts gerado/manual)
supabase/
  migrations/        SQL versionado
  functions/         Edge Functions (Fase 3+)
```

## Filosofia

1. **Atrito zero na entrada** — lançar uma transação não passa de 5 segundos.
2. **Uma pergunta principal por tela** — sem dashboards genéricos.
3. **O app pensa, o casal decide** — sugere, projeta, alerta; nunca executa
   irreversível sem confirmação.

## Status

- [x] Fase 1 — esqueleto, auth, RLS, sidebar, dashboard onboarding
- [ ] Fase 1 — CRUD de contas, categorias e transações + lista com filtros
- [ ] Fase 2 — análise, projeções, detector de anomalia, transferências
- [ ] Fase 3 — investimentos, Selic ao vivo, edge function diária
- [ ] Fase 4 — resgates inteligentes, lembretes
- [ ] Fase 5 — metas, polimento, exports
- [ ] Fase 6 — IA pontual (categorização inteligente, OCR, chat)
