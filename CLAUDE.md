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

## Direção de design (editorial · private banking — elegante e profissional)
- One-page editorial: header flutuante transparente + HERO full-bleed + seções com
  âncora. Mobile-first; nav inferior no mobile. Muito espaço em branco, ritmo vertical
  consistente (~96px entre seções). Conteúdo centrado em ~1120px.
- **Paleta (nasce no ESCURO; zero verde-neon/lima):**
  - Fundo navy-carvão `#0E1626` (não preto). Superfícies `#16202E`. Hairlines `rgba(255,255,255,.06)`.
  - Texto `#E8EDF2` / secundário `#8A9AAD` / fraco `#5E6E80`.
  - Acento teal sóbrio `#3FA7A0` (escuro `#2C7A7B`). Champanhe/dourado `#C9A86A`
    SÓ em destaques pontuais (ex.: variação positiva). Positivo `#4FB286`, negativo `#C2553B`.
  - Claro = papel premium coerente (mesma família navy/teal).
- **Tipografia:** display SERIF **Fraunces** (Google Fonts) no título do hero e nos títulos
  de seção; **Inter** no restante; números financeiros em **Space Grotesk** com `tabular-nums`.
  Patrimônio líquido é o herói visual (grande, bem espaçado). Tokens em `src/index.css` (`@theme`).
- Cantos arredondados, sombras CONTIDAS (sem glow), hairline dividers, zero poluição.
  Gráficos discretos: linha teal 2px + área com gradiente sutil, eixos discretos, sem grid
  neon, tooltip elegante; donut em paleta coerente (teal/azul-aço/champanhe/neutro — sem arco-íris).
  Estados vazios "EM BREVE" intencionais e discretos (ícone fino + 1 linha).
- Valores VISÍVEIS por padrão; olho 👁 no header oculta (modo privacidade, não persiste).
- Referência de lógica/UX: docs/prototipo-painel.jsx.

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
