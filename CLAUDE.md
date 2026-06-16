# CLAUDE.md — App de Finanças Multimoeda (cross-border)
> Constituição do projeto. Leia também @docs/BRIEF.md para o detalhe completo.

## Visão
Web app profissional de gestão patrimonial e orçamento multimoeda, multiusuário,
para expatriados e quem vive entre países (foco inicial: jornada Brasil→Itália).
Diferencial: simples mas completo, multidispositivo, e privacidade por criptografia
ponta-a-ponta — o servidor nunca vê o dado financeiro em texto claro.

## Princípios inegociáveis
- Multiusuário com contas (Supabase Auth). Signup fechado/por convite até o produto
  e o básico legal (LGPD/GDPR) estarem prontos; abrir depois.
- Privacidade por E2EE: dado financeiro só vai ao servidor CIFRADO. A chave de cifragem
  é derivada no cliente e NUNCA é transmitida. O servidor só guarda ciphertext.
- Local-first: o app funciona instantâneo e offline; sincroniza em segundo plano.
- Durabilidade: o dado vive cifrado no servidor, então limpar o navegador não perde nada.
- Multimoeda de verdade: moeda de exibição + tabela de câmbio; cada item guarda a sua moeda.
- Portabilidade: export/import (JSON + CSV). O usuário é dono dos dados. i18n: PT-BR, EN, IT.

## Stack
- Front-end: Vite + React + TypeScript; Tailwind CSS + shadcn/ui; vite-plugin-pwa.
- Estado/UI: Zustand. Store local: IndexedDB via Dexie (cópia de trabalho local-first).
- Auth: Supabase Auth.
- Persistência durável/sync: Supabase Postgres guardando blobs cifrados por usuário.
- Criptografia (E2EE): cifrar/decifrar só no navegador. Chave derivada da senha por KDF
  forte (ex.: Argon2id) + CÓDIGO DE RECUPERAÇÃO gerado no cadastro como segunda via.
  Biblioteca a confirmar na implementação (WebCrypto nativo vs libsodium) — NUNCA
  implementar cripto na mão; usar lib auditada.
- Sync: last-write-wins por timestamp/versão. Merge de conflito fica para depois.
- Gráficos: Recharts. Câmbio: API gratuita (A DEFINIR — verificar tier atual de
  Frankfurter / exchangerate.host / open.er-api) com cache local e fallback manual.
- Deploy: Vercel (estático). E-mail opt-in: lista no Supabase (com consentimento),
  separada do dado financeiro.

## Segurança (regras duras)
- Chave de cifragem e senha do usuário nunca saem do cliente nem vão a log.
- O servidor jamais recebe dado financeiro legível — só blob cifrado.
- Sem recuperação por e-mail do dado cifrado: a única via é o código de recuperação.
- Toda lógica de cripto isolada num módulo, com testes.

## Direção de design (APROVADA — ver docs/reference/direcao-refinada-v2.jsx)
- One-page: header sticky translúcido + HERO com glow + divisor + dashboard + seções com âncora.
  Mobile-first; nav inferior no mobile. Padding horizontal `px-5 / md:px-10 / lg:px-14`.
  Conteúdo centrado em **~1280px** (`max-w-[1280px] mx-auto`, padrão de dashboard premium);
  fundo do header e glow do hero ficam **full-bleed** (borda/brilho de ponta a ponta).
- **Paleta (nasce no ESCURO; quase-preto NEUTRO — proibido azul/navy; proibido verde-neon/lima):**
  - Fundo `#0A0B0D`. Card `#131418`. Controles/hover `#191B20`. Hairline `rgba(255,255,255,.08)`.
  - Texto `#F3F4F6` / secundário `#9CA2AC` / fraco `#5F646C`.
  - Acento **verde refinado `#3ECF8E`** com PARCIMÔNIA (linha do gráfico, variação positiva,
    badge BRL, item ativo do menu). Negativo `#F1746A`. Neutro/EUR `#8A8F98`.
  - Claro = neutro premium (zinc) coerente, mesmo acento verde (escuro `#15976A`).
- **Tipografia:** **Inter** em tudo (PROIBIDO serifada), display com tracking apertado
  (-0.02 a -0.04em). Micro-labels (eyebrows, cabeçalho de tabela) em **JetBrains Mono**,
  uppercase, ~10.5px, `letter-spacing 0.12em`, cor fraca. Todo número financeiro com `tabular-nums`.
  Patrimônio líquido é o herói (gigante: clamp ~3–4.8rem, 600, tracking -0.04em). Tokens em `src/index.css`.
- Cards: hairline + radius 16px + padding ~24px. Sombras CONTIDAS (sem glow), hairline dividers.
  Gráficos: linha fina 2px no acento, gradiente de área sutil, tooltip escuro, eixos discretos,
  sem grid neon; donut em paleta coesa verde→cinza (sem arco-íris). Tabelas: cabeçalho mono
  uppercase, divisores hairline, badge de moeda mono (BRL verde-claro, EUR neutro), valores
  tabulares à direita. Módulos não construídos: tiles COMPACTOS "em breve" (borda tracejada).
- HERO destaca-se do resto: eyebrow mono+acento, headline grande e apertada, número-herói gigante,
  brilho radial verde MUITO sutil atrás, variação em verde, barra de composição — mais ar que as seções.
- Valores VISÍVEIS por padrão; olho 👁 no header oculta (modo privacidade, não persiste).
- Referência visual definitiva: **docs/reference/direcao-refinada-v2.jsx** (copiar essa estética).

## Escopo — V1 COMPLETA (não é MVP), em ordem de construção
- Fase 0a (fundação LOCAL): scaffold; design system; shell (layout, navegação, i18n, tema);
  camada de dados local-first (Dexie/IndexedDB) atrás de uma INTERFACE de repositório.
  Roda 100% local, sem backend.
- Fase 1 (módulos, sobre dados locais): Config moeda+câmbio; Orçamento; Patrimônio;
  Investimentos; Histórico; Objetivos; Projeção; Painel. Lógica/fórmulas em @docs/BRIEF.md
  seções 5 e 10.
- Fase 0b (NUVEM + cripto): Supabase Auth (multiusuário) + E2EE (chave derivada da senha +
  código de recuperação) + sync de blob cifrado — plugados atrás da MESMA interface de
  repositório, sem reescrever os módulos.
- Fase 2 (acabamento): export/import; polish/responsividade/acessibilidade; política de
  privacidade + LGPD/GDPR; abrir signup.

## Regras de trabalho
- Código/commits em inglês; UI traduzida via i18n.
- Componentes pequenos e reutilizáveis; nada de arquivos gigantes.
- Lógica financeira (câmbio, projeção) em módulos puros e testáveis.
- Segurança e privacidade vêm antes de conveniência. Em dúvida, não vaza dado.
- Antes de avançar de fase, pare e confirme comigo.
