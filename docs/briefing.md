# Patrimônio — Briefing de Produto

> Documento de visão para construção do app de gestão financeira pessoal.
> Versão 1.0 · Maio de 2026

---

## 1. A visão em uma frase

**Patrimônio é um app de finanças pessoais para casais que querem viver, um dia, da renda dos próprios investimentos — e querem entender, mês a mês, exatamente onde estão nessa jornada.**

Não é mais um app de "controlar gastos". É um instrumento de navegação para independência financeira, com a sofisticação visual de um produto editorial premium e a inteligência de quem entende que a vida real não cabe em planilha.

---

## 2. Filosofia do produto

### O problema real

Apps de finanças hoje falham por dois extremos:

1. **Simples demais** (tipo Mobills, Organizze): viram diário de gastos, sem inteligência, sem visão de patrimônio, sem conexão com investimentos. Você sabe quanto gastou; não sabe pra onde está indo.
2. **Complexos demais** (tipo planilhas elaboradas, Kinvo, etc): tantas features que você abandona em 2 semanas. Atrito demais pra lançar uma transação. Dashboard com 47 widgets que ninguém olha.

O Patrimônio mora no meio: **simplicidade radical na interface, sofisticação cirúrgica nas mecânicas internas**. Você vê uma tela limpa que responde "como estamos esse mês?" em 2 segundos. Por baixo, um motor que calcula Selic dia a dia, projeta cenários, detecta padrões.

### Três princípios fundamentais

**1. Atrito zero na entrada.**
Se lançar uma transação leva mais de 5 segundos, o casal abandona em 3 semanas. Tudo deve ser otimizado pra entrada rápida: categoria sugerida, conta lembrada, data pré-preenchida com hoje.

**2. Uma pergunta principal por tela.**
A Home responde "como estamos esse mês?". A tela de Análise responde "para onde foi o dinheiro?". A tela de Investimentos responde "quanto o patrimônio rende?". Cada tela tem um propósito; nada de dashboards genéricos.

**3. O app pensa, o casal decide.**
O app sugere categoria, projeta fim de mês, detecta anomalias, calcula renda passiva. Mas nunca executa sozinho decisões irreversíveis — sempre uma confirmação. O usuário fica no comando, mas com superpoderes.

### O que NÃO é o Patrimônio

- **Não é** ferramenta de aconselhamento de investimento (não recomenda compra/venda)
- **Não é** integrado a bancos via Open Finance (zero integração, tudo manual ou lembrete)
- **Não é** ferramenta empresarial (é pessoal/casal apenas)
- **Não é** um clone de Mobills/Organizze/Mint
- **Não é** uma planilha em formato app

---

## 3. Personas e contexto de uso

### Quem usa

**Marcelo (35-45 anos, perfil técnico):**
- Profissional liberal ou empreendedor digital
- Tem domínio técnico, já mexe com VPS, DNS, APIs
- Lê sobre investimentos, entende DY, Selic, IPCA, juros compostos
- Quer ferramenta sofisticada mas não complexa
- É quem vai operar o app no dia a dia ("CFO da casa")

**Esposa do Marcelo:**
- Acesso compartilhado (mesmo login no MVP)
- Foco em visualização e consulta, não operação
- Quer confiar no que está vendo sem entender o motor

### Contexto de uso real

- **Diário (30 segundos):** lançar 1-3 transações ao longo do dia, geralmente no celular
- **Semanal (3-5 minutos):** revisar gastos da semana, ajustar categorias se preciso
- **Mensal (15-30 minutos):** revisar análise do mês, configurar próximos resgates de investimentos, ajustar metas
- **Trimestral (1 hora):** revisão profunda, projeções de longo prazo, decisões de aporte

### Dispositivos

- **Celular (60% do uso):** lançamentos rápidos
- **Desktop (30% do uso):** análises profundas, configurações
- **Tablet (10% do uso):** revisão noturna

O app deve ser **PWA desde o início** — instalável como app nativo no iPhone/Android, funciona offline pra lançar transações (sync depois).

