# Finanças — app multimoeda (cross-border)

Web app de gestão patrimonial e orçamento **multimoeda**, **local-first** e privado.
Foco inicial: quem vive entre países (jornada Brasil → Itália).

> **Fase atual: 0a — fundação local-first.** Roda 100% no navegador (IndexedDB):
> sem servidor, sem login, sem nuvem. Auth + criptografia E2EE + sync entram na
> Fase 0b, plugados atrás da **mesma** interface de repositório (`DataRepository`),
> sem reescrever os módulos.

Constituição: [CLAUDE.md](CLAUDE.md) · detalhe: [docs/BRIEF.md](docs/BRIEF.md) ·
referência visual: [docs/reference/prototipo-painel.jsx](docs/reference/prototipo-painel.jsx).

## Rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Outros scripts:

| script            | o que faz                                            |
| ----------------- | ---------------------------------------------------- |
| `npm run build`   | typecheck (tsc) + build de produção (gera o PWA)     |
| `npm run preview` | serve o build de produção localmente                 |
| `npm test`        | testes dos módulos puros (câmbio, projeção)          |

## Stack

Vite · React + TypeScript · Tailwind v4 + shadcn/ui · vite-plugin-pwa
(instalável / offline) · Zustand · Dexie (IndexedDB) · Recharts ·
react-i18next (PT-BR, EN, IT).

## Arquitetura

- **Persistência atrás de uma interface** (`src/data/repository.ts`): hoje Dexie/
  IndexedDB; na Fase 0b, Supabase + E2EE atrás da mesma interface.
- **Cada item guarda a própria moeda**; a conversão pra moeda de exibição vive em
  `src/money/currency.ts` (puro e testado).
- **Lógica financeira pura e testável**: câmbio (`src/money`) e projeção de juros
  compostos (`src/finance`) — sem dependência de UI.
- **Local-first**: dados em IndexedDB, semeados com exemplo no primeiro acesso.

## Estrutura

```
src/
  domain/       tipos de domínio (cada item com sua moeda)
  money/        câmbio + formatação (puro + testes)
  finance/      projeção de juros compostos (puro + testes)
  data/         DataRepository (interface) + Dexie + seed
  store/        Zustand (moeda de exibição, tema)
  i18n/         PT-BR / EN / IT
  components/   layout (shell) + comuns
  pages/        Painel + 7 seções
```

## Privacidade

Nesta fase nada sai do navegador. O dado financeiro nunca vai a servidor em texto
claro — princípio inegociável (ver CLAUDE.md).