---

## 4. Stack técnica (decidido)

### Frontend
- **Next.js 14+** com App Router
- **TypeScript** strict
- **Tailwind CSS** + **shadcn/ui** para componentes base
- **Framer Motion** para microanimações
- **Recharts** ou **Tremor** para gráficos
- **TanStack Query** para state de servidor

### Backend
- **Supabase** (Postgres + Auth + Realtime + Edge Functions + Storage)
- **Row Level Security** desde o dia 1
- Schema versionado via migrations
- Edge Functions em Deno para jobs agendados (atualização de Selic, etc.)

### Hospedagem
- **Vercel** para frontend (free tier)
- **Supabase Cloud** para backend (free tier)
- Domínio próprio: `financas.mcalimanc.com` (subdomain CNAME para Vercel)

### Estrutura de pastas sugerida (mas tem liberdade pra ajustar)

```
/app                    → rotas Next.js (App Router)
  /(auth)              → grupo de rotas de autenticação
  /(app)               → grupo de rotas autenticadas
    /dashboard
    /transacoes
    /analise
    /investimentos
    /resgates
    /metas
    /contas
  /api                 → API routes (se necessário)
/components
  /ui                  → shadcn/ui components
  /charts              → wrappers de gráficos
  /forms               → formulários reutilizáveis
/lib
  /supabase            → client + helpers
  /financial           → cálculos financeiros (Selic, CDI, IR, projeções)
  /utils
/services              → camada de queries/mutations isolada
  /transactions.ts
  /investments.ts
  /categories.ts
  /yields.ts
/hooks                 → React hooks customizados
/types                 → TypeScript types compartilhados
/supabase
  /migrations          → SQL migrations versionadas
  /functions           → Edge Functions
```

### Princípio arquitetural

**Lógica de negócio isolada da UI.** Toda função de cálculo, query ao banco, transformação de dados vive em `/services` ou `/lib/financial`. Componentes React consomem essas funções; não embutem lógica.

Isso é importante porque no futuro queremos poder:
- Adicionar IA (essas funções viram "tools" pra LLM)
- Mudar de Supabase pra outra coisa (a UI não se acopla ao backend)
- Testar lógica financeira sem precisar montar UI

---

## 5. Identidade visual (decidido)

### Tipografia

- **Display (títulos editoriais, momentos especiais):** Fraunces — serifa moderna com personalidade
- **Sans-serif (corpo, UI):** Geist — limpa, técnica, atual
- **Monospace (todos os números):** JetBrains Mono — peso técnico para dados financeiros

Carregar via Google Fonts:
```
Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600
Geist:wght@300;400;500;600
JetBrains+Mono:wght@300;400;500;600
```

### Paleta

**Bases (papel quente, não branco puro):**
- `--bg`: `#fcfbf8` (papel bege quente)
- `--surface`: `#ffffff`
- `--surface-2`: `#f7f5ee` (bege claro pra cards secundários)

**Tinta (escuro azulado, não preto puro):**
- `--ink-950`: `#0a0d12`
- `--ink-900`: `#11151c`
- `--ink-800`: `#1a1f29`

**Azul marinho (cor de autoridade):**
- `--navy-950`: `#0a1428`
- `--navy-900`: `#0e1e3d`
- `--navy-700`: `#1d3866`
- Variações até `--navy-50`

**Acentos sóbrios e dessaturados:**
- `--olive-600` `#738851` — positivo (verde-musgo)
- `--rust-600` `#ac5340` — negativo (bordô-ferrugem)
- `--gold-600` `#b07b32` — atenção (dourado-tabaco)

**Importante:** todos os acentos são dessaturados, com cara de pigmento natural, **não de neon digital**. Evitar verde-bandeira e vermelho-pure.

### Princípios visuais

1. **Sentence case sempre.** Nunca Title Case, nunca ALL CAPS (exceto eyebrows com tracking alto).
2. **Eyebrows em monospace:** `MAIO · 2026` antes dos títulos cria hierarquia editorial.
3. **Itálico serifado para palavras-chave:** `Boa tarde, Marcelo.` com "Marcelo" em Fraunces itálica.
4. **Pontuação respiratória:** pontos finais nos títulos curtos (`Tirar renda para viver.`) — dá ritmo editorial.
5. **Sem gradientes vistosos**, sem sombras dramáticas. Só elevações sutis (shadow-sm, shadow-md).
6. **Bordas finíssimas:** 0.5px ou 1px sempre. Nunca 2px+ exceto em accents intencionais.
7. **Espaço em branco generoso** — apertar é tentação, resistir.

### Referência visual completa

O documento de protótipo HTML que serviu de norte está anexo (arquivo `patrimonio.html`). Use como referência viva — não como amarra. A direção criativa é mais importante que a execução exata.

---

## 6. Modelo de dados (núcleo)

Schema base do Postgres no Supabase. Liberdade para evoluir/refinar, mas esses são os conceitos centrais.

### `households`
Representa o casal/família. Toda data pertence a um household.
- `id` (uuid, pk)
- `name` (text)
- `created_at` (timestamp)

### `users`
Usuários do household (você + esposa).
- `id` (uuid, pk, ref auth.users)
- `household_id` (fk)
- `display_name` (text)
- `role` (text: 'admin' | 'member')

### `accounts`
Contas e cartões (Itaú CC, Nubank crédito, etc.) — onde o dinheiro mora.
- `id` (uuid, pk)
- `household_id` (fk)
- `institution` (text: 'Itaú', 'Nubank', 'Inter', 'XP', etc.)
- `type` (text: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash')
- `name` (text: apelido do usuário)
- `color` (text: hex pra UI)
- `current_balance` (decimal, denormalizado pra performance)
- `is_active` (bool)
- `created_at` (timestamp)

### `categories`
Categorias de transações (Mercado, Delivery, etc.) com regras de auto-classificação.
- `id` (uuid, pk)
- `household_id` (fk)
- `name` (text)
- `icon` (text: nome do ícone)
- `color` (text: hex)
- `parent_id` (uuid, nullable: categoria pai pra subcategorias)
- `rules` (jsonb: regras de auto-classificação, ex: `[{"match": "uber", "field": "description"}]`)
- `kind` (text: 'income' | 'expense' | 'transfer')

### `transactions`
O coração do app — toda movimentação de dinheiro.
- `id` (uuid, pk)
- `household_id` (fk)
- `account_id` (fk)
- `category_id` (fk, nullable)
- `kind` (text: 'income' | 'expense' | 'transfer')
- `amount` (decimal, sempre positivo — sinal vem do `kind`)
- `description` (text)
- `payment_method` (text, nullable: 'credit' | 'debit' | 'pix' | 'cash' | 'auto_debit')
- `date` (date)
- `created_by` (fk users)
- `category_source` (text: 'manual' | 'rule' | 'ai' — pra transparência futura)
- `category_confidence` (decimal, nullable: 0-1, pra quando IA entrar)
- `transfer_pair_id` (uuid, nullable: liga os 2 lados de uma transferência)
- `is_recurring` (bool)
- `recurring_rule_id` (fk, nullable)
- `metadata` (jsonb: campo livre pra crescer)

### `investments`
Ativos da carteira.
- `id` (uuid, pk)
- `household_id` (fk)
- `account_id` (fk: corretora onde está custodiado)
- `ticker` (text: 'MXRF11', 'Tesouro Selic 2031', etc.)
- `name` (text)
- `asset_type` (text: 'fii' | 'fixed_income_public' | 'fixed_income_private' | 'stock' | 'etf' | 'crypto')
- `indexer` (text, nullable: 'selic' | 'cdi' | 'ipca' | 'fixed' | 'none')
- `indexer_multiplier` (decimal, nullable: 1.0 = 100% Selic, 1.10 = 110% CDI)
- `fixed_rate` (decimal, nullable: pra prefixados)
- `purchase_date` (date)
- `initial_amount` (decimal)
- `current_balance` (decimal, calculado e atualizado diariamente)
- `tax_regime` (text: 'regressive' | 'exempt')
- `is_active` (bool)

### `investment_yields`
Histórico de rendimentos mensais por ativo.
- `id` (uuid, pk)
- `investment_id` (fk)
- `month` (date: primeiro dia do mês)
- `gross_yield` (decimal: rendimento bruto)
- `tax` (decimal: IR pago)
- `net_yield` (decimal: líquido)
- `source` (text: 'calculated' | 'manual' — calculado da Selic ou lançado pelo usuário)

### `indexer_history`
Histórico diário dos indexadores (Selic, CDI, IPCA).
- `indexer` (text)
- `date` (date)
- `value` (decimal)
- PK composta: (indexer, date)

Populado por Edge Function que roda diariamente consultando `api.bcb.gov.br/dados/serie/bcdata.sgs.{code}`.
- Selic: série 11
- CDI: série 12
- IPCA: série 433

### `yield_rules`
Regras de saque/lembrete configuradas pelo usuário.
- `id` (uuid, pk)
- `investment_id` (fk)
- `destination_account_id` (fk)
- `mode` (text: 'reinvest' | 'fixed_amount' | 'percentage')
- `suggested_amount` (decimal, nullable)
- `percentage` (decimal, nullable)
- `day_of_month` (int: 1-31)
- `is_active` (bool)

### `budgets`
Metas de orçamento por categoria.
- `id` (uuid, pk)
- `household_id` (fk)
- `category_id` (fk)
- `month` (date: primeiro dia do mês, ou null = mensal recorrente)
- `limit_amount` (decimal)

### `goals`
Metas/sonhos.
- `id` (uuid, pk)
- `household_id` (fk)
- `name` (text)
- `description` (text)
- `target_amount` (decimal)
- `current_amount` (decimal, calculado)
- `target_date` (date, nullable)
- `linked_account_id` (fk, nullable: conta onde o dinheiro da meta mora)
- `created_at` (timestamp)

### RLS (Row Level Security)

**Obrigatório desde o dia 1.** Toda tabela com `household_id` deve ter policy:

```sql
CREATE POLICY "users can only see their household data"
ON [table]
FOR ALL
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);
```

Sem RLS, qualquer pessoa logada vê os dados de todo mundo. Falha de segurança crítica.

---

## 7. Funcionalidades por fase

### Fase 1 — Núcleo funcional (2-3 semanas)

**Objetivo:** substituir qualquer planilha. App já é útil.

- Autenticação Supabase (email/senha + magic link)
- Onboarding: criar household, cadastrar 1-2 contas iniciais, seed de categorias padrão (15 categorias cobrem 95% dos casos)
- CRUD de transações (receita/despesa/transferência)
- Modal de adicionar transação em 5 segundos
- Lista de transações com filtros básicos (mês, categoria, conta, busca)
- Home com: sobra do mês, total receitas, total despesas, lista das últimas transações
- CRUD de contas
- CRUD de categorias
- Deploy na Vercel + Supabase Cloud
- PWA configurado (manifest + service worker básico)

**Critério de "pronto":** você e sua esposa conseguem usar por 1 semana sem reclamar.

### Fase 2 — Inteligência básica (2-3 semanas)

**Objetivo:** app deixa de ser planilha e começa a "pensar com você".

- Auto-categorização por regras (matching de string em description)
- Projeção de fim de mês (gasto médio diário × dias restantes)
- Detector de gastos atípicos (alerta quando categoria está >50% acima da média dos 3 meses anteriores)
- Tela "Análise" com gráficos:
  - Barras horizontais de gastos por categoria do mês
  - Linha de receitas vs despesas dos últimos 6 meses
  - Tabela comparativa mês a mês com variação %
- Edição em massa de transações (multi-select)
- Transferências entre contas: criam 2 lançamentos espelhados (transfer_pair_id) e não inflam receita/despesa nos relatórios
- Modo escuro automático (prefers-color-scheme)
- Realtime: quando a esposa lança no celular dela, seu celular atualiza

**Critério de "pronto":** vocês começam a abrir o app sem motivo, só pra ver os gráficos.

### Fase 3 — Investimentos e renda passiva (2 semanas)

**Objetivo:** app passa a responder "quando o rendimento vai sustentar nossa vida?"

- CRUD de investimentos
- Edge Function diária que:
  - Consulta API do BCB e atualiza `indexer_history` (Selic, CDI, IPCA)
  - Recalcula `current_balance` de cada `investment` ativo
- Tela "Investimentos" com:
  - Cards de stats (patrimônio total, renda mensal média, DY, cobertura)
  - Card destaque "Tesouro Selic ao vivo" com saldo crescendo a cada segundo (UI calcula o microincremento em tempo real)
  - Tabela de ativos com renda/mês, DY, valor atual
- Histórico de yields manual ou calculado
- Cálculo de IR regressivo (22,5% / 20% / 17,5% / 15% conforme prazo)
- Integração opcional com `brapi.dev` para cotação de FIIs/ações (gratuita)

**Critério de "pronto":** você consegue responder "quanto vou receber líquido esse mês das aplicações?" em 2 segundos.

### Fase 4 — Resgates e renda para viver (1-2 semanas)

**Objetivo:** modelar o uso dos rendimentos como sua "vida real".

- CRUD de `yield_rules` por investimento
- 3 modos: reinvestir tudo, valor sugerido editável, % do rendimento
- Sistema de lembretes mensais:
  - No dia configurado, criar uma "transação pendente" com valor sugerido
  - Notificação no app (e push se PWA permitir)
  - Usuário aprova com 1 toque (ou ajusta valor antes de aprovar)
  - Pode pular o mês
- Tela "Resgates" com:
  - Próximo lembrete em destaque
  - Fluxo visual origem → destino
  - Histórico dos saques reais (variáveis mês a mês, incluindo meses pulados)
  - Projeção de patrimônio em 5 anos com gráfico interativo
  - Slider de "valor sugerido" que redesenha a projeção em tempo real
- Indicador de "renda passiva consumida vs gerada" no mês

**Critério de "pronto":** você configura uma regra de saque e o app te lembra no dia certo, com o valor certo, e registra o que efetivamente saiu.

### Fase 5 — Metas e polimento (1-2 semanas)

**Objetivo:** transformar de "app legal" em "app que impressiona em 5 segundos".

- CRUD de metas (`goals`)
- Cálculo automático de "conclusão prevista" baseado em ritmo de aporte real
- Tela "Metas" com cards expansivos
- Microanimações em todas as transições (Framer Motion)
- Números que "contam" ao carregar (rolling number effect)
- Cards que aparecem em cascata (stagger)
- Tela "Contas" com:
  - Cards por banco
  - Quebra de despesas por método de pagamento
  - Insight callouts inteligentes
- Notificações push (via service worker)
- Export de relatório mensal PDF
- Atalhos de teclado no desktop (cmd+N pra nova transação, etc.)

### Fase 6 — IA pontual (futuro, sem pressa)

**Adicionar SÓ quando aparecer dor real:**

- Categorização inteligente de transações onde regras falham (Claude/OpenAI Haiku/Mini)
- OCR de comprovante via foto (Vision API)
- Chat conversacional com os dados (function calling)

Por ora, NÃO implementar. Reservar variável `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` no `.env` vazia, pronta pra preencher.

---

## 8. Mecânicas críticas explicadas

### A Selic e o cálculo diário

**Por que é especial:** a maioria dos apps mostra "saldo no Tesouro Selic", mas não atualiza diariamente. O nosso atualiza.

**Como funciona:**

1. Edge Function `update-selic` roda diariamente às 07:00 BRT:
   ```
   GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json
   ```
2. Insere o valor na tabela `indexer_history` (date, value).
3. Para cada `investment` com `indexer = 'selic'`:
   - Calcula taxa diária: `(1 + selic_anual)^(1/252) - 1`
   - Aplica ao `current_balance`: `new_balance = old_balance × (1 + daily_rate)`
   - Atualiza `current_balance`

4. Na UI, o saldo no card "ao vivo" tem um microincremento contínuo via JavaScript que estima rendimento por segundo (`daily_yield / (8 * 3600)`) — meramente cosmético, mas dá a sensação visceral de "dinheiro respirando". O saldo "real" persistido só atualiza na rotina diária.

**Importante:** sempre que mostrar rendimento, mostrar líquido (descontado IR conforme prazo do investimento).

### Transferências espelhadas

Quando o usuário cria uma transferência (ex: Tesouro Selic → Itaú CC, R$ 1.500):

```sql
BEGIN;
INSERT INTO transactions (account_id, kind, amount, transfer_pair_id, ...)
VALUES ('tesouro_selic_account_id', 'transfer', 1500, 'new_uuid', ...);

INSERT INTO transactions (account_id, kind, amount, transfer_pair_id, ...)
VALUES ('itau_cc_account_id', 'transfer', 1500, 'new_uuid', ...);
COMMIT;
```

Ambas têm o mesmo `transfer_pair_id`. Nos relatórios de "receita/despesa do mês", **transferências são filtradas fora** (não inflam números). No saldo de cada conta, ambas afetam normalmente (uma sai, outra entra).

### Detecção de gastos atípicos

Algoritmo simples e eficaz:

```javascript
function detectAnomalies(transactions, currentMonth) {
  const byCategory = groupBy(transactions, 'category_id');

  for (const [catId, txs] of byCategory) {
    const currentMonthTotal = sumThisMonth(txs);
    const last3MonthsAvg = avgOfLast3Months(txs);

    if (currentMonthTotal > last3MonthsAvg * 1.5 && currentMonthTotal > 100) {
      yield {
        category_id: catId,
        message: `Gasto ${pct}% acima da média`,
        severity: 'medium'
      };
    }
  }
}
```

Rodar isso no carregamento da Home (ou em background). Mostrar UM cartão de insight por vez na home; se houver múltiplos, fila com priorização.

### Projeção de fim de mês

```javascript
function projectMonthEnd(transactions, today) {
  const daysElapsed = today.getDate();
  const daysInMonth = lastDayOfMonth(today);
  const remainingDays = daysInMonth - daysElapsed;

  const incomeThisMonth = sumIncome(transactions);
  const expensesThisMonth = sumExpenses(transactions);

  const dailyExpenseRate = expensesThisMonth / daysElapsed;
  const projectedExpenses = expensesThisMonth + (dailyExpenseRate * remainingDays);

  // Não projetamos receitas — geralmente são pontuais (salário) e já caíram ou não vão cair
  return {
    projected_balance: incomeThisMonth - projectedExpenses,
    confidence: daysElapsed > 7 ? 'high' : 'low'
  };
}
```

Se confidence é low (começo do mês), mostrar com indicação visual de "estimativa preliminar".

---

## 9. Liberdade explícita para Claude

Coisas em que Claude **deve decidir sozinho** baseado em julgamento técnico:

- **Estrutura interna de componentes:** atomic design, feature folders, ou outra estrutura. Sua escolha.
- **Naming de variáveis, funções, arquivos.** Convenções consistentes, sua escolha.
- **Microanimações específicas:** quais elementos animam, com que timing, qual easing. Inspire-se no protótipo HTML mas refine.
- **Componentes específicos do shadcn/ui a usar:** Dialog, Drawer, Sheet, Popover — escolha o que faz sentido em cada caso.
- **Estratégia de fetching de dados:** TanStack Query padrões, otimistic updates, suspense boundaries.
- **Schema de migrations:** ordem, nomes, padrões.
- **Edge functions:** qual roda quando, frequência, error handling.
- **Empty states, loading states, error states:** invente bem.
- **Mensagens de UI:** copy dos botões, placeholders, mensagens de erro. Mantenha o tom editorial.

Coisas que **NÃO mudar sem consultar:**

- Stack escolhida (Next.js, Supabase, Tailwind, shadcn)
- Identidade visual (Fraunces, Geist, JetBrains Mono, paleta sóbria)
- Filosofia dos 3 princípios (atrito zero, uma pergunta por tela, app pensa usuário decide)
- Modelo de dados conceitual (pode refinar, mas não desfazer)
- Sequência das fases (1 → 2 → 3 → 4 → 5)

---

## 10. Começando

### Primeiro prompt sugerido para o Claude Code

Cola esse documento inteiro no Claude Code e diz:

> Esse é o briefing completo do projeto. Quero começar pela Fase 1.
>
> Tarefa imediata:
> 1. Inicializa o projeto Next.js 14 com TypeScript, App Router, Tailwind
> 2. Instala e configura shadcn/ui com a paleta customizada do briefing
> 3. Configura Geist + Fraunces + JetBrains Mono no `app/layout.tsx`
> 4. Cria conta no Supabase Cloud, projeto novo, e me passa as variáveis de ambiente que preciso configurar
> 5. Cria as migrations SQL para as tabelas centrais: households, users, accounts, categories, transactions — com RLS configurado
> 6. Configura auth do Supabase (email/senha + magic link)
> 7. Cria a estrutura de pastas conforme briefing
>
> Pode propor ajustes ao briefing se algo não fizer sentido tecnicamente. Vamos construir isso juntos, eu reviso antes de seguir pra próxima coisa.

### Princípio operacional

Trabalha em **iterações pequenas**. Claude faz uma coisa, mostra, você revisa, valida, segue pra próxima. Não deixa ele fazer 8 horas seguidas sem você ver. O ritmo ideal é tipo:

- Claude faz 30-60 min de trabalho
- Você revisa visualmente o resultado
- Aprova ou ajusta
- Próxima tarefa

Isso evita ter que desfazer muito quando algo sai do norte.

### Quando voltar pra mim

Volta aqui (chat de planejamento) sempre que:
- Tiver dúvida estratégica ("isso aqui faz sentido conceitualmente?")
- Quiser ajustar visão do produto
- Algo no roadmap não estiver claro
- Precisar de um mockup novo de tela
- Quiser conversar sobre uma feature antes de implementar

O Claude no VS Code é executor. Eu sou o time de produto. Use cada um pro que faz melhor.

---

## 11. Anexos

### A. Protótipo HTML de referência

Arquivo: `patrimonio.html` (anexo separado)

Esse HTML é a referência visual viva. Cores, tipografia, microanimações, espaçamentos, hierarquia — tudo está expresso nele. Use como espelho, não como amarra.

### B. Schema SQL inicial (sugestão de migration 001)

```sql
-- Create households table
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users profile table (linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "users see their household" ON households
  FOR ALL USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "users see household members" ON users
  FOR ALL USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- ... seguir pra accounts, categories, transactions, etc.
```

Claude vai expandir isso.

### C. Variáveis de ambiente esperadas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI (vazias por enquanto, futuro)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Brapi (cotações B3, futuro Fase 3)
BRAPI_TOKEN=

# App
NEXT_PUBLIC_APP_URL=https://financas.mcalimanc.com
```

### D. Glossário rápido

- **DY** (Dividend Yield): rendimento anual em % sobre o valor investido
- **Selic**: taxa básica de juros do Brasil, definida pelo Copom
- **CDI**: taxa de referência do mercado, geralmente 0,1 ponto abaixo da Selic
- **IR regressivo**: imposto de renda em renda fixa, alíquota diminui conforme prazo (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima)
- **FII**: Fundo de Investimento Imobiliário
- **PWA**: Progressive Web App, instalável como app nativo
- **RLS**: Row Level Security, controle de acesso a nível de linha no Postgres

---

**Fim do briefing.**

A visão está clara. As decisões críticas estão tomadas. A liberdade técnica está dada.
Hora de construir.
