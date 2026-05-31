# ROADMAP — Finanças → SaaS, todas as dimensões em 10/10

> Plano de refatoração completa para levar o app de finanças pessoais a um **SaaS público pronto**: nota **10/10 em todas as 11 dimensões** do postmortem, com a camada de **billing 100% construída e engatilhada** — faltando *só* criar a conta Stripe e plugar as chaves. Cada item entrega com **migration + teste + rollback**: a regra é não deixar nada em "8".

_Gerado a partir de um planejamento multi-agente (11 planejadores, um por dimensão, lendo o código real + os achados do postmortem). 157 tarefas, ~177 dias-pessoa._

---

## 1. Sumário executivo

| Dimensão | Hoje | Meta | Esforço | O gargalo que trava a nota |
|----------|:----:|:----:|:-------:|----------------------------|
| **Billing / monetização** | 1.0 | 10 | 14d | Não existe — só schema. Construir tudo, Stripe pendente de conta. |
| **Motor de IR (IRPF) genérico** | 3.0 | 10 | 28d | Subtributa em silêncio: descarta renda sem categoria, trata aluguel como isento. **Risco legal.** |
| **Performance e escala** | 3.0 | 10 | 14d | 122 RLS policies sem `(select …)`; agregadores re-executam aninhados. |
| **Observabilidade / ops + CI/CD** | 3.5 | 10 | 13d | App é cego: zero Sentry, zero error boundary, migrations no `psql` do laptop. |
| **Integridade financeira (multimoeda)** | 3.5 | 10 | 16d | Transferência cross-currency corrompe saldo; 0 teste nos caminhos de dinheiro. |
| **Jobs/cron em escala** | 3.5 | 10 | 19d | Loop sequencial numa invocação serverless de 10s; deps externas abortam o batch. |
| **Auth / ciclo de vida** | 4.0 | 10 | 11d | Bootstrap falho deixa conta órfã; signup sem anti-abuso; e-mail não-verificado passa. |
| **Segurança / custo (IA)** | 4.0 | 10 | 11d | 3 rotas OpenAI sem rate-limit/cota → custo aberto. |
| **LGPD / privacidade** | 4.0 | 10 | 18d | Export cobre 14 de ~48 tabelas; consentimento é overlay cosmético; exclusão é fila manual. |
| **UX / onboarding / i18n** | 5.0 | 10 | 22d | Zero lib i18n, timezone fixo em SP, onboarding travado em CPF, sem landing pública. |
| **Multi-tenancy / RLS** | 7.5 | 10 | 11d | Falta guard no banco nas RPCs admin + prova de isolamento por teste. |
| **TOTAL** | **3.8** | **10** | **177d** | |

**Leitura do esforço.** ~177 dias-pessoa ≈ **8 meses com 1 dev** ou **~4–5 meses com 2 devs** trabalhando as dimensões em paralelo dentro de cada fase. Não é um número para assustar — é o custo real de transformar um app de 1 dono num produto que cobra de estranhos e guarda o dinheiro deles. A maior fatia (IR, 28d) é também o maior diferencial **e** o maior risco; a menor pendência (billing) é a mais estratégica.

**Premissa de qualidade (o que "10/10" significa aqui).** Para cada dimensão, 10 = *(a)* o buraco identificado no postmortem fechado na causa-raiz (não no sintoma), *(b)* coberto por teste automatizado que **falha** se a regressão voltar, *(c)* com migration idempotente + rollback documentado, e *(d)* observável em produção (erro não morre sem rastro). Sem os quatro, a dimensão fica em "8" — e o objetivo explícito é não deixar "8".

---

## 2. Decisões do dono (gating)

Estas decisões **destravam** o início de várias frentes. A recomendação está em cada uma; o que precisa de você é confirmar ou ajustar. Agrupadas por urgência.

### 2.1 — Bloqueiam a Fase 0 (infraestrutura). Decidir primeiro.

| # | Decisão | Recomendação |
|---|---------|--------------|
| D1 | **Backend de rate-limit:** RPC atômica em Postgres vs Upstash Redis. | Postgres RPC para cota de IA por household (transacional, zero infra nova) + Upstash só se quiser throttle por IP em rotas públicas/auth. |
| D2 | **Provider de observabilidade.** | Sentry (`onRequestError` nativo no Next 16, free 5k erros/mês). |
| D3 | **Projeto Supabase de STAGING separado** + alinhar histórico de migrations (as 88 foram via Management API; pode precisar de `migration repair`). | Criar staging dedicado; nunca rodar `db push` contra prod antes de validar em staging. |
| D4 | **Plano Vercel:** Pro (~US$20/mês) vs Hobby. Hobby limita 2 crons e 10s de timeout — já violado hoje. | Vercel Pro: praticamente obrigatório para SaaS público (mais crons, `maxDuration` maior). |
| D5 | **Provider de fila de jobs:** QStash vs Inngest vs Trigger.dev vs tabela-própria. | QStash (retry/DLQ/assinatura prontos, casa com Vercel) + tabela `job_queue` como fonte da verdade. |
| D6 | **Versão de Node** a fixar (`.nvmrc`). | 22 LTS. |

### 2.2 — Bloqueiam a Fase 1 (correção crítica / IR / dinheiro).

| # | Decisão | Recomendação |
|---|---------|--------------|
| D7 | **Motor de IR fail-loud vs fail-silent:** renda não classificada bloqueia/avisa, ou some? | **Fail-loud.** Fora da base + warning + confirmação no "modo revisão" antes de fechar a declaração. Sem isso não há 10/10 jurídico. |
| D8 | **"Modo revisão" obrigatório?** Bloqueia o export final até zerar pendências, ou só avisa? | Bloquear o **export/imposto final**; dashboard mostra estimativa marcada como "provisória — N rendas a revisar". |
| D9 | **Aluguel de PF:** auto-incluir na base anual ou direcionar pro carnê-leão? | Direcionar pro carnê-leão (já deduz condomínio/IPTU); avisar quando há aluguel solto fora dele. |
| D10 | **Profundidade do MEI no v1:** só parcela isenta por presunção, ou escrituração completa? | Só presunção (cobre ~90%) + campo manual de "lucro contábil" opcional. |
| D11 | **Idade/moléstia grave do titular:** onde guardar e se exige laudo. | Perfil de declarante com `birth_date` + flag; moléstia grave por auto-declaração com aviso (dado sensível → cuidado LGPD). |
| D12 | **Política cross-currency:** usuário informa valor recebido na conta destino (a), app converte pela cotação (b), ou bloqueia (c). | (a) com fallback opcional para cotação — mais preciso, nunca corrompe saldo. |
| D13 | **Overpayment de dívida:** permitir saldo negativo (crédito) ou clampar em zero? | `debt_applied_amount` para reversão exata + clamp em zero na exibição. |
| D14 | **Fonte de câmbio para o IR:** BCB/PTAX (exigida pela Receita) vs Frankfurter/ECB. | PTAX para Bens e Direitos; ECB segue ok para display. |
| D15 | **Guard das RPCs admin (RLS):** afrouxar pro service-role (A) ou migrar admin para client autenticado + guard estrito (B). | (B) — fecha o buraco no banco, sem depender do guard em TS. |
| D16 | **Contratar revisão tributária externa.** É o item que de fato fecha o risco jurídico. | Sim antes do lançamento público — sem parecer, o teto realista do IR é ~8/10. |

### 2.3 — Bloqueiam a Fase 2 (billing / contas).

| # | Decisão | Recomendação |
|---|---------|--------------|
| D17 | **Catálogo de planos e preços (BRL):** quais tiers, o que cada um libera, limites do free (contas/membros/transações). | Definir Free + Pro + Family; "lifetime" como admin-grant, não público. |
| D18 | **Trial:** quantos dias, exige cartão, permite promo codes. | 14 dias sem cartão. |
| D19 | **Dunning:** cadência de e-mails e grace period do `past_due` antes de cortar; suspenso vira read-only ou bloqueado. Quais features são write-gated. | D+1/D+3/D+7, corta em D+10; suspenso = **read-only** (nunca bloquear leitura/export — direito LGPD). |
| D20 | **Política de reembolso** (CDC art. 49 = 7 dias) e citar Stripe como suboperador na Privacidade. | Sim aos dois. |
| D21 | **Captcha do signup:** Cloudflare Turnstile vs hCaptcha; modo do widget. | Turnstile, modo non-interactive (menos fricção). |

### 2.4 — Bloqueiam a Fase 3/4 (LGPD / escala / i18n).

| # | Decisão | Recomendação |
|---|---------|--------------|
| D22 | **Exclusão de conta:** imediata (com reauth) vs grace period de 7–15 dias (soft-deactivate + cron). | Grace de 7 dias com soft-deactivate (campos `is_active`/`deactivated_at` já existem) + reauth obrigatório. |
| D23 | **Household multi-membro ao excluir/rebaixar:** quem perde acesso. | Único membro → apaga tudo; com outros → remove só o user e transfere ownership, registrando no audit. |
| D24 | **Dados do contador no export do titular** (transparência art. 18). | Sim — incluir e cascatear no delete. |
| D25 | **Nomear DPO/Encarregado** + canal LGPD; prazos de retenção (prova de eliminação, audit, e-mail). | Obrigatório para SaaS público; revisão por advogado antes do lançamento. |
| D26 | **i18n agora (pt-BR + en-US) ou só arquitetado?** IRPF vira módulo gated por país. | i18n agora + timezone auto-detect com override; IRPF gated por residência fiscal BR. |
| D27 | **BRAPI:** assinar plano pago ou capar tickers/refresh por household no free. | Cap por household no free + alerta de quota; avaliar plano pago conforme crescer. |
| D28 | **Login social (Google)** e confirmação de e-mail bloqueante vs não-bloqueante. | Google + confirmação não-bloqueante (reduz fricção sem abrir mão da verificação). |

---

## 3. Billing — modelo "engatilhado" (a única pendência intencional)

O pedido é claro: **construir tudo, deixar pronto, e a única coisa que falta ser você criar a conta Stripe.** O plano de billing entrega exatamente isso. Tudo abaixo é **codado e testável com chaves de teste do Stripe (`sk_test_…`) e price IDs placeholder**:

- ✅ Catálogo de planos + entitlements central (`lib/billing/plans.ts` + `services/entitlements.ts`) — **único** lugar que decide o que cada tier libera.
- ✅ Cliente Stripe server-only, server action de **checkout**, server action de **customer portal**.
- ✅ **Webhook handler** com verificação de assinatura + tabela `stripe_webhook_events` (idempotência e ordem de eventos). **A fonte da verdade do estado de assinatura é o webhook**, nunca o checkout client-side.
- ✅ **Gating por tier** aplicado nas server actions/rotas + enforcement de status (`past_due` → read-only).
- ✅ Página de billing self-service (`/configuracoes/billing`), **trial**, **dunning/suspensão** por cron, **e-mails de cobrança**.
- ✅ Integração com a UI admin (`updateSubscription`, MRR) + textos legais + página pública de planos.
- ✅ Testes E2E com Stripe test-mode + fixtures de webhook.

**Tudo isso fica atrás de uma flag:** `NEXT_PUBLIC_STRIPE_BILLING_ENABLED`. Com a flag desligada, o app roda 100% sem billing (como hoje). Quando você criar a conta:

> **Checklist "ligar o billing" (≈30 min, sem código):**
> 1. Criar conta Stripe → pegar `STRIPE_SECRET_KEY`.
> 2. Criar os produtos/preços no dashboard Stripe → copiar os 3 `STRIPE_PRICE_*`.
> 3. Registrar o endpoint do webhook → copiar `STRIPE_WEBHOOK_SECRET`.
> 4. Configurar o Customer Portal (upgrades/downgrades/proração) no dashboard.
> 5. Preencher as 6 env vars na Vercel + ligar `NEXT_PUBLIC_STRIPE_BILLING_ENABLED=true`.
> 6. Pronto — checkout, portal, dunning e gating entram no ar.

Nenhuma linha de código fica pendente. A pendência é só de **conta + 6 variáveis**.

---

## 4. Fundações compartilhadas (Fase 0 — desbloqueia todo o resto)

Várias dimensões pedem a mesma infra. Construir **uma vez**, no começo, evita retrabalho e é pré-requisito técnico do restante:

| Fundação | Serve a | Entregável |
|----------|---------|-----------|
| **CI/CD + branch protection + staging** | OBS, FIN, RLS, LGPD, UX | `.github/workflows/ci.yml` (typecheck+lint+test em PR) + deploy de migrations versionado via Supabase CLI; aposenta o `db-push.sh` manual. |
| **Validação de env (fail-fast)** | OBS + todas | `lib/env.ts` (Zod) valida no boot; `.env.example` completo. |
| **Observabilidade** | OBS + todas | Sentry (`instrumentation.ts` + `onRequestError`) + `error.tsx`/`global-error.tsx` + `lib/logger.ts` estruturado, com redaction de PII. |
| **Rate-limit base** | SEC, AUTH, OBS, CRON | `lib/rate-limit.ts` + RPC `consume_rate_limit` (ou Upstash) — decisão D1. |
| **Resiliência de deps externas + fila** | CRON, BILL (dunning), LGPD (deletion) | `lib/external/resilient-fetch.ts` (timeout+retry+circuit-breaker, sempre degrada) + tabela `job_queue`/`cron_runs` + cliente QStash. |
| **Harness de teste de SQL/RPC + integração** | FIN, RLS, LGPD | Postgres efêmero (`supabase start`/pgTAP) + infra de teste de integração que prova isolamento RLS e caminhos de dinheiro. Roda no CI. |

> **Atenção de sequência:** o item mais arriscado da Fase 0 é alinhar o histórico de migrations entre o que está em produção e o que o Supabase CLI conhece (as migrations foram aplicadas via Management API). Fazer **primeiro em staging**, possivelmente com `supabase migration repair`, antes de apontar qualquer pipeline para produção.

---

## 5. Faseamento por caminho crítico

As dimensões agrupam-se em 5 fases por **dependência + risco**. Dentro de cada fase, as dimensões podem correr em paralelo (com 2 devs). A ordem entre fases é a ordem de execução recomendada.

```
FASE 0 — Fundações            OBS (CI/CD, Sentry, env), bases de rate-limit/fila/teste
   │                          → desbloqueia testes, deploy seguro e observabilidade de tudo
   ▼
FASE 1 — Correção crítica     IR (fail-loud, perfis)  ·  FIN (multimoeda + testes $)  ·  RLS (isolamento provado)
   │  "não pode ir a público errado: subtributação e corrupção de saldo são showstoppers"
   ▼
FASE 2 — Habilitação SaaS     BILL (engatilhado)  ·  AUTH (ciclo de vida)  ·  SEC (cota de IA + hardening)
   │  "agora dá pra cadastrar, cobrar e proteger o custo"
   ▼
FASE 3 — Conformidade & escala  LGPD (export/delete/consent reais)  ·  PERF (RLS+memo+índices)  ·  CRON (fila por household)
   │  "aguenta volume e respeita a lei"
   ▼
FASE 4 — Internacionalização & verificação   UX/i18n (pt-BR+en-US, a11y, landing)  ·  golden tests IR  ·  load tests  ·  revisão jurídica
      "polimento, alcance e as provas finais que fecham o 10/10"
```

**Por que esta ordem.** As fundações (0) tornam tudo testável e implantável com segurança. As correções de **subtributação (IR)** e **corrupção de saldo (FIN)** vêm antes de qualquer usuário novo porque são erros que *custam dinheiro real ou exposição legal* — não dá para escalar um bug desses. **RLS** entra na Fase 1 junto porque "provar isolamento" é barato e bloqueante para multi-tenancy. Só então (Fase 2) abre-se o funil de aquisição (billing/auth/segurança de custo). LGPD/PERF/CRON (Fase 3) endurecem para volume e lei. UX/i18n e as verificações finais (Fase 4) ampliam alcance e assinam o 10/10.

**Marcos verificáveis:**
- **Fim da Fase 0:** todo PR roda CI verde; um erro proposital em staging aparece no Sentry com `user_id`/`household_id`; migration sobe por pipeline, não pelo laptop.
- **Fim da Fase 1:** suíte de golden tests do IR passa para todos os perfis; nenhuma transferência cross-currency corrompe saldo; teste de isolamento cross-tenant **falha** ao tentar vazar (como esperado).
- **Fim da Fase 2:** com `BILLING_ENABLED=true` + chaves de teste, um usuário assina, é cobrado (test-mode), some o acesso de escrita ao virar `past_due`; cota de IA bloqueia ao estourar o orçamento.
- **Fim da Fase 3:** export traz as ~48 tabelas; `delete_account_complete` não deixa órfão (provado por teste); cron processa 500 households sem timeout.
- **Fim da Fase 4:** app em en-US, axe sem violações críticas, landing pública no ar, p95 do dashboard sob a meta no k6, parecer jurídico do IR arquivado.

---

## 6. Planos detalhados por dimensão

Cada dimensão abaixo traz: estratégia, tarefas **já ordenadas por dependência** (com esforço, arquivos a tocar e decisão embutida quando houver) e riscos de execução. As tarefas dentro de cada dimensão devem ser executadas na ordem listada.


### IR — Motor de IR (IRPF) genérico e correto pra qualquer perfil

> **Score atual 3/10 → meta 10/10**  ·  **28 dias-pessoa**  ·  **12 tarefas**  ·  entra na **Fase 1**


**Estratégia.** A raiz do problema não é a aritmética da tabela (essa está boa e já é dinâmica por ano no banco), e sim a CLASSIFICAÇÃO de rendimentos: o pipeline em services/ir/rendimentos.ts descarta silenciosamente renda sem categoria/fonte conhecida e empurra aluguel pra isento por uma regra de seed equivocada. A estratégia tem 4 frentes em ordem: (1) trocar o catch-all silencioso por uma classificação explícita com bucket "não classificado" + avisos (warnings) que NUNCA somem da UI, eliminando subtributação invisível; (2) introduzir um "modo revisão" persistido (tabela ir_income_classifications) onde o usuário confirma cada renda ambígua antes do cálculo entrar na declaração; (3) cobrir os perfis faltantes (aposentado 65+, moléstia grave, 13º exclusivo, MEI/distribuição, autônomo livro-caixa) com regras reais de isenção parametrizadas por ano no banco; (4) blindar tudo com uma suíte de cenários por perfil (golden tests) e refatorar o redutor da Lei 15.270/25 pra usar a apuração mensal real. Decisão central do dono: o motor deve ser FAIL-LOUD (renda não classificada bloqueia/avisa) em vez de fail-silent — sem isso não há como atingir 10/10 com segurança jurídica.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Extrair classificação de income-tx pra função pura testável + bucket 'naoClassificado'** | L | — | `services/ir/rendimentos.ts`, `services/ir/classify-income.ts` |
| 2 | **Corrigir misclassificação de aluguel: aluguel recebido é TRIBUTÁVEL (carnê-leão), não isento** | M | Extrair classificação de income-tx pra função pura | `services/ir/classify-income.ts`, `supabase/migrations/20260601000000_fix_aluguel_category.sql`, `supabase/migrations/20260526030000_seed_defaults_for_new_users.sql`, `supabase/migrations/20260529110000_more_categories.sql` |
| 3 | **Match de categoria por aliases/normalização em vez de Set de igualdade exata** | M | Extrair classificação de income-tx pra função pura | `services/ir/income-aliases.ts`, `services/ir/classify-income.ts` |
| 4 | **Regras de isenção por perfil: aposentado 65+, moléstia grave, 13º exclusivo** | L | Corrigir misclassificação de aluguel | `services/ir/exencoes.ts`, `services/ir/rendimentos.ts`, `supabase/migrations/20260602000000_ir_profile_exemptions.sql` |
| 5 | **Suporte a MEI / distribuição de lucros / autônomo livro-caixa (sem heurística de string)** | L | Regras de isenção por perfil | `services/ir/rendimentos.ts`, `services/ir/mei-distribuicao.ts`, `supabase/migrations/20260603000000_mei_distribuicao.sql` |
| 6 | **Persistir classificação no 'modo revisão' (ir_income_classifications) + confirmação do usuário** | XL | Suporte a MEI / distribuição de lucros / autônomo livro-caixa | `supabase/migrations/20260604000000_ir_income_classifications.sql`, `services/ir/classify-income.actions.ts`, `services/ir/rendimentos.ts`, `app/(app)/ir/revisao/page.tsx` |
| 7 | **Superfície de avisos: warnings tipados que nunca são silenciados** | M | Persistir classificação no 'modo revisão' | `services/ir/warnings.ts`, `services/ir/imposto.ts`, `services/ir/rendimentos.ts`, `app/(app)/dashboard/page.tsx` |
| 8 | **Refatorar redutor da Lei 15.270/25 pra apuração mensal real (consolidação anual)** | M | — | `services/ir/imposto.ts`, `lib/financial/irpf-monthly-table.ts`, `supabase/migrations/20260605000000_redutor_params.sql` |
| 9 | **Auto-rollforward de tabelas IRPF + tabelas históricas (anos < 2024)** | M | Refatorar redutor da Lei 15.270/25 | `services/ir/ir-tax-tables.ts`, `supabase/migrations/20260606000000_seed_historical_tax_tables.sql`, `app/(app)/ir/tabelas/page.tsx` |
| 10 | **Mover limiares de cripto/exterior pra banco + implementar variação cambial** | L | Auto-rollforward de tabelas IRPF | `services/ir/exterior-crypto.ts`, `services/ir/renda-variavel.ts`, `supabase/migrations/20260607000000_ir_tax_table_capital.sql` |
| 11 | **Suíte de golden tests por perfil (cenários reais ponta a ponta)** | XL | Superfície de avisos | `services/ir/__tests__/perfis.test.ts`, `services/ir/__tests__/classify-income.test.ts`, `services/ir/__tests__/redutor.test.ts` |
| 12 | **Revisão jurídica externa + documentação de base legal e disclaimer** | L | Suíte de golden tests por perfil | `docs/ir-regras.md`, `services/ir/dec-export.ts`, `app/(app)/ir/page.tsx` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Extrair classificação de income-tx pra função pura testável + bucket 'naoClassificado'** — _L · 2-3d_  
Refatorar o loop de txsAgg em rendimentos.ts (linhas 165-251) extraindo a decisão de bucket pra uma função pura classifyIncomeTx(agg, ctx) -> { bucket: 'tributavel'|'isento'|'exclusivo'|'naoClassificado', receitaCode?, confidence: 'alta'|'baixa', reason: string }. Adicionar um 4o array `naoClassificados: RendimentoRow[]` ao RendimentosReport e ao tipo de retorno. Toda renda que hoje cai no else-vazio (sem categoria salário/aluguel, sem fonte, sem keyword) passa a ir EXPLICITAMENTE pra naoClassificados com reason='categoria desconhecida' — nunca mais é descartada. Importante: naoClassificados NÃO entra em nenhum total de imposto, mas o gross aparece somado num campo total + dispara warning. Manter a assinatura de getRendimentosReport.  
⚠️ _Decisão do dono:_ Política do bucket não-classificado: tratar como 'tributável por precaução' (mais conservador, evita subtributar) OU manter fora da base mas com warning bloqueante? Recomendo: fora da base + warning + exigir confirmação no modo revisão antes de fechar a declaração.  

**2. Corrigir misclassificação de aluguel: aluguel recebido é TRIBUTÁVEL (carnê-leão), não isento** — _M · ~1d_  
Dois pontos: (a) migration nova que corrige a regra de seed — a linha 130 de 20260526030000 mapeia 'aluguel receb' -> c_renda_passiva; criar categoria 'Aluguel recebido' (income) no seed_default_categories e remapear a regra 'aluguel receb' pra ela; backfill nas households existentes. (b) Em classify-income.ts, qualquer categoria que case com aluguel ('aluguel','aluguéis','locação') vai pra tributável com aviso 'aluguel de PF é tributável via carnê-leão, confira se já está no carnê-leão pra não duplicar'. (c) Restringir a regra `e.cat.includes('renda passiva')` -> isento APENAS pra dividendos/lucros reais: separar 'Renda passiva' (genérica, vira naoClassificado com confidence baixa) de 'Dividendos' (isento código 09). Cuidado com double-count: se a mesma renda também vier de carne_leao_mensal, evitar somar duas vezes.  
⚠️ _Decisão do dono:_ Aluguel de PF deve ser auto-incluído na base tributável anual OU forçar o usuário a registrá-lo no carnê-leão (que já tem dedução de condomínio/IPTU)? Recomendo direcionar pro carnê-leão e, na revisão, avisar quando há aluguel solto fora dele.  

**3. Match de categoria por aliases/normalização em vez de Set de igualdade exata** — _M · ~1d_  
Substituir SALARY_CATEGORIES/RENT_CATEGORIES (Sets fechados, linhas 63-64) por um matcher tolerante: normalizar (lowercase + strip acentos via String.normalize NFD) e casar contra listas de aliases ('salário','salario','holerite','pró-labore','pro labore','honorários','remuneração','vencimentos' / 'aluguel','aluguéis','locação','arrendamento'). Mover essas listas pra services/ir/income-aliases.ts. Quando NÃO casar nenhum alias e não houver fonte pagadora, ir pra naoClassificado (confidence baixa) em vez de sumir. Cobrir sinônimos PJ ('pró-labore PJ') e aposentadoria.  

**4. Regras de isenção por perfil: aposentado 65+, moléstia grave, 13º exclusivo** — _L · 2-3d_  
Criar services/ir/exencoes.ts com regras parametrizadas por ano (lidas do banco): (a) parcela isenta de aposentadoria/pensão pra maiores de 65 anos — limite mensal R$ 1.903,98 (valor 2024+, parametrizar por ano numa nova coluna/linha de tax_table); precisa saber a idade do titular -> adicionar coluna birth_date ao filer/household profile (ir_filers ou households). (b) isenção por moléstia grave (proventos de aposentadoria/reforma/pensão 100% isentos) — flag por filer. (c) 13º salário: tratar como tributação EXCLUSIVA na fonte (não soma na base progressiva), criar campo próprio e código 'exclusivo'. Hoje thirteenth (linha 408) é só display. Adicionar inputs em ir_other_incomes (já tem thirteenth_amount) e na UI de perfil do filer. Cada regra emite um RendimentoRow no bucket correto + nota explicando a base legal.  
⚠️ _Decisão do dono:_ Onde guardar idade/moléstia grave do titular: criar ir_filers se ainda não há perfil de declarante com data de nascimento, ou adicionar em households. Definir se isenção de moléstia grave exige upload de laudo (compliance) ou só auto-declaração com aviso.  

**5. Suporte a MEI / distribuição de lucros / autônomo livro-caixa (sem heurística de string)** — _L · 2-3d_  
Trocar a heurística isDistribuicaoLucros (rendimentos.ts:178-181, baseada em substring 'distribu'/'lucro' + fonte.type==='pj_propria') por um campo EXPLÍCITO. Estender o enum de fontes_pagadoras.type ou ir_other_incomes.category com: 'distribuicao_lucros_mei' (parcela isenta limitada ao lucro presumido conforme regime), 'pro_labore', 'livro_caixa_autonomo'. Para autônomo: usar carnê-leão (já existe) mas garantir que despesas de livro-caixa entrem como deductible_expenses com categoria adequada. Para MEI: parcela isenta da distribuição = receita bruta menos % do regime (comércio 8%, serviços 32%, etc.) menos imposto pago, ou o lucro contábil se houver escrituração — parametrizar os percentuais numa tabela mei_isencao_percentuais por atividade. O excedente da parcela isenta é tributável. Emitir aviso quando o usuário declara distribuição sem informar a base de cálculo.  
⚠️ _Decisão do dono:_ Profundidade do suporte MEI no v1: só a parcela isenta por percentual de presunção (simples, cobre 90% dos MEIs) OU também escrituração contábil completa? Recomendo só presunção no v1 + campo manual de 'lucro contábil' opcional.  

**6. Persistir classificação no 'modo revisão' (ir_income_classifications) + confirmação do usuário** — _XL · 1sem+_  
Criar tabela ir_income_classifications (id, household_id, owner_filer_id, year, source_kind, source_key/dedupe key estável por fonte+categoria+descrição, bucket_confirmado, receita_code, confirmed_at, confirmed_by). getRendimentosReport passa a sobrepor a classificação automática pela confirmada quando existir. Server action ir/classify-income.actions.ts pra confirmar/recategorizar. Regra de fechamento: a declaração só é considerada 'pronta'/exportável (dec-export.ts) se não houver naoClassificados nem renda ambígua (confidence baixa) pendente de confirmação. UI: aba 'Revisão de rendimentos' listando cada renda, seu bucket sugerido, o motivo, e botões pra confirmar/mudar.  
⚠️ _Decisão do dono:_ O modo revisão é obrigatório (bloqueia export/cálculo final até zerar pendências) ou só recomendado com banner? Pra 10/10 jurídico recomendo bloquear o EXPORT/'imposto final' mas deixar o dashboard mostrar uma estimativa marcada como 'provisória — N rendas a revisar'.  

**7. Superfície de avisos: warnings tipados que nunca são silenciados** — _M · ~1d_  
Definir tipo IRWarning { code, severity: 'info'|'warning'|'blocker', message, sourceRef }. getRendimentosReport e computeImposto passam a retornar warnings[]. Emitir blocker quando: há naoClassificados com gross>0; aluguel solto fora do carnê-leão; distribuição MEI sem base; ano sem tabela cadastrada. Propagar até a UI. CRÍTICO: trocar o `computeImposto(currentYearForState).catch(() => null)` no dashboard (app/(app)/dashboard/page.tsx:131) por tratamento que distingue 'tabela ausente' (mostra CTA 'cadastre o ano') de erro real (loga via Sentry) — nunca mais 'o IR sumiu sem explicação'.  

**8. Refatorar redutor da Lei 15.270/25 pra apuração mensal real (consolidação anual)** — _M · ~1d_  
computeRedutorAnual (imposto.ts:277-292) usa fórmula caseira fracao=(88200-renda)/(88200-60000) que diverge do oficial na faixa R$60k-88,2k. Substituir pela apuração correta: o redutor anual é a SOMA dos redutores mensais (computeRedutorMensal já existe em lib/financial/irpf-monthly-table.ts e está alinhado com a lei: ≤R$5k -> R$312,89; R$5k-7,35k -> 978,62-0,133145*renda). Computar o redutor anual a partir da distribuição mensal da renda tributável (12 competências) em vez de uma fração linear sobre o anual. Onde não houver granularidade mensal (renda anual agregada), aproximar por renda/12 e aplicar a fórmula mensal, documentando a aproximação. Parametrizar os limiares (5000/7350/312.89/0.133145) numa coluna redutor_params JSONB de ir_tax_table_annual em vez de hardcode, pra anos futuros.  
⚠️ _Decisão do dono:_ Como obter a distribuição mensal da renda quando o usuário só informou totais anuais (ir_other_incomes não tem mês)? Decidir entre: assumir 13 competências iguais (12 + 13º), ou exigir granularidade mensal pra rendas sujeitas ao redutor. Recomendo aproximação renda/12 marcada como estimativa + aviso.  

**9. Auto-rollforward de tabelas IRPF + tabelas históricas (anos < 2024)** — _M · ~1d_  
Eliminar o IRTaxTableNotFoundError pra anos comuns: (a) seedar tabelas históricas 2020-2023 (declaração retificadora) em migration. (b) Criar getAnnualTaxTable com fallback de rollforward: se o ano pedido > último ano cadastrado, clonar a última tabela marcando is_estimate=true e source='estimativa (rollforward do ano X)' em vez de throw — assim janeiro do próximo ano não quebra. (c) Criar uma rota/admin services/ir/tax-table-status.ts + página /ir/tabelas mostrando quais anos são oficiais vs estimativa. (d) Job/checklist anual pra atualizar tabelas reais quando a lei sair.  
⚠️ _Decisão do dono:_ Rollforward automático (estimativa) vs throw explícito pra anos futuros? Recomendo rollforward com is_estimate=true + banner bem visível 'tabela estimada, sujeita a ajuste' — nunca calcular calado.  

**10. Mover limiares de cripto/exterior pra banco + implementar variação cambial** — _L · 2-3d_  
exterior-crypto.ts tem EXTERIOR_RATE=0.15 (:44), CRYPTO_TAX_BRACKETS (:197), CRYPTO_EXEMPTION=35000 (:233) hardcoded e fxVariation:0 //TODO (:179). Criar tabela ir_tax_table_capital (por ano: exterior_rate, crypto_brackets jsonb, crypto_exemption_mensal, swing_exemption_20k) e ler dela. Implementar fxVariation real: snapshot do saldo em moeda estrangeira em 01/01 vs 31/12 convertido com câmbio de cada data (a Lei 14.754 tributa a variação cambial do saldo de conta no exterior). Adicionar testes do ganho com câmbio variável.  
⚠️ _Decisão do dono:_ Tributação de variação cambial de conta no exterior (depósito não-aplicado) é tema controverso e depende de a conta render ou não. Definir escopo v1: tratar só variação de ativos vendidos (já parcialmente coberto) e marcar saldo em conta como 'fora do escopo automático, declare manualmente' com aviso.  

**11. Suíte de golden tests por perfil (cenários reais ponta a ponta)** — _XL · 1sem+_  
Criar services/ir/__tests__/perfis.test.ts com fixtures por perfil que validam o RESULTADO do imposto (não só a tabela): (1) CLT puro com IRRF; (2) aposentado 65+ com parcela isenta; (3) moléstia grave 100% isento; (4) autônomo só carnê-leão + livro-caixa; (5) MEI com pró-labore + distribuição isenta + excedente tributável; (6) locador (aluguel PF tributável, não isento — regressão do bug); (7) 'Outras receitas' genérica -> cai em naoClassificado + warning (regressão do descarte silencioso); (8) investidor com dividendos isentos + JCP exclusivo + RF; (9) renda na faixa R$60k-88,2k validando o redutor mensal-consolidado contra valor oficial calculado à mão; (10) declaração em casal. Mockar o supabase client (seguir padrão dos testes existentes que usam funções puras) ou extrair a lógica de classificação/cálculo pra funções puras que recebem os dados já carregados, pra testar sem banco. Cada cenário com o valor esperado verificado contra simulador oficial / cálculo manual documentado no comentário.  

**12. Revisão jurídica externa + documentação de base legal e disclaimer** — _L · 2-3d_  
Antes de cobrar por 'IR automático': (a) revisão por contador/tributarista das regras implementadas (isenções 65+, moléstia grave, MEI, redutor 15.270, carnê-leão, exterior 14.754) — registrar parecer. (b) Documentar em docs/ir-regras.md cada regra com artigo de lei/IN que a fundamenta (já há comentários inline; consolidar). (c) Adicionar disclaimer claro na UI ('estimativa, não substitui declaração oficial / conferência por profissional') e termos de uso. (d) Garantir que dec-export.ts gera dados conferíveis (não preenche a DIRPF automaticamente sem revisão).  
⚠️ _Decisão do dono:_ Contratar revisão tributária externa (custo) é decisão do dono — é o item que de fato fecha o risco jurídico pra virar 10/10 SaaS público. Sem parecer profissional, o teto realista é ~8/10.  

</details>

**Riscos de execução:**
- Double-counting de aluguel: a mesma renda pode existir como transação income E como entrada no carne_leao_mensal — ao tornar aluguel tributável é preciso deduplicar pela mesma chave pra não somar duas vezes na base.
- Mudar a regra de seed de aluguel ('renda passiva' -> 'Aluguel recebido') altera households existentes; o backfill precisa ser idempotente e NÃO recategorizar transações já confirmadas manualmente pelo usuário (respeitar overrides).
- O modo revisão pode virar fricção: se bloquear o cálculo até zerar pendências, usuários abandonam. Mitigar com estimativa provisória sempre visível + bloqueio só no export final.
- Aproximação mensal do redutor (renda/12) diverge do real pra quem tem renda concentrada em poucos meses (ex: 13º, bônus). É preciso marcar como estimativa e, idealmente, usar granularidade mensal quando disponível.
- Isenção por moléstia grave e idade 65+ dependem de dados sensíveis (saúde, idade) — implicações de LGPD; guardar com cuidado e talvez exigir consentimento explícito.
- Sem revisão tributária profissional, qualquer regra implementada errada (ex: percentual de presunção MEI por atividade) reintroduz o risco de subtributação que estamos tentando eliminar — a task de revisão jurídica é gating pra 10/10, não opcional.
- Testar getRendimentosReport/computeImposto exige mockar o Supabase client; se a lógica não for extraída pra funções puras, os golden tests ficam frágeis e acoplados — extrair a classificação/cálculo pra puro é pré-requisito de testabilidade.


### FIN — Integridade financeira (multimoeda) + testes de dinheiro

> **Score atual 3.5/10 → meta 10/10**  ·  **16 dias-pessoa**  ·  **15 tarefas**  ·  entra na **Fase 1**


**Estratégia.** Blindar todo caminho que escreve amount_account ou current_balance: nenhum valor em moeda estrangeira pode virar saldo sem cotação real; transferência cross-currency converte (ou bloqueia) em vez de duplicar o número; triggers de dívida ficam simétricos e date-aware como o de conta. Em paralelo, montar do zero um harness de teste de SQL/RPC contra Postgres efêmero (pgTAP rodando em container) e cobrir cada caminho de dinheiro (trigger de saldo, create_transfer, debt, materialize, fatura, conversão), mais property-tests das funções puras de conversão. Fechar com captura explícita de cotação de 31/12 (BCB) e snapshots reconstruídos, e gate de CI que roda os testes SQL em toda migration. Decisões do dono: fonte de câmbio para IR (BCB PTAX vs ECB), e política de transferência cross-currency (converter automático vs exigir taxa manual vs bloquear).


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Tornar convert() obrigatório no caminho de saldo: substituir convertOrSame por erro explícito em amount_account** | M | — | `lib/financial/currency.ts`, `services/transactions.actions.ts`, `services/inbox/currency-convert.ts` |
| 2 | **Blindar applier de fatura de cartão internacional contra cotação ausente** | M | Tornar convert() obrigatório no caminho de saldo | `services/inbox/appliers/fatura-cartao.ts`, `services/inbox/currency-convert.ts` |
| 3 | **Decidir e implementar política de transferência cross-currency na RPC create_transfer** | L | Tornar convert() obrigatório no caminho de saldo | `supabase/migrations/20260601000000_transfer_cross_currency.sql`, `services/transactions.actions.ts` |
| 4 | **UI: desabilitar/ajustar submit de transferência cross-currency e capturar valor destino** | M | Decidir e implementar política de transferência cross-currency na RPC create_transfer | `components/transactions/add-transaction-dialog.tsx`, `services/transactions.actions.ts` |
| 5 | **Corrigir assimetria do trigger de dívida (clamp na reversão) + date gate** | L | — | `supabase/migrations/20260601010000_debt_trigger_symmetry_and_date.sql`, `supabase/migrations/20260523000000_balance_date_aware.sql` |
| 6 | **Montar harness de teste de SQL/RPC contra Postgres efêmero (pgTAP em container)** | L | — | `supabase/config.toml`, `scripts/db-test.sh`, `tests/sql/_helpers.sql`, `package.json` |
| 7 | **Testes SQL do trigger de saldo de conta (date-aware) e transaction_balance_delta** | M | Montar harness de teste de SQL/RPC contra Postgres efêmero | `tests/sql/balance_trigger.sql` |
| 8 | **Testes SQL de create_transfer (same e cross-currency) e delete_transfer** | M | Decidir e implementar política de transferência cross-currency na RPC create_transfer | `tests/sql/transfer.sql` |
| 9 | **Testes SQL do trigger de dívida (simetria + date gate)** | M | Corrigir assimetria do trigger de dívida (clamp na reversão) + date gate | `tests/sql/debt_trigger.sql` |
| 10 | **Testes SQL de materialize_recurrence (guard de duplicação) e credit_card_bill_amount** | L | Montar harness de teste de SQL/RPC contra Postgres efêmero | `tests/sql/materialize.sql`, `tests/sql/bill_amount.sql` |
| 11 | **Property-tests das funções puras de conversão e dos novos guards (vitest)** | M | Blindar applier de fatura de cartão internacional contra cotação ausente | `lib/financial/__tests__/currency.test.ts`, `services/__tests__/transactions-amount-account.test.ts`, `services/inbox/__tests__/currency-convert.test.ts` |
| 12 | **Cotação BCB/PTAX para IR + captura explícita de 31/12 e correção do fxNote** | L | Tornar convert() obrigatório no caminho de saldo | `app/api/cron/update-rates/route.ts`, `services/ir/bens.ts`, `services/currency.ts`, `vercel.json` |
| 13 | **Patrimônio histórico: usar cotação do mês, não a mais recente** | L | Cotação BCB/PTAX para IR + captura explícita de 31/12 e correção do fxNote | `services/accounts.ts`, `services/patrimonio-history.ts`, `app/api/cron/snapshot-patrimonio/route.ts`, `services/__tests__/patrimonio-history-fx.test.ts` |
| 14 | **Snapshots de 31/12 reconstruídos (não live em 02/01) + cotação de fechamento** | L | Patrimônio histórico: usar cotação do mês, não a mais recente | `app/api/cron/year-end-snapshot/route.ts`, `supabase/migrations/20260601020000_prior_year_fx_columns.sql`, `services/accounts.ts` |
| 15 | **CI gate: rodar vitest + testes SQL em toda migration/PR** | M | Testes SQL de create_transfer (same e cross-currency) e delete_transfer | `.github/workflows/ci.yml`, `scripts/db-test.sh` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Tornar convert() obrigatório no caminho de saldo: substituir convertOrSame por erro explícito em amount_account** — _M · ~1d_  
Criar helper convertOrThrow(value, from, to, rates) em lib/financial/currency.ts que retorna o valor convertido ou lança CurrencyRateMissingError (nova classe exportada) quando convert() devolve null. NÃO remover convertOrSame (segue válido só para EXIBIÇÃO, nunca para escrita de saldo). Em services/transactions.actions.ts (createTransaction L141-143 e updateTransaction L286-288) trocar convertOrSame por convertOrThrow envolto em try/catch que retorna { error: 'Sem cotação de {from}→{to} para {date}. Cadastre a taxa antes de lançar nesta moeda.' } como TxFormState — nunca gravar o número bruto. Idem em services/inbox/currency-convert.ts (convertAmount L25 e computeAmountAccount): propagar o erro para o applier em vez de cair no fallback. Adicionar comentário no JSDoc de convertOrSame: 'PROIBIDO usar para amount_account/current_balance — só display'.  

**2. Blindar applier de fatura de cartão internacional contra cotação ausente** — _M · ~1d_  
Em services/inbox/appliers/fatura-cartao.ts (L167, computeAmountAccount no map de rows), quando a moeda da fatura difere da conta e não há cotação para item.date, NÃO gravar a tx. Estratégia: coletar todos os itens sem taxa, e se houver pelo menos um, abortar o apply inteiro retornando um resultado de erro estruturado (ex.: { ok:false, reason:'missing_fx', pairs:[...], dates:[...] }) que a UI do inbox mostra como 'X itens precisam de cotação EUR→BRL em {datas}'. Garantir atomicidade: o insert das rows já deve estar num único insert/transação — se não estiver, envolver numa RPC apply_fatura ou rejeitar antes de qualquer insert. Verificar o ponto de chamada do applier para propagar o erro até o componente de inbox.  

**3. Decidir e implementar política de transferência cross-currency na RPC create_transfer** — _L · 2-3d_  
Nova migration supabase/migrations/20260601000000_transfer_cross_currency.sql que recria create_transfer com nova assinatura: adicionar p_amount_to numeric default null e p_rate numeric default null. Regra: se v_from.currency = v_to.currency → comportamento atual (amount_account=p_amount nas duas pernas). Se diferentes → exigir p_amount_to (valor creditado na conta destino, na moeda dela) OU p_rate; perna out grava amount_account=p_amount (moeda origem), perna in grava amount_account=p_amount_to (moeda destino), e amount/currency de cada perna refletem a própria moeda. Se moedas diferem e nem p_amount_to nem p_rate vier → raise exception 'cross-currency transfer requires destination amount or rate'. Manter security definer, search_path, grants. Atualizar a chamada em services/transactions.actions.ts (L89-95) passando os novos params. ROLLBACK: a migration deve recriar a versão anterior em caso de revert (guardar corpo antigo comentado ou migration de down em scripts).  
⚠️ _Decisão do dono:_ Política cross-currency: (a) usuário informa o valor recebido na conta destino (mais preciso, recomendado), (b) app converte por cotação do dia automaticamente, ou (c) bloquear totalmente. Recomendo (a) com fallback opcional para cotação. Definir também se p_rate ou p_amount_to é a entrada primária.  

**4. UI: desabilitar/ajustar submit de transferência cross-currency e capturar valor destino** — _M · ~1d_  
Em components/transactions/add-transaction-dialog.tsx: substituir o warning amarelo (L268-275) por um campo de input 'Valor recebido em {toCurrency}' que aparece quando crossCurrencyTransfer é true, com prefill via cotação do dia (convert) mas editável. No submit (L531, onde só desabilita para oneAccount), também desabilitar quando crossCurrencyTransfer e o valor destino estiver vazio/zero. Enviar amountTo no FormData; estender transferSchema em services/transactions.actions.ts (L41-47) com amountTo opcional e rate opcional, e repassar para a RPC. Mostrar a taxa efetiva resultante (amountTo/amount) como texto de apoio.  

**5. Corrigir assimetria do trigger de dívida (clamp na reversão) + date gate** — _L · 2-3d_  
Nova migration supabase/migrations/20260601010000_debt_trigger_symmetry_and_date.sql recriando tg_apply_transaction_to_debt_balance. Dois fixes: (1) Simetria — em vez de greatest(0, balance - amount) só na aplicação, parar de 'pisar no zero': armazenar applied_delta por tx (coluna debt_applied_amount em transactions, default null) gravada na aplicação = min(amount_account, saldo_antes); reversão (UPDATE/DELETE) soma exatamente debt_applied_amount. Isso garante reverter(aplicar(x)) == identidade (resolve o blocker do excesso perdido). (2) Date gate — espelhar o trigger de conta: só aplicar o delta na dívida quando new.date <= today (SP); pagamentos futuros não abatem a dívida até a data chegar; advance_pending_balances deve também promover o delta de dívida (estender a RPC ou criar gatilho análogo). Backfill: recomputar debts.current_balance a partir do estado inicial + soma das txs aplicadas (escrever query de reconciliação na própria migration). ROLLBACK documentado.  
⚠️ _Decisão do dono:_ Overpayment de dívida: permitir saldo negativo (vira crédito) ou clampar em zero e registrar o excedente à parte? Recomendo coluna debt_applied_amount para reversão exata e clamp em zero na exibição.  

**6. Montar harness de teste de SQL/RPC contra Postgres efêmero (pgTAP em container)** — _L · 2-3d_  
Criar supabase/config.toml mínimo (equivalente a supabase init) e um script scripts/db-test.sh que: sobe um Postgres efêmero (supabase start OU docker run postgres:16), aplica TODAS as migrations de supabase/migrations em ordem, instala extensão pgtap, roda os arquivos *.sql de tests/sql/ via pg_prove e derruba o container. Criar tests/sql/_helpers.sql com fábricas (seed de household, account, debt, currency_rates). Adicionar script npm 'test:sql': 'bash scripts/db-test.sh'. Alternativa se Docker indisponível: usar branch efêmera do Supabase — documentar ambas. Este harness é pré-requisito de TODOS os testes de trigger/RPC abaixo.  
⚠️ _Decisão do dono:_ Estratégia de Postgres efêmero: Docker local (postgres:16 + pgTAP) vs `supabase start` (CLI já é devDep) vs branch efêmera Supabase no CI. Recomendo `supabase start` local + Docker no CI por já ter a CLI no projeto.  

**7. Testes SQL do trigger de saldo de conta (date-aware) e transaction_balance_delta** — _M · ~1d_  
tests/sql/balance_trigger.sql (pgTAP): INSERT income/expense passado aplica delta e seta balance_applied_at; INSERT data futura NÃO altera current_balance e deixa balance_applied_at null; advance_pending_balances() promove a futura quando a data chega; UPDATE de valor reverte delta antigo e aplica novo; UPDATE de data futuro→passado aplica, passado→futuro estorna; DELETE de tx aplicada estorna; transfer in/out tem sinal correto. Cobrir round() a 2 casas. Usar is()/results_eq do pgTAP comparando accounts.current_balance esperado.  

**8. Testes SQL de create_transfer (same e cross-currency) e delete_transfer** — _M · ~1d_  
tests/sql/transfer.sql: same-currency debita origem e credita destino pelo mesmo amount_account; cross-currency com p_amount_to credita destino pelo valor em moeda destino e debita origem pelo valor em moeda origem (saldos NÃO inflam por câmbio — asserir current_balance das duas contas e o net worth convertido); cross-currency SEM p_amount_to/p_rate dá raise exception; from=to dá raise; amount<=0 dá raise; delete_transfer remove as duas pernas e estorna ambos os saldos. Este é o teste que prova o blocker [critical] resolvido. Depende do harness e da nova RPC cross-currency.  

**9. Testes SQL do trigger de dívida (simetria + date gate)** — _M · ~1d_  
tests/sql/debt_trigger.sql: pagar dívida de 100 com tx de 150 → saldo vira 0 (ou -50 conforme decisão) e debt_applied_amount=100; DELETE dessa tx volta a dívida para 100 (prova reverter(aplicar)=identidade, blocker [high] resolvido); pagamento com data futura NÃO abate a dívida até a data chegar (date gate); UPDATE mudando debt_id move o abatimento; is_historical_ir_only=true não conta; income/transfer ignorados. Asserir debts.current_balance após cada operação. Depende do harness e do fix do trigger de dívida.  

**10. Testes SQL de materialize_recurrence (guard de duplicação) e credit_card_bill_amount** — _L · 2-3d_  
tests/sql/materialize.sql: rodar materialize_recurrence duas vezes com mesmo p_until_date não duplica (last_materialized_date guard); materializar para data anterior à já materializada não retrocede nem duplica; regra de transfer linka as duas pernas por transfer_pair_id; fatura R$0 (v_count=0) não avança last_materialized_date e é retried; tx com date<app_start_date vira is_historical_ir_only (exceto cartão). tests/sql/bill_amount.sql: credit_card_bill_amount soma expense e SUBTRAI income (estorno) na janela; usa bill_period_end quando presente e cai para date no fallback; pagamento (transfer) fica de fora. Cobrir a integração materialize→credit_card_bill_amount→create_transfer (auto-sync de fatura) ponta a ponta.  

**11. Property-tests das funções puras de conversão e dos novos guards (vitest)** — _M · ~1d_  
Estender lib/financial/__tests__/currency.test.ts: convert() retorna null quando par ausente (direto e inverso); convertOrThrow lança CurrencyRateMissingError; convert(convert(x, A→B), B→A) ≈ x dentro de tolerância (round-trip via taxa direta+inversa). Novo services/__tests__/transactions-amount-account.test.ts (mockando getRateMap/supabase) provando que createTransaction com moeda sem cotação retorna error e NÃO insere; e que com cotação grava amount_account convertido correto. Novo services/inbox/__tests__/currency-convert.test.ts cobrindo convertAmount/computeAmountAccount com e sem taxa.  

**12. Cotação BCB/PTAX para IR + captura explícita de 31/12 e correção do fxNote** — _L · 2-3d_  
Decisão do dono sobre fonte. Adicionar ao cron app/api/cron/update-rates/route.ts (ou novo app/api/cron/update-rates-bcb/route.ts) busca da PTAX do BCB (API olinda PTAX, USD/EUR) com source='bcb_ptax', salvando em currency_rates com a data do boletim. Em services/ir/bens.ts (L390, L481-483, L650-652) trocar getRateMapAt genérico por um getRateAtForIR que EXIGE cotação da fonte exigida (BCB) na data 31/12 do ano-base; se ausente, marcar o bem com flag fxMissing e refletir em report.previousYearIsComplete / um aviso na UI de IR, em vez de convertOrSame silencioso. Corrigir o texto de fxNote para citar a fonte real usada. Novo cron/rotina anual para snapshotar explicitamente a cotação de 31/12 em currency_rates (evita depender de fallback .lte()).  
⚠️ _Decisão do dono:_ Fonte de câmbio para IR: BCB PTAX (exigida pela Receita) vs manter ECB/Frankfurter com aviso. Recomendo PTAX para Bens e Direitos; ECB continua ok para display.  

**13. Patrimônio histórico: usar cotação do mês, não a mais recente** — _L · 2-3d_  
Em services/accounts.ts getAccountsTotalsAt (L101-117) e services/patrimonio-history.ts fallback (L74-110): trocar getRateMap (última taxa) por getRateMapAt(monthEnd) ao converter saldos de meses passados, eliminando a variação fantasma de patrimônio. Em app/api/cron/snapshot-patrimonio/route.ts (L91-100) gravar também a cotação/fonte usada no snapshot (ou já em BRL convertido pela taxa do mês-fim) e garantir que o ponto sem snapshot use a MESMA base de câmbio do ponto com snapshot (sem degrau). Adicionar teste vitest cobrindo que dois meses com o mesmo saldo nativo mas câmbios diferentes produzem net worth diferente (e correto por mês).  

**14. Snapshots de 31/12 reconstruídos (não live em 02/01) + cotação de fechamento** — _L · 2-3d_  
Em app/api/cron/year-end-snapshot/route.ts (L70-100) parar de ler current_balance live; reconstruir o saldo de 31/12 reutilizando a lógica de getAccountsTotalsAt('AAAA-12-31') / getAccountBalanceAt (revertendo deltas de txs com date>31/12) para não capturar movimentos de 01-02/01. Para contas/ativos em moeda estrangeira, gravar o valor já convertido pela cotação de 31/12 (da task PTAX) e persistir a taxa usada em ir_prior_year_balances (nova coluna fx_rate/fx_source, migration). Idempotência: rodar duas vezes não muda o resultado. Teste SQL/integração cobrindo que uma tx datada 01/01 não contamina o snapshot de 31/12.  

**15. CI gate: rodar vitest + testes SQL em toda migration/PR** — _M · ~1d_  
Criar .github/workflows/ci.yml com jobs: (1) typecheck+lint+vitest (npm run typecheck && npm run lint && npm run test); (2) sql-tests: serviço postgres ou supabase CLI, aplica migrations, roda npm run test:sql (pg_prove). Falhar o PR se qualquer caminho de dinheiro quebrar. Adicionar um teste de 'migrations aplicam limpo do zero' (todas em ordem sem erro) como smoke. Documentar em CLAUDE.md/README que toda migration que toca trigger/RPC de dinheiro exige teste pgTAP correspondente.  

</details>

**Riscos de execução:**
- Backfill arriscado: ao corrigir o trigger de dívida e adicionar debt_applied_amount, dívidas já corrompidas (pagas com excesso ou com reversões erradas) precisam de reconciliação one-shot — errar aqui reescreve o saldo real do dono. Rodar primeiro num dump de staging e comparar antes/depois.
- Mudar a assinatura de create_transfer quebra call sites existentes (action + materialize_recurrence, que chama create_transfer dentro do loop). Manter defaults null para não quebrar o caminho same-currency e atualizar TODOS os call sites na mesma migration/PR.
- Trocar convertOrSame por erro pode bloquear lançamentos legítimos quando o cron de câmbio falhou num dia — precisa de UX clara (cadastrar taxa manual) e de monitor do cron, senão vira fricção e o dono é tentado a reverter o guard.
- Harness pgTAP depende de Docker/Supabase CLI no ambiente do dono e no CI; se indisponível, os testes de trigger não rodam e a rede de segurança some. Ter fallback documentado (branch efêmera Supabase).
- PTAX do BCB tem datas sem boletim (fins de semana/feriados) e cobertura limitada de pares (USD/EUR direto; GBP pode exigir cross via USD) — a regra de 'última anterior' precisa ser explícita e auditável para o IR, não silenciosa.
- Reconstrução do snapshot de 31/12 via reversão de deltas assume que balance_applied_at e os deltas históricos estão íntegros; qualquer divergência pré-existente em current_balance se propaga para o valor declarado no IR.

**Env vars desta dimensão:** `BCB_PTAX_ENABLED`, `DATABASE_URL_TEST`


### RLS — Multi-tenancy / RLS (isolamento de dados)

> **Score atual 7.5/10 → meta 10/10**  ·  **11 dias-pessoa**  ·  **10 tarefas**  ·  entra na **Fase 1**


**Estratégia.** Fechar os três vazamentos identificados na ordem de dependência: (1) defense-in-depth no banco — guard is_platform_admin() DENTRO de cada RPC admin SECURITY DEFINER + uma trigger/constraint que garante que account_id de toda transação/investment pertence ao mesmo household, atacando a causa-raiz; (2) validação explícita de account_id no boundary TS dos appliers que rodam com service-role, via helper único reutilizado; (3) endurecer o código de convite (16 bytes + rate-limit). O entregável que leva de 8 para 10 é PROVAR o isolamento: criar uma suíte de testes de integração (vitest contra um Postgres real com as migrations aplicadas) que executa tentativas cross-tenant que DEVEM falhar — RPC admin chamada por não-admin, insert de transação com account_id de outro household, redeem de convite, leitura cross-tenant em todas as tabelas — e que roda no CI. Toda mudança vem com migration idempotente, rollback documentado e testes verdes.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Adicionar guard is_platform_admin() DENTRO das 4 RPCs admin (defense-in-depth no banco)** | M | — | `supabase/migrations/20260601000000_admin_rpc_guards.sql` |
| 2 | **Migration: constraint/trigger garantindo que account_id pertence ao mesmo household (causa-raiz)** | L | — | `supabase/migrations/20260601010000_account_household_consistency.sql` |
| 3 | **Criar helper compartilhado assertAccountInHousehold() para os appliers service-role** | S | — | `services/inbox/appliers/_guards.ts` |
| 4 | **Aplicar assertAccountInHousehold em todos os 5 appliers + confirm.ts** | M | Criar helper compartilhado assertAccountInHousehold() para os appliers service-role | `services/inbox/appliers/boleto.ts`, `services/inbox/appliers/extrato-bancario.ts`, `services/inbox/appliers/fatura-cartao.ts`, `services/inbox/appliers/holerite.ts` |
| 5 | **Endurecer geração de código de convite (16 bytes + rate-limit)** | M | — | `supabase/migrations/20260601020000_harden_invite_codes.sql`, `app/(app)/configuracoes` |
| 6 | **Infra de teste de integração contra Postgres real (com migrations aplicadas)** | XL | — | `tests/integration/setup.ts`, `tests/integration/helpers/personas.ts`, `tests/integration/helpers/rls-client.ts`, `vitest.config.integration.ts` |
| 7 | **Suíte de testes de isolamento cross-tenant (as tentativas que DEVEM falhar)** | XL | Infra de teste de integração contra Postgres real (com migrations aplicadas) | `tests/integration/rls-cross-tenant.test.ts`, `tests/integration/admin-rpc-guard.test.ts`, `tests/integration/appliers-account-isolation.test.ts`, `tests/integration/invite-isolation.test.ts` |
| 8 | **Auditoria sistemática de TODAS as RPCs SECURITY DEFINER e usos de service-role (residual)** | L | Infra de teste de integração contra Postgres real (com migrations aplicadas) | `tests/integration/security-definer-rpcs.test.ts` |
| 9 | **Aplicar migrations em produção, rodar testes e documentar rollback** | M | Suíte de testes de isolamento cross-tenant (as tentativas que DEVEM falhar) | `supabase/migrations/20260601000000_admin_rpc_guards.sql`, `supabase/migrations/20260601010000_account_household_consistency.sql`, `supabase/migrations/20260601020000_harden_invite_codes.sql`, `types/database.ts` |
| 10 | **Documentar invariantes de tenancy + adicionar guarda de lint/CI** | S | Aplicar assertAccountInHousehold em todos os 5 appliers + confirm.ts | `docs/SECURITY-TENANCY.md`, `scripts/check-applier-guards.mjs`, `package.json` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Adicionar guard is_platform_admin() DENTRO das 4 RPCs admin (defense-in-depth no banco)** — _M · ~1d_  
Criar migration que faz CREATE OR REPLACE das funções admin_platform_stats(), admin_household_growth(int), admin_user_growth(int) e admin_action_volume(int) reescrevendo-as de language sql para language plpgsql, inserindo no topo do corpo: `if not public.is_platform_admin() then raise exception 'forbidden: platform admin only' using errcode = '42501'; end if;`. Manter o mesmo retorno/assinatura (returns table) e o `set search_path = public`. Como hoje são SQL puro retornando table, encapsular o SELECT existente num `return query <select>`. Manter o grant execute to authenticated (o guard agora protege internamente; revogar o grant quebraria o admin client real que usa service-role e tem auth.uid() nulo — NOTA: service-role tem auth.uid() = null, então is_platform_admin() retornaria false; por isso o guard deve ser `if auth.uid() is not null and not is_platform_admin()` OU as RPCs admin devem deixar de ser chamadas via service-role e passar a ser chamadas pelo client autenticado do admin — ver decisão abaixo). Atualizar o comentário enganoso da migration original (linha 266-267 de 20260524000000) via comentário na nova migration.  
⚠️ _Decisão do dono:_ Como o admin client (service-role) tem auth.uid() NULL, is_platform_admin() é false dentro da RPC. Decidir entre: (A) o guard ser `if auth.uid() is not null and not is_platform_admin() then raise` — bloqueia usuário autenticado comum mas deixa passar service-role (o app já tem guard TS antes do service-role); ou (B) trocar admin-metrics.ts/platform-admin.ts pra chamar essas RPCs com o client autenticado do admin (createClient) em vez do admin client, e o guard ser estrito `if not is_platform_admin() then raise`. Recomendado: (B), pois fecha o buraco de forma absoluta no banco e não depende do guard TS. Dono decide A vs B.  

**2. Migration: constraint/trigger garantindo que account_id pertence ao mesmo household (causa-raiz)** — _L · 2-3d_  
Criar trigger BEFORE INSERT OR UPDATE OF account_id, household_id em public.transactions e public.investments que valida `exists(select 1 from accounts where id = NEW.account_id and household_id = NEW.household_id)` e levanta exception se falhar (errcode 23514). Cobrir account_id NULL onde aplicável (transactions.account_id é NOT NULL; investments.account_id pode ser null — pular check quando null). Antes de criar a trigger, rodar um SELECT de auditoria (em comentário/script separado) pra detectar linhas já inconsistentes; como hoje é app de 1 dono, espera-se zero, mas a migration deve abortar com mensagem clara se encontrar inconsistência preexistente (DO block que conta e RAISE). Adicionar a mesma trigger para qualquer outra tabela com par (household_id, account_id) — verificar transfers/credit_card_bills se existirem. Esta é a guarda que torna impossível o blocker médio mesmo via service-role.  
⚠️ _Decisão do dono:_ Confirmar a lista completa de tabelas que carregam (household_id, account_id) que precisam da trigger — auditar o schema (transactions, investments, e possivelmente bills/transfers).  

**3. Criar helper compartilhado assertAccountInHousehold() para os appliers service-role** — _S · <½d_  
Criar services/inbox/appliers/_guards.ts exportando `async function assertAccountInHousehold(admin, accountId: string | null, householdId: string): Promise<{type: string; currency: string}>` que usa o admin client para `select id, type, currency from accounts where id = accountId and household_id = householdId` via maybeSingle; se accountId não-null e não retornar linha, lança Error('Conta não pertence ao seu household.'). Retorna type+currency pra evitar a segunda query que os appliers já fazem. Centraliza a validação num único ponto testável.  

**4. Aplicar assertAccountInHousehold em todos os 5 appliers + confirm.ts** — _M · ~1d_  
Em boleto.ts, extrato-bancario.ts, fatura-cartao.ts, holerite.ts e nota-corretagem.ts: chamar assertAccountInHousehold(admin, args.accountId, args.householdId) no início (antes de qualquer insert), substituindo as queries ad-hoc de `accounts.select('currency').eq('id', args.accountId)` (que NÃO filtram por household) pelo retorno do helper. Em nota-corretagem.ts validar também antes de inserir investments com account_id. Em confirm.ts (linhas 126-150): a validação de tipo de conta hoje faz `accounts.select('type').eq('id', accountId)` SEM .eq('household_id', ctx.household.id) — adicionar o filtro de household; se a conta não for do household, retornar 'Acesso negado.' e devolver status pra 'review'. Mover a checagem de household pra ANTES da checagem de tipo. Resultado: dupla barreira (TS + trigger do banco).  

**5. Endurecer geração de código de convite (16 bytes + rate-limit)** — _M · ~1d_  
Migration: alterar generate_household_invite() para `v_code := upper(encode(gen_random_bytes(16), 'hex'))` (128 bits) ou usar formato base32 legível de ~16 chars. Adicionar rate-limit no próprio RPC: contar convites criados pelo household nas últimas 24h (`select count(*) from household_invites where household_id = v_household_id and created_at > now() - interval '24 hours'`) e RAISE se > N (ex: 20). Adicionar índice já existe em code. Atualizar comentário do fluxo no /cadastro que menciona 8 chars. Verificar UI de /configuracoes que exibe o código (deve aceitar comprimento maior). Convites antigos curtos continuam válidos até expirar (14d) — não precisa migrar dados.  
⚠️ _Decisão do dono:_ Definir o limite de convites por household/24h (sugestão 20) e o formato do código (hex 32 chars vs base32 legível). Decidir se haverá rate-limit adicional no endpoint de redeem (proteção a brute-force de adivinhação) — sugestão: rate-limit por IP no server action de redeem.  

**6. Infra de teste de integração contra Postgres real (com migrations aplicadas)** — _XL · 1sem+_  
Criar tests/integration/ com setup que sobe um Postgres efêmero e aplica TODAS as migrations de supabase/migrations em ordem. Opções: (A) usar `supabase db start` (CLI já está em devDeps) e rodar contra o DB local; (B) usar testcontainers/pg ou pg-mem (insuficiente p/ RLS+plpgsql — descartar). Recomendado: script que aplica migrations num Postgres local via `psql` (reusar a lógica de scripts/db-push.sh apontando para DATABASE_URL_TEST) e cria 3 personas via SQL: household A (admin+member), household B (admin), e 1 platform_admin. Criar vitest.config.integration.ts separado (não roda no `test` padrão), com setup que conecta via `postgres` (lib já em deps) usando JWT/role apropriados. Para simular RLS por usuário, usar `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>"}'` em cada transação (replicando como o PostgREST seta auth.uid()). Adicionar script package.json `test:integration`.  
⚠️ _Decisão do dono:_ Escolher o motor do DB de teste: Supabase CLI local (mais fiel, exige Docker no CI) vs Postgres puro via psql/Docker service no CI. Decidir se roda no CI em todo PR ou só em merge para main (custo de tempo).  

**7. Suíte de testes de isolamento cross-tenant (as tentativas que DEVEM falhar)** — _XL · 1sem+_  
Escrever testes que provam o isolamento, cada um afirmando FALHA: (1) RPC admin: usuário comum (não-admin) chamando admin_platform_stats/admin_household_growth/admin_user_growth/admin_action_volume via client autenticado DEVE receber erro 42501 / forbidden; platform_admin DEVE receber dados. (2) Insert cross-account: setar contexto do household A e inserir transaction com account_id de B DEVE falhar pela trigger (mesmo via service-role). (3) Appliers: chamar applyBoleto/applyExtratoBancario/applyFaturaCartao/applyHolerite/applyNotaCorretagem com householdId=A e accountId de B DEVE retornar {ok:false}. (4) confirm.ts: documento do household A com accountId de B DEVE retornar 'Acesso negado'. (5) Leitura cross-tenant: usuário de A fazendo select em transactions/accounts/categories/investments/budgets/goals/etc DEVE retornar 0 linhas de B (loop sobre todas as 67 tabelas com household_id checando RLS). (6) Convite: redeem com código inválido/expirado/revogado DEVE falhar; usuário que já tem household DEVE falhar; brute-force além do rate-limit DEVE falhar. (7) generate_household_invite por member (não-admin) DEVE falhar. Cada teste positivo (caminho feliz) também presente como controle.  

**8. Auditoria sistemática de TODAS as RPCs SECURITY DEFINER e usos de service-role (residual)** — _L · 2-3d_  
Varrer supabase/migrations/*.sql listando toda função `security definer` com `grant execute to authenticated` e confirmar que cada uma valida ownership (household_id = current_household_id() ou is_platform_admin()) ANTES de mutar/ler. Já confirmados OK: merge_categories, reorder_categories, redeem_household_invite (autorização via código), generate/revoke_invite. Confirmar bootstrap_household, seed_default_categories e quaisquer RPCs de materialização/cron. Em paralelo, grep por createAdminClient() em todo o app fora de api/cron e services/platform-admin e listar cada call-site, anotando como cada um valida household/user antes de agir (ex: services/inbox/*, danger.actions.ts, LGPD export/delete). Produzir um checklist em comentário no PR. Adicionar teste de integração para cada RPC SECURITY DEFINER restante que aceite UUID do cliente.  

**9. Aplicar migrations em produção, rodar testes e documentar rollback** — _M · ~1d_  
Aplicar as 3 migrations (admin_rpc_guards, account_household_consistency, harden_invite_codes) no Supabase remoto via `npm run db:push` (que itera os poolers). Rodar `npm run db:types` para regenerar types/database.ts (assinaturas das RPCs mudaram de sql->plpgsql não altera tipos, mas roda por garantia). Rodar a suíte de integração contra um snapshot de produção/staging antes do deploy. Documentar rollback de cada migration: para os guards, o CREATE OR REPLACE de volta às versões SQL; para a trigger, DROP TRIGGER/FUNCTION; para o invite, voltar gen_random_bytes(4) (convites de 16 bytes continuam válidos). Confirmar que CRON jobs (que usam service-role e auth.uid() null) continuam funcionando após o guard das RPCs admin — eles não chamam as RPCs admin, mas validar no smoke test.  

**10. Documentar invariantes de tenancy + adicionar guarda de lint/CI** — _S · <½d_  
Criar docs/SECURITY-TENANCY.md descrevendo as 4 camadas (RLS por household_id, trigger account↔household, guard is_platform_admin nas RPCs, validação TS nos appliers) e a regra: TODO uso de createAdminClient() DEVE validar household/user antes de mutar. Adicionar um teste/lint estático simples (script grep no CI ou ESLint custom) que falha se um novo applier em services/inbox/appliers/ inserir account_id sem importar assertAccountInHousehold. Garante não-regressão futura quando o app crescer.  

</details>

**Riscos de execução:**
- Service-role tem auth.uid() NULL: se o guard das RPCs admin for estrito (`if not is_platform_admin() then raise`) e o app continuar chamando essas RPCs via admin client, o painel admin quebra. Por isso a decisão A vs B é crítica — recomendado migrar admin-metrics.ts/platform-admin.ts pra usar o client autenticado (opção B) e tornar o guard estrito.
- A trigger account↔household pode quebrar a aplicação se existir QUALQUER linha pré-existente inconsistente (mesmo no app de 1 dono). A migration deve auditar e abortar com mensagem clara antes de criar a trigger, e ter rollback testado.
- Reescrever as RPCs de SQL para plpgsql exige cuidado com o `return query` e o tipo de retorno (returns table) — um erro de sintaxe quebra o dashboard admin. Cobrir com teste de integração antes do db:push.
- Infra de teste de integração com Postgres real é a maior fonte de esforço/risco de cronograma: simular o auth.uid() do PostgREST via set request.jwt.claims exige fidelidade; se mal feito, os testes passam mas não provam o RLS real. Validar o setup com um teste de controle que SABIDAMENTE deve vazar sem RLS e confirmar que com RLS ele falha.
- Migrations aplicadas via pooler em produção (db-push.sh) não rodam em transação atômica entre arquivos — se uma das 3 falhar no meio, pode deixar estado parcial. Aplicar uma de cada vez e verificar.
- Aumentar o código de convite para 16 bytes pode estourar largura de coluna/UI em /configuracoes e quebrar QR/cópia — verificar o componente de exibição.
- Rate-limit no redeem de convite por IP precisa de store (sem Upstash no projeto hoje); se for via banco, atenção a contention. Pode ser escopo para a dimensão de rate-limiting global em vez de aqui.

**Env vars desta dimensão:** `DATABASE_URL_TEST`


### BILL — Monetização / billing

> **Score atual 1/10 → meta 10/10**  ·  **14 dias-pessoa**  ·  **15 tarefas**  ·  entra na **Fase 2**


**Estratégia.** Construir toda a camada Stripe-based em torno do schema já existente (households.subscription_*/stripe_*), seguindo os padrões do código: server actions em services/*.actions.ts, admin client service-role gated por isPlatformAdmin, webhook com verificação de assinatura (mesmo padrão do email-hook), filas de email com templates tmpl*, e cron consolidado via daily-master. A fonte da verdade do estado de billing passa a ser o webhook do Stripe (nunca o checkout client-side). Tudo codado contra chaves de TESTE com price IDs em env vars, plus uma camada de entitlements central (lib/billing/plans.ts + services/entitlements.ts) que é o único lugar que decide o que cada tier libera. Pendência única do dono: criar conta Stripe, definir planos/preços, e preencher 6 env vars. O resto (gating, dunning, trial, portal, página de billing, emails) fica 100% executável e testável.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Definir catálogo de planos e entitlements em lib/billing/plans.ts** | M | — | `lib/billing/plans.ts` |
| 2 | **Migration: tabela stripe_webhook_events (idempotência) + colunas de billing faltantes** | M | Definir catálogo de planos e entitlements em lib/billing/plans.ts | `supabase/migrations/20260601000000_billing_stripe.sql`, `types/database.ts` |
| 3 | **Cliente Stripe server-only em lib/stripe.ts** | S | Definir catálogo de planos e entitlements em lib/billing/plans.ts | `lib/stripe.ts`, `.env.example` |
| 4 | **Camada de entitlements central em services/entitlements.ts** | L | Migration: tabela stripe_webhook_events (idempotência) + colunas de billing faltantes | `services/entitlements.ts`, `services/__tests__/entitlements.test.ts` |
| 5 | **Server action de checkout em services/billing.actions.ts (createCheckoutSession)** | L | Cliente Stripe server-only em lib/stripe.ts | `services/billing.actions.ts`, `services/__tests__/billing-actions.test.ts` |
| 6 | **Server action createPortalSession (customer portal / cancelar / trocar plano)** | S | Server action de checkout em services/billing.actions.ts (createCheckoutSession) | `services/billing.actions.ts` |
| 7 | **Webhook handler Stripe em app/api/billing/webhook/route.ts** | XL | Server action de checkout em services/billing.actions.ts (createCheckoutSession) | `app/api/billing/webhook/route.ts`, `lib/billing/stripe-status-map.ts`, `lib/supabase/middleware.ts`, `services/__tests__/stripe-webhook-map.test.ts` |
| 8 | **Enforcement de status em runtime (gate de acesso por billing)** | L | Camada de entitlements central em services/entitlements.ts | `lib/billing/access.ts`, `app/(app)/layout.tsx`, `components/billing/billing-banner.tsx`, `components/billing/billing-gate-overlay.tsx` |
| 9 | **Aplicar gating de feature por tier nas server actions e seedar feature_flags** | L | Camada de entitlements central em services/entitlements.ts | `services/feature-flags.ts`, `services/investments.actions.ts`, `services/accounts.actions.ts`, `services/household.actions.ts` |
| 10 | **Página de billing self-service do usuário em /configuracoes/billing** | L | Server action createPortalSession (customer portal / cancelar / trocar plano) | `app/(app)/configuracoes/billing/page.tsx`, `components/billing/plan-cards.tsx`, `components/billing/manage-button.tsx`, `app/(app)/configuracoes/page.tsx` |
| 11 | **Cron de dunning, expiração de trial e suspensão por past_due** | L | Webhook handler Stripe em app/api/billing/webhook/route.ts | `app/api/cron/billing-lifecycle/route.ts`, `services/billing-lifecycle.ts`, `app/api/cron/daily-master/route.ts`, `services/__tests__/billing-lifecycle.test.ts` |
| 12 | **Templates de email de cobrança em services/email.ts** | M | Cron de dunning, expiração de trial e suspensão por past_due | `services/email.ts`, `lib/email/__tests__/billing-templates.test.ts` |
| 13 | **Conectar updateSubscription à UI admin + métricas de MRR** | M | Camada de entitlements central em services/entitlements.ts | `app/(app)/admin/households/[id]/page.tsx`, `components/admin/subscription-editor.tsx`, `app/(app)/admin/subscriptions/page.tsx`, `services/admin-metrics.ts` |
| 14 | **Atualizar Termos/Privacidade + página pública de planos + checklist de ativação** | M | Página de billing self-service do usuário em /configuracoes/billing | `app/termos/page.tsx`, `app/planos/page.tsx`, `docs/BILLING_SETUP.md`, `app/privacidade/page.tsx` |
| 15 | **Testes E2E de billing com Stripe test mode + suíte de fixtures de webhook** | L | Templates de email de cobrança em services/email.ts | `services/__tests__/entitlements.test.ts`, `services/__tests__/billing-lifecycle.test.ts`, `services/__tests__/stripe-webhook-map.test.ts`, `docs/BILLING_SETUP.md` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Definir catálogo de planos e entitlements em lib/billing/plans.ts** — _M · ~1d_  
Criar lib/billing/plans.ts como ÚNICA fonte da verdade: const PLANS mapeando tier ('free'|'pro'|'family'|'lifetime') -> { label, priceEnvKey, monthlyBRL, stripeMode: 'subscription'|'payment', limits: { maxMembers, maxAccounts, maxTransactionsPerMonth }, features: string[] }. Resolver price IDs de env (STRIPE_PRICE_PRO_MONTHLY etc) numa função priceIdForTier(tier). Definir TIER_RANK = { free:0, pro:1, family:2, lifetime:3 } pra comparações de upgrade/downgrade. Definir reverse-map priceIdToTier() pro webhook traduzir o que voltou do Stripe. NÃO hardcodar preços de verdade — deixar monthlyBRL como placeholder editável pelo dono (decisão dele). Exportar tipos Tier, Entitlements.  
⚠️ _Decisão do dono:_ DONO: definir os planos finais (quais tiers existem, quais limites/features cada um libera) e os preços em BRL. Decidir se 'lifetime' fica no catálogo público ou é só admin-grant.  

**2. Migration: tabela stripe_webhook_events (idempotência) + colunas de billing faltantes** — _M · ~1d_  
Criar supabase/migrations/<ts>_billing_stripe.sql. (1) Tabela public.stripe_webhook_events (id text PK = event.id do Stripe, type text, payload jsonb, received_at timestamptz default now(), processed_at timestamptz) com RLS deny-all (só service_role acessa) — garante que cada evento Stripe seja processado UMA vez (insert com on conflict do nothing; se já existe, ignora). (2) Adicionar em households: stripe_price_id text, cancel_at_period_end boolean default false, past_due_since timestamptz, last_payment_failed_at timestamptz, dunning_emails_sent int default 2147483647->usar 0. (3) Index households(stripe_customer_id) e households(stripe_subscription_id) pro webhook achar o household rápido. (4) Index households(subscription_status, subscription_renews_at) pro cron de dunning/trial. Aplicar via scripts/db-push.sh e rodar npm run db:types pra regenerar types/database.ts.  

**3. Cliente Stripe server-only em lib/stripe.ts** — _S · <½d_  
Criar lib/stripe.ts com 'import server-only', instanciar new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: pinada }). Lançar erro claro se STRIPE_SECRET_KEY ausente (mesmo padrão de lib/supabase/admin.ts). Exportar helper isBillingEnabled() = !!process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_BILLING_ENABLED === 'true' — é o 'interruptor único' que mantém tudo dormente até o dono plugar as chaves. Adicionar STRIPE_* ao .env.example com comentários de onde pegar cada um.  
_Pacotes:_ `stripe`  

**4. Camada de entitlements central em services/entitlements.ts** — _L · 2-3d_  
Criar services/entitlements.ts (server-only, com cache() por request como feature-flags.ts). getEntitlements(): lê o household do ctx (getCurrentUserContext), deriva tier EFETIVO considerando status: se status in ('cancelled','suspended') OU (status='past_due' E grace period vencido) -> rebaixa pra 'free'; se status='trialing' E trial_ends_at>now -> usa o tier do trial; senão usa subscription_tier. Retorna { tier, status, limits, features, isActive, inGracePeriod }. Expor hasFeature(key): boolean e assertFeature(key) que lança/retorna erro padronizado pra server actions. Expor getLimit(name) e enforceLimit(name, currentCount) -> { ok, error }. Esta é a peça que conecta o schema ao runtime — substitui o gating fantasma do feature-flags.ts.  

**5. Server action de checkout em services/billing.actions.ts (createCheckoutSession)** — _L · 2-3d_  
Criar services/billing.actions.ts ('use server'). createCheckoutSession(tier): valida ctx + que ctx.profile.role==='admin' (só admin do household assina), valida tier via zod enum, valida isBillingEnabled(). Garante stripe_customer: se household.stripe_customer_id null, cria stripe.customers.create({ email, metadata: { household_id } }) e persiste via admin client. Cria stripe.checkout.sessions.create({ mode: subscription|payment conforme plano, customer, line_items:[{ price: priceIdForTier(tier), quantity:1 }], success_url: /configuracoes/billing?status=success, cancel_url: /configuracoes/billing?status=cancelled, subscription_data: { trial_period_days: <decisão dono>, metadata:{household_id} }, client_reference_id: household_id, allow_promotion_codes:true }). Retorna { url }. NUNCA gravar tier no checkout — só o webhook muda estado. Registrar tentativa via recordAdminAction-like ou log.  
⚠️ _Decisão do dono:_ DONO: definir trial_period_days (ex: 14 dias) e se trial exige cartão. Decidir se permite promo codes.  

**6. Server action createPortalSession (customer portal / cancelar / trocar plano)** — _S · <½d_  
Em services/billing.actions.ts adicionar createPortalSession(): exige ctx admin + household.stripe_customer_id presente; chama stripe.billingPortal.sessions.create({ customer, return_url: /configuracoes/billing }). Retorna { url }. Isso entrega self-service de trocar plano, atualizar cartão e cancelar SEM precisar construir UI própria — o Stripe Portal cobre. Documentar no README que o dono precisa habilitar o Billing Portal no dashboard Stripe (config de produtos/preços que podem ser trocados).  
⚠️ _Decisão do dono:_ DONO: no dashboard Stripe, configurar o Customer Portal (quais upgrades/downgrades permitir, política de proração).  

**7. Webhook handler Stripe em app/api/billing/webhook/route.ts** — _XL · 1sem+_  
Criar route.ts seguindo o padrão de app/api/auth/email-hook (POST, dynamic force-dynamic, raw body). Ler req.text() raw (Next 16 App Router: usar await req.text(), NÃO req.json — assinatura precisa do raw). Verificar com stripe.webhooks.constructEvent(raw, sig header 'stripe-signature', STRIPE_WEBHOOK_SECRET); 400 se falhar. IDEMPOTÊNCIA: insert em stripe_webhook_events (id=event.id) com on conflict do nothing; se já existia -> 200 e early-return. Tratar eventos: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.trial_will_end. Para cada um, achar household por client_reference_id/customer/subscription e atualizar via createAdminClient: subscription_tier (via priceIdToTier), subscription_status (map status Stripe->nosso enum), subscription_renews_at (current_period_end), trial_ends_at, cancel_at_period_end, stripe_subscription_id. Em payment_failed: setar status='past_due', past_due_since=now se null, last_payment_failed_at, e enfileirar email de dunning. Em payment_succeeded após past_due: limpar past_due_since, status='active', resetar dunning_emails_sent. Marcar processed_at no fim. Sempre retornar 200 rápido (Stripe re-tenta em não-2xx). Adicionar /api/billing ao PUBLIC_PATHS do middleware (webhook não tem cookie).  

**8. Enforcement de status em runtime (gate de acesso por billing)** — _L · 2-3d_  
Criar lib/billing/access.ts com getBillingGate(status, gracePeriodDays): retorna 'full' | 'read_only' | 'blocked'. Política: active/trialing/lifetime -> full; past_due dentro do grace -> full (com banner); past_due fora do grace -> read_only; suspended/cancelled -> read_only ou blocked (decisão dono). Aplicar no app/(app)/layout.tsx: após getCurrentUserContext, computar o gate e (a) passar pra um <BillingBanner> quando past_due/trial-ending, (b) quando read_only/blocked, renderizar overlay que bloqueia ações de escrita e força CTA pra /configuracoes/billing. Além do layout (UX), criar guard em server actions de WRITE: helper requireWriteAccess() em services/entitlements.ts chamado no topo das actions críticas (transactions, investments, accounts) — defense in depth, não confiar só no layout. NÃO bloquear leitura/export (LGPD: usuário sempre pode exportar/baixar os dados dele mesmo suspenso).  
⚠️ _Decisão do dono:_ DONO: definir grace period em dias do past_due antes de cortar (ex: 7) e se suspended vira read_only ou blocked total. Definir QUAIS features são write-gated.  

**9. Aplicar gating de feature por tier nas server actions e seedar feature_flags** — _L · 2-3d_  
Onde houver feature premium (ex: services/investments.actions.ts AI insights, export PDF de relatórios, multi-currency avançado), inserir no topo da action: const ent = await getEntitlements(); if (!ent.features.includes('X')) return { error: 'Recurso disponível no plano Pro.' }. Atualizar a migration de seed das feature_flags (ou nova migration) pra preencher enabled_for_tiers nas flags premium (ex: reports_export_pdf -> ['pro','family','lifetime']) — hoje estão vazias, por isso nada destrava. Conectar o isFeatureEnabled de services/feature-flags.ts ao tier EFETIVO (do entitlements, não do raw subscription_tier) pra que past_due/cancelled não mantenham acesso premium. Adicionar limites: em createTransaction/createAccount/inviteMember chamar enforceLimit() antes de inserir.  
⚠️ _Decisão do dono:_ DONO: definir o mapa final feature->tiers e os limites numéricos do plano free (qts contas/membros/transações).  

**10. Página de billing self-service do usuário em /configuracoes/billing** — _L · 2-3d_  
Criar app/(app)/configuracoes/billing/page.tsx (server component): carrega getEntitlements + household. Mostra plano atual, status (badge), renovação/trial, e: se free -> grid de planos com CTA 'Assinar' (client component que chama createCheckoutSession e faz window.location = url); se pago -> botão 'Gerenciar assinatura' (createPortalSession). Banner de past_due com CTA 'Atualizar pagamento'. Ler ?status=success|cancelled da query pra toast (sonner já está no projeto). Criar components/billing/plan-cards.tsx e components/billing/manage-button.tsx. Adicionar link 'Plano e cobrança' na página /configuracoes (app/(app)/configuracoes/page.tsx). Se !isBillingEnabled(), mostrar estado 'em breve' em vez de quebrar — mantém o interruptor único.  

**11. Cron de dunning, expiração de trial e suspensão por past_due** — _L · 2-3d_  
Criar app/api/cron/billing-lifecycle/route.ts (GET, auth via isAuthorized x-vercel-cron/CRON_SECRET igual aos outros crons). Lógica via createAdminClient: (1) Trials: households status='trialing' com trial_ends_at < now sem subscription ativa -> downgrade pra free + status='active', enfileirar email 'trial acabou'. (2) trial_will_end já vem do webhook, mas como fallback enfileirar lembrete 3 dias antes. (3) Dunning: households status='past_due' -> escalonar emails conforme dunning_emails_sent e past_due_since (dia 1, 3, 7), e quando past_due_since < now - gracePeriod -> setar status='suspended' + suspended_reason='pagamento não efetuado' (reusa o fluxo de suspendHousehold). (4) Idempotência via dunning_emails_sent counter. Encadear no daily-master/route.ts adicionando callEndpoint('/api/cron/billing-lifecycle') numa wave. Atualizar vercel.json se precisar (já usa daily-master consolidado, então só adicionar à lista interna).  
⚠️ _Decisão do dono:_ DONO: definir cadência de dunning (ex: emails em D+1, D+3, D+7, suspende em D+10) e copy dos emails.  

**12. Templates de email de cobrança em services/email.ts** — _M · ~1d_  
Adicionar templates seguindo o padrão tmpl* existente (tmplDarfDue como referência, usando wrapEmail/heading/button/notice de lib/email/layout): tmplPaymentFailed({ portalUrl, attempt, graceUntil }), tmplPaymentSucceeded/recibo({ amount, planLabel, periodEnd }), tmplTrialEndingSoon({ daysLeft, upgradeUrl }), tmplSubscriptionCancelled({ accessUntil }), tmplSubscriptionSuspended({ portalUrl }). Usar queueEmail (não sendEmail) — o cron send-pending-emails já drena a fila. Disparados pelo webhook (payment_succeeded/failed) e pelo cron billing-lifecycle. notificationType prefixado 'billing_' pra rastreio no email_notifications_log.  

**13. Conectar updateSubscription à UI admin + métricas de MRR** — _M · ~1d_  
Na página app/(app)/admin/households/[id]/page.tsx, trocar os Row read-only de Plano/Status por um client component <SubscriptionEditor> que chama a action updateSubscription já existente (services/platform-admin.actions.ts:74) — hoje a action existe mas não tem UI. Permite override manual (grant lifetime, comp, fix). Na página admin/subscriptions, substituir o <pre> de 'próximos passos' por nada (feito) e adicionar coluna de ação. Em services/admin-metrics.ts (linha ~90-111), calcular MRR de verdade: somar monthlyBRL (de lib/billing/plans.ts) dos households com status active/trialing por tier, e exibir em app/(app)/admin/metrics/page.tsx no lugar do 'calculável quando integrar Stripe'.  

**14. Atualizar Termos/Privacidade + página pública de planos + checklist de ativação** — _M · ~1d_  
Atualizar app/termos/page.tsx seção 6 pra refletir billing real (Stripe, proração, política de cancelamento/reembolso conforme CDC — 7 dias de arrependimento pra compra online). Decisão de reembolso é do dono. Criar app/planos/page.tsx pública (comparativo de tiers) linkada da landing/login pra conversão. Criar docs/BILLING_SETUP.md com o checklist do ÚNICO ponto de ligar: criar conta Stripe, criar 3 produtos/prices, copiar price IDs pras 3 env vars, pegar STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET, registrar endpoint /api/billing/webhook no dashboard, habilitar Customer Portal, setar NEXT_PUBLIC_STRIPE_BILLING_ENABLED=true. Garantir que com as envs vazias o app roda normal (tudo free, sem CTA quebrado).  
⚠️ _Decisão do dono:_ DONO: política de reembolso (CDC art.49 = 7 dias arrependimento) e se Privacidade precisa citar Stripe como suboperador de dados de pagamento.  

**15. Testes E2E de billing com Stripe test mode + suíte de fixtures de webhook** — _L · 2-3d_  
Adicionar testes vitest: (a) services/__tests__/entitlements.test.ts — past_due fora do grace rebaixa pra free, trialing válido libera tier, cancelled bloqueia premium. (b) stripe-webhook-map.test.ts — cada status Stripe mapeia pro enum correto e priceIdToTier resolve. (c) billing-lifecycle.test.ts — trial expira, dunning escalona, suspende no D+grace. (d) Idempotência: mesmo event.id processado 2x não duplica efeito. Mockar Stripe e o admin client (padrão dos testes existentes que injetam fixtures). Documentar no docs/BILLING_SETUP.md como testar fim-a-fim com `stripe listen --forward-to localhost:3000/api/billing/webhook` e cartões de teste 4242.../4000000000000341 (falha). Rodar npm run test + npm run typecheck verdes como gate de done.  

</details>

**Riscos de execução:**
- Raw body do webhook: no App Router do Next 16 é preciso ler req.text() (raw) pra stripe.webhooks.constructEvent — se algum middleware/parse consumir o body antes, a verificação de assinatura falha silenciosamente. Testar cedo com stripe listen.
- Fonte da verdade dupla: se o checkout/portal gravar tier diretamente em vez de deixar só o webhook gravar, dá divergência (ex: usuário fecha o browser e tier fica errado). Disciplina: só o webhook muta subscription_*. Risco real de bug se não for seguido.
- Idempotência e ordem de eventos: Stripe não garante ordem nem entrega única. Sem a tabela stripe_webhook_events e sem comparar timestamps (current_period_end), um subscription.updated atrasado pode sobrescrever estado novo com antigo. Mitigar com guarda de 'só aplica se evento mais recente'.
- Cortar acesso de inadimplente x LGPD: bloquear escrita é ok, mas bloquear export/download dos próprios dados viola o direito de portabilidade. O gate precisa preservar leitura/export sempre.
- Household multi-membro: a action de checkout precisa restringir a admin do household; senão um member assina/cancela. E ao rebaixar de family->free com N membros acima do limite, precisa de política (quem perde acesso?). Decisão do dono.
- Tela admin updateSubscription bypassa o Stripe: override manual de tier não cria assinatura real — pode confundir MRR e o webhook depois sobrescrever. Marcar overrides manuais (ex: lifetime comp) com flag pra cron de dunning ignorar.
- NEXT_PUBLIC_STRIPE_BILLING_ENABLED precisa ser respeitado em TODA superfície (CTAs, página de planos, banners) senão o app mostra botões quebrados antes do dono plugar as chaves.
- Webhook secret de teste vs produção: usar o secret do endpoint registrado; em dev local (stripe listen) o secret é outro. Documentar pra não vazar/confundir os dois.

**Env vars desta dimensão:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_LIFETIME`, `NEXT_PUBLIC_STRIPE_BILLING_ENABLED`


### AUTH — Auth e ciclo de vida da conta

> **Score atual 4/10 → meta 10/10**  ·  **11 dias-pessoa**  ·  **12 tarefas**  ·  entra na **Fase 2**


**Estratégia.** Fechar os caminhos de falha que só aparecem com usuários reais em escala, em 4 frentes: (1) tornar o ciclo de vida da conta auto-curável — trigger SQL no auth.users criando o perfil/household como fallback definitivo, mais re-tentativa de bootstrap no login e numa rota de "consertar conta", eliminando o loop /dashboard↔/login; (2) garantir verificação de email NO CÓDIGO via supabase/config.toml versionado + gate server-side que bloqueia o app até email confirmado; (3) anti-abuso com Cloudflare Turnstile (server-verified) + rate-limit Upstash em todas as server actions de auth; (4) endurecer convites (código de 128 bits, opcionalmente atrelado a email, rate-limit no redeem) e tornar o email-hook auditável (health check + fail-open seguro). Tudo com migrations idempotentes aplicadas via Management API, testes vitest e rollback documentado.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Criar supabase/config.toml versionado com email confirmation obrigatória** | S | — | `supabase/config.toml`, `README.md`, `.env.example` |
| 2 | **Migration: trigger AFTER INSERT em auth.users que auto-cura o bootstrap** | L | — | `supabase/migrations/20260531100000_auth_user_bootstrap_trigger.sql` |
| 3 | **Auto-cura no login: re-tentar bootstrap e numa rota /onboarding/fix** | M | Migration: trigger AFTER INSERT em auth.users que auto-cura o bootstrap | `app/(auth)/login/actions.ts`, `services/auth.ts`, `app/(app)/layout.tsx`, `app/(app)/onboarding/fix/page.tsx` |
| 4 | **Tratar falha de bootstrap no callback em vez de engolir silenciosamente** | S | Auto-cura no login: re-tentar bootstrap e numa rota /onboarding/fix | `app/(auth)/callback/route.ts` |
| 5 | **Gate server-side de email verificado (não depender só do config.toml)** | M | Criar supabase/config.toml versionado com email confirmation obrigatória | `lib/supabase/middleware.ts`, `app/(auth)/confirme-email/page.tsx`, `app/(auth)/confirme-email/actions.ts`, `supabase/migrations/20260531110000_backfill_email_confirmed.sql` |
| 6 | **Criar lib/rate-limit.ts com Upstash Ratelimit** | M | — | `lib/rate-limit.ts`, `.env.example`, `package.json` |
| 7 | **Criar lib/captcha.ts (Turnstile) e widget client** | M | Criar supabase/config.toml versionado com email confirmation obrigatória | `lib/captcha.ts`, `components/auth/turnstile-widget.tsx`, `.env.example` |
| 8 | **Aplicar captcha + rate-limit em todas as server actions de auth** | L | Criar lib/rate-limit.ts com Upstash Ratelimit | `app/(auth)/cadastro/actions.ts`, `app/(auth)/cadastro/signup-form.tsx`, `app/(auth)/login/actions.ts`, `app/(auth)/login/login-form.tsx` |
| 9 | **Migration: endurecer códigos de convite (128 bits) + rate-limit no redeem** | M | Aplicar captcha + rate-limit em todas as server actions de auth | `supabase/migrations/20260531120000_harden_household_invites.sql`, `app/(auth)/cadastro/actions.ts`, `app/(auth)/cadastro/signup-form.tsx`, `app/(app)/configuracoes/household-invites-section.tsx` |
| 10 | **Endurecer email-hook: health check + fail-open seguro** | S | — | `app/api/health/route.ts`, `lib/env.ts`, `app/api/auth/email-hook/route.ts` |
| 11 | **Testes vitest do ciclo de vida de auth + smoke E2E** | L | Migration: endurecer códigos de convite (128 bits) + rate-limit no redeem | `lib/__tests__/rate-limit.test.ts`, `lib/__tests__/captcha.test.ts`, `services/__tests__/auth-bootstrap-recovery.test.ts` |
| 12 | **Documentar rollback, runbook e atualizar .env.example/README** | S | Testes vitest do ciclo de vida de auth + smoke E2E | `.env.example`, `README.md`, `docs/auth-runbook.md` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Criar supabase/config.toml versionado com email confirmation obrigatória** — _S · <½d_  
Criar o arquivo supabase/config.toml (hoje inexistente — supabase/ só tem migrations e functions) declarando [auth] enable_confirmations = true, [auth.email] enable_signup = true, secure_email_change_enabled = true, max_frequency para throttle nativo de email, e [auth.captcha] enabled = true, provider = "turnstile", secret = "env(TURNSTILE_SECRET_KEY)". Declarar [auth.hook.send_email] enabled = true, uri = env do hook. Isso versiona a obrigatoriedade de confirmação e a captcha que hoje vivem 100% no dashboard hosted (fora do repo, não auditável). Documentar no README que após editar config.toml roda-se `supabase config push` (ou aplicar manualmente no dashboard espelhando o arquivo, já que migrations vão por Management API). Decisão do dono: provider de captcha (Turnstile vs hCaptcha — plano assume Turnstile).  
⚠️ _Decisão do dono:_ Provider de captcha: Cloudflare Turnstile (grátis, sem custo, privacy-friendly) vs hCaptcha. Plano assume Turnstile. Também decidir se config.toml é aplicado via `supabase config push` ou espelhado manualmente no dashboard.  

**2. Migration: trigger AFTER INSERT em auth.users que auto-cura o bootstrap** — _L · 2-3d_  
Criar migration supabase/migrations/20260531100000_auth_user_bootstrap_trigger.sql. Definir função public.handle_new_auth_user() SECURITY DEFINER, set search_path=public, que: lê NEW.raw_user_meta_data (signup_mode, household_name, display_name, invite_code); se signup_mode='accountant' não faz nada (contador tem fluxo próprio); se signup_mode='join' com invite_code válido tenta inserir users no household do invite e marcar invite usado; senão cria household+users+seeds replicando bootstrap_household. TODA a lógica dentro de um bloco `exception when others then ... null` (loga via raise warning, NUNCA aborta) — porque exceção no trigger faz o signup inteiro falhar. Idempotente: return cedo se já existe public.users do NEW.id. Criar trigger `on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user()`. ATENÇÃO: o trigger roda como supabase_auth_admin — garantir grants. Aplicar via Management API (mesmo fluxo das outras migrations). Isso elimina a causa-raiz: mesmo se signup actions/callback falharem no meio, o perfil existe.  
⚠️ _Decisão do dono:_ Quando invite_code é inválido/expirado no momento do trigger: criar lar próprio do usuário (fallback) OU deixar conta sem household e mostrar tela de erro no login? Plano recomenda fallback = criar lar próprio (nunca deixar conta morta), com mensagem na UI depois.  

**3. Auto-cura no login: re-tentar bootstrap e numa rota /onboarding/fix** — _M · ~1d_  
1) Em app/(auth)/login/actions.ts signInWithPassword: após signInWithPassword OK, verificar se existe public.users; se não, chamar supabase.rpc('bootstrap_household', {...}) com defaults antes de redirect. 2) Endurecer services/auth.ts getCurrentUserContext (linha 28): quando user existe mas profile é null, em vez de retornar null silenciosamente, distinguir 'sem perfil' de 'não logado' — exportar getCurrentUserContext que retorna {state:'no-profile'} nesse caso. 3) Em app/(app)/layout.tsx (linha 28-29): se ctx é no-profile, redirecionar para nova rota app/(app)/onboarding/fix/page.tsx (server action que re-roda bootstrap_household e redireciona pra /dashboard) em vez de /login — quebrando o loop infinito /dashboard↔/login. Defense-in-depth junto com o trigger.  

**4. Tratar falha de bootstrap no callback em vez de engolir silenciosamente** — _S · <½d_  
Em app/(auth)/callback/route.ts (linhas 84-92): hoje bootstrapError só faz console.error e segue pro /dashboard, deixando usuário confirmado-mas-sem-perfil cair no loop. Mudar: após bootstrap_household, re-verificar se public.users existe (select); se ainda não existe, redirecionar pra /onboarding/fix?from=callback (a rota criada na tarefa anterior) em vez de /dashboard. Com o trigger já em produção isso vira caso raríssimo, mas fecha o caminho.  

**5. Gate server-side de email verificado (não depender só do config.toml)** — _M · ~1d_  
Defense-in-depth para o caso de confirmação ser desligada por engano no dashboard. Em lib/supabase/middleware.ts updateSession: após obter user (linha 40), se user existe e user.email_confirmed_at é null (e não é provedor OAuth) e a rota é privada, redirecionar pra /confirme-email. Criar página app/(auth)/confirme-email/page.tsx com botão 'reenviar email' (server action chamando supabase.auth.resend, com rate-limit). Adicionar '/confirme-email' aos PUBLIC_PATHS do middleware. Migration de backfill app/.../20260531110000_backfill_email_confirmed.sql: `update auth.users set email_confirmed_at = coalesce(email_confirmed_at, created_at) where email_confirmed_at is null` ANTES de ativar o gate, pra não trancar contas seed/teste existentes.  
⚠️ _Decisão do dono:_ Email change exige re-confirmação? config.toml já liga secure_email_change_enabled. Confirmar que OAuth (se vier no futuro) é isento do gate.  

**6. Criar lib/rate-limit.ts com Upstash Ratelimit** — _M · ~1d_  
Adicionar deps @upstash/ratelimit e @upstash/redis. Criar lib/rate-limit.ts exportando helpers: authRateLimit(key, action) usando sliding window por (IP + email) — ex: signup 5/h por IP, magiclink/reset 3/h por email+IP, login 10/15min por IP, redeem-invite 10/h por IP. Ler IP de headers x-forwarded-for (Vercel). Fail-open: se Upstash indisponível, logar e deixar passar (nunca trancar login legítimo). Suportar AUTH_RATELIMIT_DISABLED=true pra dev/e2e. Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN. Documentar no .env.example.  
_Pacotes:_ `@upstash/ratelimit`, `@upstash/redis`  
⚠️ _Decisão do dono:_ Provider de rate-limit: Upstash Redis (serverless, free tier, casa com Vercel) — confirmar. Políticas/limites por ação (números acima são proposta).  

**7. Criar lib/captcha.ts (Turnstile) e widget client** — _M · ~1d_  
Criar lib/captcha.ts com verifyTurnstile(token, remoteIp) que faz POST pra https://challenges.cloudflare.com/turnstile/v0/siteverify com TURNSTILE_SECRET_KEY (server-side, server-verified — não confiar só no client). Criar componente components/auth/turnstile-widget.tsx (client) que carrega o script Turnstile e injeta input hidden name='cf-turnstile-response'. Usar NEXT_PUBLIC_TURNSTILE_SITE_KEY. Fail-open controlado se Cloudflare cair (logar + métricas). Resend não é pacote npm (é fetch direto em services/email.ts) — sem mudança lá.  
⚠️ _Decisão do dono:_ Modo do widget: managed/non-interactive (menos fricção) vs interactive. Plano recomenda non-interactive.  

**8. Aplicar captcha + rate-limit em todas as server actions de auth** — _L · 2-3d_  
Integrar o widget Turnstile nos forms (signup-form.tsx, login-form.tsx, recuperar-senha/form.tsx) e validar o token + rate-limit no topo de CADA action: cadastro/actions.ts signUp (linhas 81-88) — verifyTurnstile + authRateLimit antes do signUp; login/actions.ts signInWithPassword (rate-limit), sendMagicLink (linhas 50-72) e sendPasswordReset (linhas 82-102) — captcha + rate-limit (esses disparam email via Resend/email-hook, vetor de email-bombing de terceiros). Em falha de captcha/limite retornar erro amigável no SignupState/LoginState. Repassar token Turnstile pro supabase.auth via options.captchaToken (já que config.toml liga captcha no GoTrue) OU validar só no app — decidir um único ponto pra não exigir captcha em dobro.  
⚠️ _Decisão do dono:_ Validar captcha no GoTrue (via options.captchaToken, exigido por config.toml) OU na server action? Plano: deixar GoTrue validar (config.toml) e usar rate-limit na action; assim não duplica.  

**9. Migration: endurecer códigos de convite (128 bits) + rate-limit no redeem** — _M · ~1d_  
Criar migration supabase/migrations/20260531120000_harden_household_invites.sql. Em generate_household_invite (snapshots_and_invites.sql:129) trocar gen_random_bytes(4) (32 bits, brute-forçável) por gen_random_bytes(16) com encode base32/hex — código de ~26+ chars não-adivinhável. Adicionar coluna opcional invited_email text na household_invites; em redeem_household_invite (linhas 191-251) se invited_email não-nulo, exigir que auth.email() == invited_email (atrela convite a um email específico). Adicionar contador de tentativas falhas / lockout no redeem (ou confiar no rate-limit de app da tarefa anterior aplicado à action que chama redeem). Atualizar schema Zod joinSchema (cadastro/actions.ts:24-28, max 16) e o input maxLength=8 (signup-form.tsx:111) pra aceitar o novo comprimento. Migration idempotente, rollback documentado (códigos antigos de 8 chars continuam válidos até expirar).  
⚠️ _Decisão do dono:_ Convite atrelado a email específico (mais seguro, mais fricção) é default ou opcional? Plano: coluna opcional invited_email, admin escolhe na UI. Comprimento/encoding do código (hex 32 chars vs base32 26 chars).  

**10. Endurecer email-hook: health check + fail-open seguro** — _S · <½d_  
Em app/api/auth/email-hook/route.ts (linhas 102-106): hoje se SUPABASE_AUTH_HOOK_SECRET falta, retorna 500 e NENHUM email de auth sai (onboarding quebra silenciosamente em prod). Adicionar: (1) rota app/api/health/route.ts que checa presença de SUPABASE_AUTH_HOOK_SECRET, RESEND_API_KEY, UPSTASH_*, TURNSTILE_* e retorna 503 com lista do que falta — pra alarme em deploy. (2) Validação em build/startup (ex: em next.config.ts ou um lib/env.ts com checagem) que falha o build se as envs críticas de auth faltarem em produção. Manter o hook retornando 500 (correto — Supabase faz retry), mas garantir que o problema seja detectado antes de chegar em usuário real.  

**11. Testes vitest do ciclo de vida de auth + smoke E2E** — _L · 2-3d_  
Criar testes em services/__tests__ e lib: (1) lib/__tests__/rate-limit.test.ts (fail-open quando Upstash off, contagem de janela). (2) lib/__tests__/captcha.test.ts (verifyTurnstile mockado: token válido/inválido, Cloudflare down → fail-open). (3) Teste da lógica do trigger handle_new_auth_user via SQL: idempotência (rodar 2x não cria 2 households), exception swallowed (invite inválido não aborta), fallback de invite expirado. Rodar contra um schema local/pg-mem ou validar a migration com `supabase db lint` + um script de smoke que insere em auth.users e checa public.users. (4) Teste do gate de email no middleware (user sem email_confirmed_at → redirect /confirme-email). Garantir que o conjunto roda em `vitest run` (npm test).  

**12. Documentar rollback, runbook e atualizar .env.example/README** — _S · <½d_  
Fechar pendências operacionais: (1) Documentar em README/docs o procedimento de rollback de cada migration nova (drop trigger on_auth_user_created, restaurar generate_household_invite antigo). (2) Runbook 'conta presa': como o suporte usa /onboarding/fix ou createAdminClient pra re-rodar bootstrap_household manualmente. (3) Atualizar .env.example com TODAS as envs novas (TURNSTILE_*, UPSTASH_*) e marcar quais são obrigatórias em prod. (4) Checklist de go-live: confirmar enable_confirmations no dashboard espelha o config.toml, captcha ligada, hook secret setado (validado pelo /api/health).  

</details>

**Riscos de execução:**
- Trigger AFTER INSERT em auth.users roda no contexto do Supabase Auth (role supabase_auth_admin): se a função lançar exceção, o signup inteiro falha (auth.user não é criado). A função de trigger DEVE engolir erros (exception when others) e nunca abortar — risco de quebrar TODO o signup se mal escrita.
- O trigger precisa derivar household_name/display_name/invite_code de NEW.raw_user_meta_data e decidir entre criar lar vs. redeem invite — se o invite for inválido no momento do trigger (expirado/usado), precisa de fallback (criar lar próprio ou marcar conta como pendente) pra não deixar conta órfã.
- Duplicação de lógica: bootstrap passa a existir em 3 lugares (trigger SQL, callback, login retry). Tem que ser estritamente idempotente (já é: retorna cedo se users existe) pra não criar households duplicados em corrida.
- Ligar email confirmation gate vai quebrar contas de teste/seed existentes sem email_confirmed_at — precisa de migration de backfill confirmando emails atuais antes de ativar o gate.
- Turnstile adiciona fricção e pode bloquear usuários legítimos (modo non-interactive mitiga); precisa de fail-open controlado se o serviço Cloudflare cair, senão derruba todo o signup.
- Rate-limit com Upstash é uma dependência de rede no caminho crítico de login — se o Redis ficar indisponível, decidir fail-open (deixa passar) e logar, nunca fail-closed que bloqueia logins legítimos.
- Encurtar/alongar o código de convite muda o formato exibido na UI (maxLength=8 no input) e o schema Zod (max 16) — atualizar ambos junto com a migration pra não rejeitar códigos novos.

**Env vars desta dimensão:** `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AUTH_RATELIMIT_DISABLED`


### SEC — Segurança e controle de custo (rate-limit/cota de IA)

> **Score atual 4/10 → meta 10/10**  ·  **11 dias-pessoa**  ·  **11 tarefas**  ·  entra na **Fase 2**


**Estratégia.** O buraco principal é custo de IA não-enforçado: 3 rotas chamam OpenAI verificando só sessão. Como o stack é Supabase/Postgres e migrations já rodam via Management API, a base do rate-limit/cota deve ser uma RPC atômica em Postgres (SECURITY DEFINER, INSERT...ON CONFLICT contável por janela) — zero nova infra externa, transacional e por-household; reservo Upstash só como decisão opcional se quiserem edge-level throttle em rotas públicas. Construo uma única lib `lib/rate-limit.ts` + RPC `consume_rate_limit`, aplico em TODAS as rotas que tocam APIs pagas (OpenAI, brapi, Nominatim) com cota por tier + cooldown + enforcement do costCents em ledger; depois fecho hardening (headers de segurança, guard de DB nas RPCs admin, mime-type, captcha no signup, cron auth). Cada item entrega com migration + teste + rollback pra ficar 10/10 sem pendência.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **DECISÃO: backend de rate-limit (Postgres RPC vs Upstash) + política de cotas por tier** | S | — | `lib/billing/ai-quota-config.ts` |
| 2 | **Migration: tabela rate_limit_counters + RPC atômica consume_rate_limit** | L | DECISÃO: backend de rate-limit (Postgres RPC vs Upstash) + política de cotas por tier | `supabase/migrations/20260601000000_rate_limit.sql` |
| 3 | **lib/rate-limit.ts — wrapper TS sobre a RPC + helper checkAndConsume** | M | Migration: tabela rate_limit_counters + RPC atômica consume_rate_limit | `lib/rate-limit.ts`, `lib/billing/ai-quota-config.ts` |
| 4 | **Enforcement nas 3 rotas de IA (detect-subscriptions, run-ai-audit, inbox upload+reextract)** | M | lib/rate-limit.ts — wrapper TS sobre a RPC + helper checkAndConsume | `app/(app)/assinaturas/_actions/detect-subscriptions.ts`, `app/(app)/ir/[year]/auditoria/_actions/run-ai-audit.ts`, `app/(app)/inbox/_actions/upload.ts`, `services/inbox/document-uploads.ts` |
| 5 | **Fechar o leak de métricas admin: guard no banco das RPCs SECURITY DEFINER** | M | — | `supabase/migrations/20260601010000_admin_rpc_guard.sql` |
| 6 | **Proteger rotas API públicas que proxyam APIs pagas/limitadas** | M | lib/rate-limit.ts — wrapper TS sobre a RPC + helper checkAndConsume | `app/api/quotes/route.ts`, `app/api/assets/search/route.ts`, `app/api/geocode/route.ts`, `lib/geocoding.ts` |
| 7 | **Headers de segurança via next.config.ts headers()** | M | — | `next.config.ts`, `lib/supabase/middleware.ts` |
| 8 | **Validar mime-type no path admin do upload (não confiar no client)** | M | — | `services/inbox/document-uploads.ts`, `services/inbox/extract-document.ts` |
| 9 | **CAPTCHA no signup + hardening do cron auth** | L | — | `app/(auth)/cadastro/actions.ts`, `app/(auth)/cadastro/signup-form.tsx`, `lib/cron-auth.ts`, `app/api/cron/notifications/route.ts` |
| 10 | **Auditoria de authz em todas server actions/rotas + UI de erro de cota** | L | Enforcement nas 3 rotas de IA (detect-subscriptions, run-ai-audit, inbox upload+reextract) | `app/(app)/assinaturas/page.tsx`, `app/(app)/ir/[year]/auditoria/page.tsx`, `app/(app)/inbox/page.tsx`, `services/system-alerts.ts` |
| 11 | **Cron de GC dos counters + testes + verificação de migrations** | L | Auditoria de authz em todas server actions/rotas + UI de erro de cota | `app/api/cron/cleanup-rate-limit/route.ts`, `vercel.json`, `lib/__tests__/rate-limit.test.ts`, `lib/__tests__/cron-auth.test.ts` |

<details><summary>Detalhe de cada tarefa</summary>


**1. DECISÃO: backend de rate-limit (Postgres RPC vs Upstash) + política de cotas por tier** — _S · <½d_  
Dono decide: (a) backend — recomendo Postgres RPC atômica (transacional, por-household, zero infra/env nova, alinhado a migrations via Management API); Upstash só se quiserem throttle edge nas rotas públicas anônimas. (b) Política concreta: por tier (free/pro/family/lifetime já existem em households.subscription_tier), definir budget mensal de IA em centavos + nº máx de chamadas/dia por ação (detect-subscriptions, tax-audit, inbox-extract) + cooldown entre chamadas (ex: free=3 audits/dia, 50 inbox-extract/mês, R$ 200 cents/mês de teto; pro=10x). Documentar a tabela de limites num único arquivo de config.  
⚠️ _Decisão do dono:_ Backend Postgres-RPC vs Upstash; e os números exatos de cota/cooldown por tier e por ação de IA.  

**2. Migration: tabela rate_limit_counters + RPC atômica consume_rate_limit** — _L · 2-3d_  
Criar migration supabase/migrations/20260601000000_rate_limit.sql. Tabela rate_limit_counters(household_id uuid, bucket text, window_start timestamptz, count int, cost_cents int, PRIMARY KEY(household_id,bucket,window_start)). RPC consume_rate_limit(p_household_id, p_bucket text, p_max_count int, p_window_seconds int, p_cost_cents int default 0, p_max_cost_cents int default null) RETURNS jsonb {allowed bool, remaining int, retry_after_seconds int, cost_used int} — usa INSERT ... ON CONFLICT DO UPDATE com window truncado, faz o check-and-increment numa única transação (anti-race). SECURITY DEFINER, search_path=public, REVOKE FROM public, sem GRANT a authenticated (só service_role chama). Index parcial pra limpar janelas velhas. Incluir RPC companion cleanup_rate_limit_counters() pra cron de GC.  

**3. lib/rate-limit.ts — wrapper TS sobre a RPC + helper checkAndConsume** — _M · ~1d_  
Criar lib/rate-limit.ts exportando checkRateLimit({householdId, bucket, maxCount, windowSeconds, costCents?, maxCostCents?}) que chama supabase.rpc('consume_rate_limit') via createAdminClient e retorna {allowed, remaining, retryAfter}. Exportar erro tipado RateLimitError com retryAfter. Helper enforceAiQuota(householdId, tier, action) que lê lib/billing/ai-quota-config.ts e aplica DOIS buckets: contagem-diária e budget-mensal-de-custo. Tudo server-only.  

**4. Enforcement nas 3 rotas de IA (detect-subscriptions, run-ai-audit, inbox upload+reextract)** — _M · ~1d_  
Pre-flight: chamar enforceAiQuota(ctx.household.id, ctx.household.subscription_tier, action) ANTES de detectSubscriptions()/runTaxAudit()/extractDocument(). Em runDetectSubscriptions (linha 25) e runAiAudit (linha 16) e reextractAction (upload.ts:135, que hoje pula getMonthlyCount) e uploadAndExtractAction. Post-flight: após sucesso, debitar o costCents real no bucket mensal de custo via checkRateLimit costCents (enforcement do costCents que hoje só é registrado). Em estouro retornar {ok:false, error:'Limite de IA atingido (...). Tente em X.'} sem chamar OpenAI. reextractAction também precisa contar contra MONTHLY_LIMIT_PER_HOUSEHOLD do inbox (chamar getMonthlyCount).  

**5. Fechar o leak de métricas admin: guard no banco das RPCs SECURITY DEFINER** — _M · ~1d_  
BUG confirmado: admin_household_growth/admin_user_growth/admin_action_volume (20260524020000:152-230) e admin_platform_stats (20260524000000:236-264) são SECURITY DEFINER com GRANT EXECUTE TO authenticated e NENHUM guard interno — qualquer user logado roda supabase.rpc('admin_platform_stats') e lê totais globais (households, users, assinaturas, data-requests). Migration nova que recria cada função com 'if not public.is_platform_admin() then raise exception ''forbidden''; end if;' no topo (precisa virar plpgsql) OU REVOKE EXECUTE de authenticated e só service_role chama (já que o TS usa admin client pós-guard). Recomendo REVOKE de authenticated — mais simples e o caller já é admin client. Testar que user comum recebe erro.  

**6. Proteger rotas API públicas que proxyam APIs pagas/limitadas** — _M · ~1d_  
/api/quotes (brapi) e /api/assets/search e /api/geocode hoje são GET sem auth.getUser() nem throttle. (1) Adicionar checagem de sessão (createClient + auth.getUser; 401 se anônimo). (2) Aplicar checkRateLimit por household (ou por IP via x-forwarded-for se for legítimo anônimo) — ex: 60 req/min em /api/quotes. (3) /api/geocode é CÓDIGO MORTO (feature trips dropada em 20260531000000_drop_trips.sql, sem caller no client) — DELETAR o arquivo e lib/geocoding.ts. (4) Validar/cap o nº de tickers por request em /api/quotes (ex: max 50) pra evitar amplificação.  

**7. Headers de segurança via next.config.ts headers()** — _M · ~1d_  
Adicionar async headers() em next.config.ts retornando p/ todas as rotas: Strict-Transport-Security (max-age=63072000; includeSubDomains; preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera=(),microphone=(),geolocation=()). CSP: começar com Content-Security-Policy-Report-Only (medir quebras com Supabase/Vercel/recharts/leaflet removido junto com trips) e depois promover a enforcing. Definir CSP com nonce no middleware se inline scripts existirem (Next injeta alguns).  

**8. Validar mime-type no path admin do upload (não confiar no client)** — _M · ~1d_  
createDocumentUpload (document-uploads.ts:240-246) faz upload via service_role bypassa a allowlist de mime do bucket; extract-document.ts:385-435 confia em mimeType do client (forjável). Detectar o tipo real por magic-bytes (assinatura do buffer: %PDF, JPEG FFD8, PNG 89504E47) com lib file-type, rejeitar se não bater com allowlist (pdf/jpeg/png/webp). Usar o tipo detectado — não file.type — ao enviar pra OpenAI e ao gravar mime_type. Cap também o tamanho real do buffer (já tem 15MB) e nº de páginas se PDF.  
_Pacotes:_ `file-type`  

**9. CAPTCHA no signup + hardening do cron auth** — _L · 2-3d_  
(1) Signup (cadastro/actions.ts:81-88) sem captcha na app. Integrar Cloudflare Turnstile: widget no signup-form.tsx, validar o token no server action antes de supabase.auth.signUp (POST p/ siteverify com TURNSTILE_SECRET_KEY); rejeitar se inválido. Também ligar captcha provider no Supabase Auth dashboard (decisão de config). (2) Cron auth (notifications/route.ts:15-21 e todos os api/cron/*): tornar CRON_SECRET OBRIGATÓRIO — exigir Bearer CRON_SECRET sempre, e aceitar x-vercel-cron só como sinal adicional, nunca sozinho. Extrair isAuthorized p/ lib/cron-auth.ts compartilhada e aplicar em TODAS as 15 rotas de cron.  

**10. Auditoria de authz em todas server actions/rotas + UI de erro de cota** — _L · 2-3d_  
Varredura sistemática: grep por 'use server' e route.ts garantindo que toda action faz getCurrentUserContext() e que toda mutation valida household_id do recurso (padrão do reextractAction:127 é o correto; replicar onde falte). Criar checklist em teste. Surfacing UX: tratar RateLimitError nas 3 telas de IA (assinaturas, ir/auditoria, inbox) mostrando 'tente em Xmin' + remaining; mostrar cota restante no tier. Registrar system-alert quando household estoura budget mensal (sinal de abuso/upgrade).  

**11. Cron de GC dos counters + testes + verificação de migrations** — _L · 2-3d_  
(1) Rota api/cron/cleanup-rate-limit chamando cleanup_rate_limit_counters() (apaga janelas > 60d) + entrada no vercel.json. (2) Testes vitest: lib/rate-limit (allow/deny/cooldown/race via chamadas concorrentes), enforceAiQuota por tier, guard das RPCs admin (user comum recebe forbidden — teste de integração contra a RPC), mime-type rejeitando arquivo forjado, cron-auth rejeitando sem secret. (3) Rollback documentado por migration (DROP FUNCTION/TABLE). (4) Aplicar as migrations via Management API e rodar npm run typecheck + test antes de fechar.  

</details>

**Riscos de execução:**
- Race condition: o check-and-increment PRECISA ser atômico na RPC (INSERT ON CONFLICT DO UPDATE numa transação). Fazer SELECT-then-INSERT no TS reabre o buraco — dois requests simultâneos passariam. Testar concorrência de verdade.
- CSP enforcing pode quebrar Supabase realtime, Vercel analytics, recharts/leaflet e inline styles do Next — por isso começar em Report-Only e medir antes de promover, senão derruba o app em prod.
- Mudar admin RPCs de SECURITY DEFINER+grant-authenticated para REVOKE pode quebrar algum caller que use client de usuário em vez de admin client; auditar TODOS os callers de admin_* antes de aplicar (services/admin-metrics.ts e platform-admin.ts usam admin client, ok, mas confirmar).
- enforceAiQuota lê subscription_tier do household; se o billing/Stripe ainda não popula tier corretamente, todos caem no default 'free' e podem ser bloqueados cedo demais — coordenar com a dimensão de billing.
- Turnstile adiciona fricção no signup e depende de config no dashboard Supabase também; se só validar na app e não no Supabase Auth, ainda há a rota de signUp direta via API anon key — precisa dos dois lados.
- Os preços OpenAI hardcoded em lib/openai/client.ts (USD→BRL 5.5, gpt-4o-mini) ficam defasados; o budget mensal em centavos vai derivar errado se o modelo/câmbio mudar. Centralizar e revisar o pricing junto com a cota.
- Rotas /api/quotes hoje são chamadas a cada ~60s pelo client logado; um rate-limit muito apertado quebra o auto-refresh de cotações — calibrar o limite por household acima do ritmo legítimo do polling.

**Env vars desta dimensão:** `AI_MONTHLY_BUDGET_CENTS_FREE`, `AI_MONTHLY_BUDGET_CENTS_PRO`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `BRAPI_TOKEN`


### LGPD — LGPD/privacidade completa

> **Score atual 4/10 → meta 10/10**  ·  **18 dias-pessoa**  ·  **20 tarefas**  ·  entra na **Fase 3**


**Estratégia.** Tornar reais os três direitos do titular que hoje são teatro: (1) exportação COMPLETA por tabela-driven (uma única fonte da verdade que lista as ~48 tabelas de dados do usuário, consumida tanto pelo self-service quanto pelo admin), (2) consentimento com GATE server-side de verdade no middleware + nas server actions de escrita (não overlay), (3) exclusão de conta AUTOMÁGICA e verificável via RPC transacional `delete_account_complete` que apaga household (cascade nas 44+4 tabelas) E o auth.user, com prova de eliminação persistida. Em paralelo: estreitar o RLS do contador por ano nas tabelas transacionais, respeitar os flags analytics/marketing em runtime, e fechar a malha com retenção/anonimização documentada e testes de integração que provam que export não tem buraco e delete não deixa órfão. Cada item entrega com migration + rollback + teste, sem pendência.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Criar manifesto único de tabelas de dados pessoais (single source of truth)** | M | — | `lib/lgpd/data-tables.ts` |
| 2 | **Reescrever exportUserData() pra cobrir TODAS as ~48 tabelas via manifesto** | L | Criar manifesto único de tabelas de dados pessoais (single source of truth) | `services/lgpd.ts` |
| 3 | **Refatorar o export admin pra reusar o mesmo gerador** | M | Reescrever exportUserData() pra cobrir TODAS as ~48 tabelas via manifesto | `app/api/admin/export/route.ts`, `lib/lgpd/export.ts` |
| 4 | **Export self-service real: rota de download + UI** | M | Refatorar o export admin pra reusar o mesmo gerador | `app/api/export/route.ts`, `components/lgpd/export-data-button.tsx`, `app/(app)/configuracoes/privacidade/page.tsx` |
| 5 | **Migration: RPC transacional delete_account_complete + tabela de prova de eliminação** | L | Criar manifesto único de tabelas de dados pessoais (single source of truth) | `supabase/migrations/20260601000000_lgpd_account_deletion.sql` |
| 6 | **Corrigir/expandir reset_household_data pra não deixar tabelas órfãs** | M | Migration: RPC transacional delete_account_complete + tabela de prova de eliminação | `supabase/migrations/20260601001000_fix_reset_household.sql` |
| 7 | **Server action de auto-exclusão verificável (substituir fila manual)** | L | Corrigir/expandir reset_household_data pra não deixar tabelas órfãs | `services/lgpd.ts`, `services/lgpd.actions.ts`, `components/lgpd/delete-account-form.tsx` |
| 8 | **Cron de execução de exclusões pendentes (se grace period) + SLA de 15 dias** | M | Server action de auto-exclusão verificável (substituir fila manual) | `app/api/cron/process-data-deletions/route.ts`, `vercel.json` |
| 9 | **Atualizar handleDataRequest e a UI admin pra refletir automação real** | M | Server action de auto-exclusão verificável (substituir fila manual) | `services/platform-admin.actions.ts`, `components/admin/data-request-actions.tsx` |
| 10 | **Gate de consentimento server-side no middleware (não overlay)** | L | — | `lib/supabase/middleware.ts`, `app/(app)/aceitar-termos/page.tsx`, `services/lgpd.ts`, `supabase/migrations/20260601002000_consent_version_cache.sql` |
| 11 | **Gate de consentimento server-side nas server actions de escrita (defense in depth)** | L | Gate de consentimento server-side no middleware (não overlay) | `services/auth-guards.ts`, `services/transactions.actions.ts`, `services/investments.actions.ts`, `services/ir/*.actions.ts` |
| 12 | **Respeitar flags analytics_cookies e marketing_emails em runtime** | M | — | `lib/lgpd/consent-runtime.ts`, `services/email.ts`, `app/layout.tsx` |
| 13 | **Estreitar RLS do contador por ano nas tabelas transacionais** | L | — | `supabase/migrations/20260601003000_accountant_year_scope.sql` |
| 14 | **Enforçar audit do contador no banco (não fire-and-forget de app)** | M | Estreitar RLS do contador por ano nas tabelas transacionais | `services/accountant-data.ts`, `services/accountant-auth.ts` |
| 15 | **Política de retenção e anonimização documentada + implementada** | M | Server action de auto-exclusão verificável (substituir fila manual) | `lib/lgpd/retention.ts`, `app/api/cron/retention-purge/route.ts`, `app/(public)/privacidade/page.tsx` |
| 16 | **Teste de cobertura de export: garantir ZERO buraco (anti-regressão)** | M | Refatorar o export admin pra reusar o mesmo gerador | `services/__tests__/lgpd-export-coverage.test.ts`, `lib/lgpd/data-tables.ts` |
| 17 | **Teste de integração de exclusão: provar que delete não deixa órfão** | L | Migration: RPC transacional delete_account_complete + tabela de prova de eliminação | `services/__tests__/lgpd-deletion.test.ts`, `supabase/config.toml` |
| 18 | **Teste do gate de consentimento (middleware + action)** | M | Gate de consentimento server-side nas server actions de escrita (defense in depth) | `lib/lgpd/consent-gate.ts`, `lib/lgpd/__tests__/consent-gate.test.ts` |
| 19 | **CI mínimo que barra regressão LGPD (typecheck+lint+test) — pré-requisito de confiança** | S | Teste de cobertura de export: garantir ZERO buraco (anti-regressão) | `.github/workflows/ci.yml` |
| 20 | **Atualizar textos legais e versionar termos (fechar a malha)** | M | Política de retenção e anonimização documentada + implementada | `app/(public)/termos/page.tsx`, `app/(public)/privacidade/page.tsx`, `services/lgpd.ts` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Criar manifesto único de tabelas de dados pessoais (single source of truth)** — _M · ~1d_  
Criar lib/lgpd/data-tables.ts exportando um array tipado USER_DATA_TABLES descrevendo, pra cada tabela, como filtrá-la pelo householdId/userId. Categorizar em: (a) 44 tabelas com household_id direto -> filtro .eq('household_id', hh); (b) 4 tabelas indiretas (goal_contributions, goal_sources, transaction_splits, trip_budget_items) -> join via parent !inner; (c) 6 user-scoped (user_consents, data_access_requests, announcement_dismissals, email_notifications_log + excluir admin_audit_log/platform_admins que NÃO são dados do titular) -> filtro .eq('user_id', uid). EXCLUIR explicitamente as 13 tabelas de sistema/referência (currency_rates, ir_tax_table_annual/monthly, quote_history, quote_snapshots, tesouro_quotes, known_institutions, indexer_history, system_settings, feature_flags, announcements, accountant_profiles, households como entidade já tratada à parte). Marcar accountant_audit_log/accountant_household_access/accountant_invites como 'incluir no export do titular' (transparência) mas 'cascade no delete'. Cada entrada: {table, scope:'household'|'household_via'|'user', parentJoin?, includeInExport, deleteVia:'cascade'|'explicit'}. Esse arquivo vira a base de export, delete e teste de cobertura.  
⚠️ _Decisão do dono:_ Confirmar com o dono se accountant_audit_log e accountant_documents/notes (dados que o CONTADOR criou) devem entrar no export do titular — recomendo SIM (transparência art.18) e cascade no delete.  

**2. Reescrever exportUserData() pra cobrir TODAS as ~48 tabelas via manifesto** — _L · 2-3d_  
Reescrever services/lgpd.ts:160-245 (exportUserData) pra iterar sobre USER_DATA_TABLES e montar o objeto `data` dinamicamente, em vez das 14 queries hardcoded. Para scope 'household' usar .eq('household_id', householdId); para 'household_via' usar o parentJoin (ex.: investment:investments!inner(household_id)); para 'user' usar .eq('user_id', userId). Manter user/household/auth no topo. Atualizar o lgpd_notice e o comentário do cabeçalho (linha 157) que mente 'TODOS os dados'. Garantir resiliência: se uma query falhar, registrar a tabela em `_export_errors` em vez de silenciar — export incompleto NÃO pode ser apresentado como completo. Paginar tabelas grandes (transactions pode ter milhares de linhas) com range() em lotes de 1000.  

**3. Refatorar o export admin pra reusar o mesmo gerador** — _M · ~1d_  
Extrair o gerador de payload de export pra uma função pura buildUserExport(admin, userId, householdId) em services/lgpd.ts (ou lib/lgpd/export.ts) e fazer app/api/admin/export/route.ts:37-111 consumir essa função em vez de duplicar as 14 queries. Assim export self-service e export admin ficam SEMPRE sincronizados (hoje divergem só por cópia-cola). Manter o header Content-Disposition e a flag exported_by_admin.  

**4. Export self-service real: rota de download + UI** — _M · ~1d_  
Hoje o titular só consegue export via pedido manual atendido por admin. Criar app/api/export/route.ts (GET, auth via cookie do próprio user) que chama buildUserExport para o household do usuário logado e devolve JSON com Content-Disposition. Adicionar botão 'Baixar meus dados (JSON)' na página de privacidade do usuário (provavelmente app/(app)/configuracoes/privacidade ou componente existente que usa requestDataAccess) que aponta pra essa rota. Registrar o download como data_access_request type='export' status='completed' + linha em user_consents-style audit. Aplicar rate-limit (1 export / 10 min) pra não virar vetor de DoS/scraping.  
⚠️ _Decisão do dono:_ Definir se export é entregue inline (download direto) ou assíncrono via Storage signed URL com email. Recomendo inline pro MVP (dados cabem em memória) e migrar pra assíncrono só se households ficarem enormes.  

**5. Migration: RPC transacional delete_account_complete + tabela de prova de eliminação** — _L · 2-3d_  
Criar supabase/migrations/<ts>_lgpd_account_deletion.sql com: (1) tabela public.account_deletions (id, user_id, household_id, requested_at, executed_at, deleted_tables jsonb, deleted_auth_user boolean, executed_by text) como PROVA imutável de eliminação (retida mesmo após delete — sem FK pra users/households pra não cascatear). (2) função security definer public.delete_household_and_user(p_user_id uuid, p_household_id uuid) que: apaga as 6 tabelas user-scoped que NÃO cascateiam por household (user_consents, data_access_requests, announcement_dismissals, email_notifications_log) EXCETO o registro de prova; faz delete from households where id=p_household_id (cascateia as 44+4 tabelas household-scoped); insere o registro de prova em account_deletions. A remoção do auth.users é feita pelo app (admin.auth.admin.deleteUser) DEPOIS da RPC, pois RPC não acessa auth.admin. Tudo numa transação. Incluir rollback (.down ou migration reversa documentada). ATENÇÃO: tratar households com >1 membro — se houver outros usuários ativos, NÃO apagar o household, só o user solicitante (decisão do dono).  
⚠️ _Decisão do dono:_ Política pra household com múltiplos membros: apagar conta individual só remove o user (mantém household) OU exige transferência/concordância dos demais? Recomendo: se o solicitante é o único membro -> apaga tudo; se há outros -> apaga só o user e transfere ownership pro próximo admin, registrando no audit.  

**6. Corrigir/expandir reset_household_data pra não deixar tabelas órfãs** — _M · ~1d_  
reset_household_data() em supabase/migrations/20260522090000_reset_household.sql:11-39 deleta só 10 tabelas e omite TODO o IR, debts, category_budgets, snapshots, trips, fontes_pagadoras, etc. — bug paralelo ao do export. Substituir o corpo por delete from households-pattern restrito (não dá, é reset não delete) -> reescrever pra deletar explicitamente todas as 44 household-tables (exceto users/households) na ordem de FK correta, OU melhor: deletar via cascade desabilitando re-seed e re-seedar. Criar migration nova supabase/migrations/<ts>_fix_reset_household.sql com create or replace. Adicionar teste de integração que cria household cheio, roda reset, e afirma que TODAS as tabelas household-scoped ficaram vazias (exceto categorias re-seedadas).  

**7. Server action de auto-exclusão verificável (substituir fila manual)** — _L · 2-3d_  
Criar em services/lgpd.ts uma action executeSelfDeletion(confirmText, password) que: (1) revalida a sessão e re-autentica (reauth com senha via supabase.auth para evitar exclusão por sessão sequestrada); (2) marca data_access_requests type='delete' como in_progress; (3) chama RPC delete_household_and_user; (4) chama admin.auth.admin.deleteUser(userId); (5) atualiza data_access_requests -> completed com result_payload {deleted_at, tables_count}; (6) faz signOut. Atualizar components/lgpd/delete-account-form.tsx:24-25 pra: enviar o `reason` (hoje descartado) e chamar executeSelfDeletion em vez de só requestDataAccess('delete'). Adicionar janela de carência (grace period) de N dias OU exclusão imediata — decisão do dono. Se grace: agendar via cron a execução; se imediata: executar na hora. Mostrar à UI 'conta excluída' e redirect.  
⚠️ _Decisão do dono:_ Exclusão IMEDIATA (clica e apaga, com reauth) vs GRACE PERIOD de 7-15 dias (soft-deactivate + cron apaga depois, permite arrependimento). LGPD permite ambos; recomendo grace de 7 dias com soft-deactivate (já existe is_active/deactivated_at em users) + cron que executa o hard-delete e barra login no intervalo.  

**8. Cron de execução de exclusões pendentes (se grace period) + SLA de 15 dias** — _M · ~1d_  
Criar app/api/cron/process-data-deletions/route.ts (estilo dos crons existentes, auth via CRON_SECRET) que: varre data_access_requests type='delete' status='in_progress' cujo grace period venceu e executa delete_household_and_user + auth.admin.deleteUser; e tambpeém varre type='delete'/'export' status='pending' com requested_at > 13 dias e dispara alerta (email pro admin + system_alerts) pra não estourar o SLA legal de 15 dias. Registrar em vercel.json/cron config. Atualizar o badge de 15 dias da UI pra refletir o SLA real com automação por trás.  

**9. Atualizar handleDataRequest e a UI admin pra refletir automação real** — _M · ~1d_  
handleDataRequest em services/platform-admin.actions.ts:287-319 hoje só troca status='completed' SEM apagar nada (admin pode marcar 'atendido' com dados intactos). Adicionar branch: quando request_type='delete' e action='complete', a action DEVE chamar delete_household_and_user + auth.admin.deleteUser (não só update de status), recusando 'complete' se a eliminação não rodar. Reescrever components/admin/data-request-actions.tsx:68-79 removendo as instruções manuais ('use a página do usuário pra fazer o hard-delete') e trocando por um botão 'Executar eliminação agora' que de fato apaga, com confirmação por digitação do email. Registrar a prova em account_deletions.  

**10. Gate de consentimento server-side no middleware (não overlay)** — _L · 2-3d_  
O overlay em components/lgpd/consent-banner.tsx:42-46 é pointer-events-none + o layout (app/(app)/layout.tsx:124-129) renderiza tudo antes; puramente cosmético. Implementar gate REAL: em lib/supabase/middleware.ts, onde já se busca userProfile (linha 59-70), adicionar uma checagem leve de consentimento. Como middleware não deve fazer query pesada, criar coluna households/users.terms_accepted_version (ou tabela cache) atualizada no grantConsent, e no middleware: se isTitular && terms_accepted_version != TERMS_VERSION && pathname não é /termos|/privacidade|/aceitar-termos|/api/logout -> redirect 307 pra /aceitar-termos. Criar página app/(app)/aceitar-termos/page.tsx dedicada (full-screen, sem sidebar) que força o aceite e só então libera. Manter o banner como UX complementar, mas o ENFORCEMENT é o redirect.  
⚠️ _Decisão do dono:_ Onde cachear a versão aceita pra leitura barata no middleware: coluna em users (por-usuário) vs em households. Recomendo coluna users.accepted_terms_version + users.accepted_privacy_version (cada membro aceita individualmente).  

**11. Gate de consentimento server-side nas server actions de escrita (defense in depth)** — _L · 2-3d_  
Middleware cobre navegação, mas server actions e rotas de API podem ser chamadas direto sem passar pela checagem de página. Criar helper services/auth-guards.ts -> assertTermsAccepted() que throw/retorna erro se o user logado não aceitou TERMS_VERSION/PRIVACY_VERSION atuais, reusando hasAcceptedCurrentTerms(). Aplicar no início das server actions de MUTAÇÃO de dados (transactions, accounts, investments, ir/*, goals, debts) — pelo menos nas que criam/alteram dados pessoais. Idealmente via um wrapper withTermsGate() para não esquecer em cada action. NÃO bloquear actions de leitura nem a própria action de aceitar termos / logout / export / delete.  

**12. Respeitar flags analytics_cookies e marketing_emails em runtime** — _M · ~1d_  
Hoje analytics_cookies/marketing_emails são coletados mas nunca lidos fora do módulo LGPD (consentimento teatral). Criar lib/lgpd/consent-runtime.ts com getConsent(type) server-side e um hook client useConsent(type) (lê de cookie/contexto). (1) MARKETING: em services/email.ts, antes de queueEmail com notificationType de marketing/newsletter, checar consentimento marketing_emails do destinatário e pular se revogado. (2) ANALYTICS: se/quando houver script de analytics, montá-lo condicionalmente ao analytics_cookies=true (gate no root layout). Como ainda não há analytics, criar o ponto de gate documentado + um teste que prova que email marketing não é enfileirado sem consentimento. Garantir que emails TRANSACIONAIS (não-marketing) continuam saindo independente do flag.  

**13. Estreitar RLS do contador por ano nas tabelas transacionais** — _L · 2-3d_  
Em supabase/migrations/20260524060000_accountant_access.sql:238-244, as policies de transactions/categories/accounts usam is_accountant_with_access(household_id) SEM year, então um contador convidado só pra 2024 vê transações/contas de TODOS os anos — mais amplo que o DPA. Criar migration nova supabase/migrations/<ts>_accountant_year_scope.sql que: (1) substitui a policy de transactions por is_accountant_with_access(household_id) AND extract(year from date) = any(years_allowed) — adicionar variante da função is_accountant_with_access que recebe o ano da linha, OU filtrar via subquery. accounts/categories são atemporais: decidir se contador vê todas (necessário pra montar Bens e Direitos do ano) ou só as usadas no(s) ano(s) liberado(s). Recomendo: transactions/investment_movements filtram por ano; accounts/categories/investments ficam visíveis (são catálogo, sem dado financeiro datado), mas documentar isso explicitamente no DPA. (2) Atualizar o texto do DPA/convite pra refletir o escopo real.  
⚠️ _Decisão do dono:_ accounts/categories/investments: restringir por ano (mais privado, mas pode quebrar a montagem de Bens) ou manter visível como catálogo? Recomendo manter catálogo visível + filtrar transactions/movements por ano, e deixar isso explícito no DPA.  

**14. Enforçar audit do contador no banco (não fire-and-forget de app)** — _M · ~1d_  
logAccountantAction em services/accountant-auth.ts:152-179 é fire-and-forget e só chamado manualmente em 2 lugares; qualquer leitura nova esquecida acessa dados de terceiro sem registro. Mitigar: (1) criar um trigger/log no banco que registre acessos de contador às tabelas IR sensíveis (via uma view security_barrier ou função wrapper que o app é OBRIGADO a chamar), OU (2) centralizar TODA leitura de contador num único data-access layer services/accountant-data.ts que loga antes de retornar, e proibir (via lint rule/code review) leitura direta de tabelas no contexto contador. Pragmaticamente: criar services/accountant-data.ts como única porta de entrada + remover acesso direto. Garantir que o audit insert NÃO seja silenciosamente engolido (await + tratar erro: se falhar o log, falha a leitura).  

**15. Política de retenção e anonimização documentada + implementada** — _M · ~1d_  
Definir e implementar retenção: (1) account_deletions e admin/accountant audit logs RETIDOS (prova legal, anonimizados — só guardam ids/timestamps, sem PII financeira). (2) email_notifications_log com TTL (ex.: purgar > 12 meses) via cron. (3) data_access_requests retidos por X anos como prova de atendimento LGPD. (4) Anonimização: ao invés de hard-delete imediato em cenários de retenção fiscal, oferecer pseudonimização (já há soft-delete em users). Criar lib/lgpd/retention.ts com as regras + cron app/api/cron/retention-purge/route.ts. Documentar tudo numa página /privacidade atualizada e num doc interno docs/lgpd-retention.md (não .md de findings — doc de produto legítimo).  
⚠️ _Decisão do dono:_ Prazos de retenção: quanto guardar audit logs, prova de eliminação e logs de email? Recomendo: prova de eliminação 5 anos, audit 5 anos, email logs 12 meses. Validar com assessoria jurídica antes do lançamento público.  

**16. Teste de cobertura de export: garantir ZERO buraco (anti-regressão)** — _M · ~1d_  
Criar services/__tests__/lgpd-export-coverage.test.ts que: (1) parseia as migrations (ou usa o manifesto USER_DATA_TABLES) e afirma que TODA tabela household_id/user_id está OU no manifesto de export OU numa allowlist explícita de 'sistema/referência' — falha o teste se alguém adicionar uma tabela nova de dados pessoais sem incluí-la no export. Isso impede a regressão que criou o buraco de 14/70. (2) Teste de integração (contra Supabase de teste) que cria um household com 1 linha em cada tabela, roda buildUserExport, e afirma que cada tabela aparece no payload com a linha. Esse é o guardrail permanente.  

**17. Teste de integração de exclusão: provar que delete não deixa órfão** — _L · 2-3d_  
Criar supabase/tests ou services/__tests__/lgpd-deletion.test.ts (integração contra DB de teste com supabase local): cria household + 1 linha em cada tabela household/user-scoped, roda delete_household_and_user + simula auth delete, e afirma que (a) toda tabela household-scoped ficou vazia pra aquele household, (b) as user-scoped foram apagadas, (c) account_deletions tem a prova, (d) nenhuma linha órfã sobrou (sweep por household_id/user_id em todas as ~48 tabelas). Esse teste é a garantia LGPD de que 'apagar' apaga de verdade.  

**18. Teste do gate de consentimento (middleware + action)** — _M · ~1d_  
Criar testes que provam: (1) usuário sem aceite atual é redirecionado pra /aceitar-termos pelo middleware (teste unitário da função de gate extraída do middleware, alimentada com mocks de profile/version); (2) server action de mutação rejeita quando assertTermsAccepted falha; (3) após grantConsent, accepted_terms_version é atualizado e o gate libera. Extrair a lógica de decisão do middleware pra uma função pura testável (ex.: lib/lgpd/consent-gate.ts shouldBlock(profile, pathname)) pra permitir teste sem montar NextRequest real.  

**19. CI mínimo que barra regressão LGPD (typecheck+lint+test) — pré-requisito de confiança** — _S · <½d_  
Criar .github/workflows/ci.yml rodando em push/PR: npm ci, npm run typecheck, npm run lint, npm run test (inclui os novos testes de export-coverage, deletion e consent-gate). Sem isso, qualquer push pode reintroduzir o buraco de export ou quebrar o gate sem nada barrar. Adicionar branch protection na main exigindo o check verde. (Esta tarefa é compartilhada com a dimensão de testing/observability, mas é DEPENDÊNCIA pra travar as garantias LGPD.) Opcional: husky pre-commit rodando typecheck+test rápido.  
_Pacotes:_ `husky`  

**20. Atualizar textos legais e versionar termos (fechar a malha)** — _M · ~1d_  
Revisar/atualizar app/(public)/termos e app/(public)/privacidade pra refletir o que o sistema REALMENTE faz agora: export completo self-service, exclusão automática com prazo, retenção de prova, escopo do contador (DPA), finalidades de tratamento, base legal, contato do encarregado (DPO). Bumpar TERMS_VERSION/PRIVACY_VERSION em services/lgpd.ts:17-18 pra forçar novo aceite com o gate real já ativo. Sem isso, o app processa dados de forma incongruente com o que diz aos usuários.  
⚠️ _Decisão do dono:_ Nomear um Encarregado/DPO e canal de contato LGPD (email/endereço) — obrigatório pra SaaS público. Idealmente revisão por advogado antes do lançamento.  

</details>

**Riscos de execução:**
- Cascade de delete: confiar no households.delete() cascatear as 44+4 tabelas exige que TODA FK household_id seja realmente ON DELETE CASCADE — auditar caso a caso antes; se alguma for RESTRICT/NO ACTION o delete falha no meio e deixa estado parcial. Mitigar com a RPC transacional e teste de órfãos.
- Household multi-membro: apagar a conta de um membro pode (incorretamente) apagar o household inteiro de outros usuários. A política de ownership/transferência precisa ser decidida ANTES de habilitar auto-exclusão pública.
- Exclusão irreversível por sessão sequestrada: sem reauth (senha/MFA) antes do delete, um atacante com cookie ativo destrói tudo. Reauth é obrigatório, não opcional.
- Gate no middleware adiciona latência/queries a TODA request — usar coluna cacheada (accepted_terms_version em users), não query pesada de consents, senão degrada o app inteiro.
- Estreitar RLS do contador por ano pode quebrar a montagem de Bens/Direitos (que precisa de saldo de anos anteriores). Validar com o motor de IR antes de aplicar, pra não corromper a declaração — coordenar com a dimensão financial-correctness.
- Export inline de households grandes pode estourar memória/timeout serverless; paginação obrigatória e, se preciso, migrar pra geração assíncrona via Storage.
- Retenção vs eliminação: reter audit/prova após delete é legal, mas se a prova guardar PII financeira vira violação — a tabela de prova deve guardar só ids/contagens/timestamps anonimizados.
- Bump de TERMS_VERSION sem o gate testado em produção pode trancar TODOS os usuários existentes fora do app — fazer o deploy do gate e do versionamento de forma coordenada e testada em staging.

**Env vars desta dimensão:** `CRON_SECRET`, `LGPD_DELETION_GRACE_DAYS`, `LGPD_DPO_EMAIL`


### PERF — Performance e escala

> **Score atual 3/10 → meta 10/10**  ·  **14 dias-pessoa**  ·  **13 tarefas**  ·  entra na **Fase 3**


**Estratégia.** Atacar a escala em 3 frentes na ordem de impacto: (1) corrigir o anti-padrão de RLS envolvendo TODAS as ~122 chamadas de current_household_id() (+ auth.uid() e is_platform_admin()) em (select ...) via migration única, mais índices compostos nas colunas quentes — isso reduz o custo POR LINHA de toda query do app; (2) memoizar com React cache() os ~10 agregadores pesados pra matar a re-execução aninhada (getInsights re-dispara o que o dashboard já rodou), e cachear getCreditCardAccountIds/getRateMap; (3) tirar dependências externas e ilimitadas do caminho síncrono de render — mover brapi e computeImposto pra fora do render bloqueante (Suspense/streaming + revalidate), limitar getRateMap a 1 linha por par, e estabelecer load test (k6) com gates de p95 antes/depois pra PROVAR cada ganho. Sem load test medindo p95 sob volume realista, a dimensão não fecha 10/10.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Seed de dados sintéticos + harness de medição (baseline)** | L | — | `scripts/seed-perf.mjs`, `docs/perf-baseline.md` |
| 2 | **Load test k6 do dashboard com gates de p95** | M | Seed de dados sintéticos + harness de medição (baseline) | `perf/dashboard.k6.js`, `perf/README.md`, `package.json`, `docs/perf-baseline.md` |
| 3 | **Migration: envolver TODAS as funções SECURITY DEFINER em (select ...) nas RLS policies** | L | Load test k6 do dashboard com gates de p95 | `supabase/migrations/20260601000000_rls_select_wrapper.sql`, `scripts/gen-rls-wrapper.mjs` |
| 4 | **Migration: índices compostos nas colunas quentes** | M | Migration: envolver TODAS as funções SECURITY DEFINER em (select ...) nas RLS policies | `supabase/migrations/20260601010000_hot_path_indexes.sql`, `docs/perf-baseline.md` |
| 5 | **Memoizar agregadores pesados com React cache() por request** | M | Load test k6 do dashboard com gates de p95 | `services/transactions.ts`, `services/investments.ts`, `services/goals.ts`, `services/budgets.ts` |
| 6 | **Cachear getCreditCardAccountIds e provar dedup** | M | Memoizar agregadores pesados com React cache() por request | `services/credit-card.ts`, `services/transactions.ts`, `services/__tests__/aggregators-memoization.test.ts` |
| 7 | **Limitar getRateMap a 1 linha por par (eliminar full table scan)** | M | Migration: índices compostos nas colunas quentes | `services/currency.ts`, `supabase/migrations/20260601020000_latest_currency_rates.sql` |
| 8 | **Tirar brapi do caminho síncrono de render do dashboard** | L | Memoizar agregadores pesados com React cache() por request | `app/(app)/dashboard/page.tsx`, `services/quotes.ts`, `components/dashboard/patrimonio-composition.tsx`, `components/investments/portfolio-live-ticker.tsx` |
| 9 | **Tirar computeImposto do render bloqueante do dashboard** | L | Cachear getCreditCardAccountIds e provar dedup | `app/(app)/dashboard/page.tsx`, `components/dashboard/ir-estimate-hero.tsx`, `services/ir/imposto.ts`, `services/ir/rendimentos.ts` |
| 10 | **Paginação/teto em queries de agregação sem range** | XL | Migration: índices compostos nas colunas quentes | `supabase/migrations/20260601030000_aggregation_rpcs.sql`, `services/transactions.ts`, `services/accounts.ts`, `services/__tests__/aggregation-rpcs.test.ts` |
| 11 | **Eliminar o loop por mês de getAccountsTotalsAt em getPatrimonioHistory** | M | Paginação/teto em queries de agregação sem range | `services/patrimonio-history.ts`, `services/accounts.ts` |
| 12 | **Substituir force-dynamic + router.refresh agressivo por cache segmentado** | L | Tirar computeImposto do render bloqueante do dashboard | `app/(app)/dashboard/page.tsx`, `hooks/use-realtime-refresh.ts`, `services/transactions.actions.ts`, `services/accounts.actions.ts` |
| 13 | **Validação final: rodar k6 pós-otimização e travar gates em CI** | M | Substituir force-dynamic + router.refresh agressivo por cache segmentado | `docs/perf-baseline.md`, `perf/dashboard.k6.js`, `docs/deploy-runbook.md` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Seed de dados sintéticos + harness de medição (baseline)** — _L · 2-3d_  
Criar script scripts/seed-perf.mjs que usa SUPABASE_SERVICE_ROLE_KEY pra popular um household de teste com volume de SaaS real: ~30k transactions espalhadas em 36 meses, ~40 accounts (incl. 5 credit_card), ~30 categories, ~200 investments com tickers B3, investment_yields/movements de 3 anos, e gerar ~50 households com 5k tx cada pra simular tabela global grande. Capturar baseline com EXPLAIN (ANALYZE, BUFFERS) das queries quentes (getMonthlySummary, getCategoryBreakdown, getMonthlyHistory, getAccountsTotalsAt) e gravar os planos em docs/perf-baseline.md (rows removed by filter, custo por linha do RLS). Sem isso, não há como provar os ganhos das tarefas seguintes.  
⚠️ _Decisão do dono:_ Decidir se o seed roda contra um projeto Supabase de staging dedicado (recomendado) ou contra um schema isolado no projeto atual. Dono precisa provisionar o staging.  

**2. Load test k6 do dashboard com gates de p95** — _M · ~1d_  
Adicionar k6 como ferramenta (script perf/dashboard.k6.js) que autentica como o usuário de teste (token Supabase via password grant), bate em /dashboard e nas rotas /transacoes, /investimentos, /metas, /ir sob 1/10/50 VUs por 2min. Definir thresholds: http_req_duration p95 < 800ms no dashboard com o household de 30k tx. Adicionar script npm 'perf:dashboard'. Rodar ANTES das otimizações pra fixar o baseline de p95 e depois de cada bloco grande (RLS, cache) pra medir delta. Documentar resultados em docs/perf-baseline.md.  
⚠️ _Decisão do dono:_ Escolher onde rodar o k6 (local apontando pra staging vs k6 Cloud/Grafana). Recomendo local contra staging pra começar, custo zero.  

**3. Migration: envolver TODAS as funções SECURITY DEFINER em (select ...) nas RLS policies** — _L · 2-3d_  
Criar migration que faz DROP+CREATE de cada policy substituindo public.current_household_id() por (select public.current_household_id()), auth.uid() por (select auth.uid()) e public.is_platform_admin() por (select public.is_platform_admin()) em USING e WITH CHECK. São ~122 ocorrências de current_household_id (111 em policies), 20 de auth.uid() e 13 de is_platform_admin() distribuídas em ~30 migrations existentes. O subselect faz o Postgres avaliar a função UMA vez por query (initplan) em vez de por linha — é o anti-padrão #1 do Supabase. Gerar a migration programaticamente: ler todas as policies atuais de pg_policy, regenerar com o wrapper. Incluir comentário no topo explicando o padrão pra futuras migrations. Rollback = guardar os CREATE POLICY originais num bloco comentado no fim do arquivo.  
⚠️ _Decisão do dono:_ Confirmar que NENHUMA policy depende de re-avaliação por linha de current_household_id (não há — a função é STABLE e o household é fixo na sessão). Validar em staging antes de prod.  

**4. Migration: índices compostos nas colunas quentes** — _M · ~1d_  
Adicionar índices que cobrem os filtros reais dos agregadores: transactions(household_id, date desc, kind) INCLUDE (account_id, amount_account) e um índice parcial transactions(household_id, date) WHERE is_historical_ir_only = false (quase todo agregador filtra isso). Índice em transactions(account_id, kind, date) pra signedBillTotal/paidAmountFor do cartão. transactions(household_id) WHERE balance_applied_at IS NOT NULL pra getAccountsTotalsAt. accounts(household_id, type) pra getCreditCardAccountIds. investment_yields(household_id, month) e investment_movements(household_id, kind, date) pros relatórios de IR. Usar CREATE INDEX CONCURRENTLY? Não dá em migration transacional do supabase db push — criar normalmente (tabelas ainda pequenas em prod hoje) e documentar que em prod com volume use CONCURRENTLY manual. Medir com EXPLAIN antes/depois.  

**5. Memoizar agregadores pesados com React cache() por request** — _M · ~1d_  
Envolver em cache() (import de 'react'): getMonthlySummary, getMonthlyHistory, getCategoryBreakdown, getCategoryMovers, detectExpenseAnomalies, getCoverage, listGoalsEnriched, getBudgetVsActual, getAccountsTotals, getAccountsTotalsAt em services/transactions.ts, services/investments.ts, services/goals.ts, services/budgets.ts, services/accounts.ts. ATENÇÃO: cache() chaveia por argumentos referenciais — funções com args primitivos (monthStr string, months number) funcionam direto; getAccountsTotalsAt(atDateISO) e getMonthlyHistory(months,endMonth) são seguras. Após isso, getInsights() (services/insights.ts:42-51) e getSobraHistory/getGoalReminders/getAportSuggestions vão reusar o resultado já computado pelo dashboard no mesmo request em vez de recomputar (getMonthlyHistory ~3x→1x, listGoalsEnriched 4x→1x). Validar que nenhuma dessas é chamada com objetos novos como arg.  

**6. Cachear getCreditCardAccountIds e provar dedup** — _M · ~1d_  
getCreditCardAccountIds (services/credit-card.ts:20-29) é chamado em 4 agregadores (transactions.ts:135,276,402,630) que se duplicam; sem cache roda muitas vezes por load. Refatorar pra uma versão cache()-wrapped sem argumento de cliente (export const getCreditCardAccountIdsCached = cache(...)) que cria o próprio client, e usar essa nos agregadores; manter a versão com SupabaseClient opcional pros call sites que já têm transação aberta. Adicionar teste que conta chamadas ao DB num render simulado do dashboard pra travar a regressão de duplicação.  

**7. Limitar getRateMap a 1 linha por par (eliminar full table scan)** — _M · ~1d_  
getRateMap (services/currency.ts:13-33) lê currency_rates inteira ORDER BY date desc sem LIMIT e itera tudo em JS — cresce ~2.190 linhas/ano e é chamada por quase todo serviço. Substituir por DISTINCT ON (base,quote) ... ORDER BY base,quote,date DESC via RPC SQL (função public.latest_currency_rates() SECURITY DEFINER STABLE) OU, se quiser evitar RPC, por uma materialized view currency_rates_latest refrescada pelo cron update-rates. Mesma correção em getRateMapAt(date) (linhas 40-56) adicionando o DISTINCT ON com WHERE date<=. O índice currency_rates(base,quote,date desc) já existe e cobre o DISTINCT ON. Resultado: 6 linhas lidas em vez da tabela toda.  
⚠️ _Decisão do dono:_ RPC (function) vs materialized view. Recomendo RPC DISTINCT ON: zero infra de refresh, sempre fresco, e o índice já existente o torna O(pares). Dono confirma.  

**8. Tirar brapi do caminho síncrono de render do dashboard** — _L · 2-3d_  
getCurrentValueMap (services/quotes.ts:123-137) chama fetchQuotes→brapi.dev (lib/financial/brapi.ts:142-144, 1 request/ticker, timeout 8s) dentro do Promise.all do dashboard (page.tsx:109), acoplando latência/disponibilidade a um terceiro e estourando o free tier 15k/mês compartilhado. Mudar para: (a) o dashboard lê SÓ snapshots persistidos (getAssetSnapshotMap, já existe e é puro DB) pro render inicial; (b) extrair o PortfolioLiveTicker e a Composição que dependem de cotação ao vivo pra um Server Component filho envolto em <Suspense> que faz o fetch brapi, OU mover a atualização de cotação 100% pro cron update-quotes e o render nunca chamar brapi. Garantir que o cron seja a ÚNICA origem de escrita de quote_snapshots em prod. Isso desacopla o p95 do dashboard do brapi.  
⚠️ _Decisão do dono:_ Cotação ao vivo no dashboard via Suspense (mantém sensação 'live' mas streamed) OU dashboard só com snapshot do cron (mais barato/estável). Recomendo snapshot-do-cron pro dashboard e 'live' só na página /investimentos sob demanda.  

**9. Tirar computeImposto do render bloqueante do dashboard** — _L · 2-3d_  
computeImposto(year) entra no Promise.all do dashboard (page.tsx:130-132) e via getRendimentosReport (services/ir/rendimentos.ts:77-136) puxa um ANO INTEIRO de transactions+investment_yields+investment_movements+carne_leao só pro KPI IrEstimateHero. Cresce linear com o histórico. Mover o IrEstimateHero pra um Server Component filho em <Suspense fallback={skeleton}> pra ele streamar sem bloquear o resto do dashboard. Adicionalmente, cachear o resultado com unstable_cache/'use cache' chaveado por (household_id, year, max(updated_at) das tabelas de IR) com revalidate curto (ex. 300s) — recomputa só quando dados de IR mudam, não a cada F5. Memoizar getCarneLeaoSummary (chamado de novo em imposto.ts:208-210) com cache().  

**10. Paginação/teto em queries de agregação sem range** — _XL · 1sem+_  
Hoje getMonthlySummary, getCategoryBreakdown, getMonthlyHistory, detectExpenseAnomalies e getAccountsTotalsAt fazem select().gte/.lte(date) sem range/limit e somam em JS — Postgres serializa o conjunto inteiro pro Node. Mover a agregação pro banco: criar RPCs SQL (functions SECURITY INVOKER, respeitam RLS) que retornam SUM/GROUP BY já agregado — ex. public.monthly_summary(p_from,p_to), public.category_breakdown(p_from,p_to,p_kind), public.monthly_history(p_from,p_to). A conversão multi-moeda é o complicador: ou agregar por (kind,currency) no SQL e converter os ~3 buckets em JS (recomendado, mantém SQL simples), ou passar o rate map e converter no SQL. Substituir os loops JS pelas chamadas RPC. Para listTransactions (já paginada, transactions.ts:56-100) está OK. Medir redução de bytes transferidos e de tempo via k6/EXPLAIN.  
⚠️ _Decisão do dono:_ Agregar por (kind,currency) no SQL e converter buckets em JS, vs passar rate map ao SQL. Recomendo o primeiro: SQL simples e poucas conversões em JS.  

**11. Eliminar o loop por mês de getAccountsTotalsAt em getPatrimonioHistory** — _M · ~1d_  
getPatrimonioHistory (services/patrimonio-history.ts:79-88) chama getAccountsTotalsAt por mês sem snapshot via Promise.all — até 12 scans de transactions (cada um sem limit, accounts.ts:101-117) pra um usuário novo sem snapshots, exatamente o pior caso. Trocar por UMA query que traz todas as transações com date>minMonthEnd e balance_applied_at not null, e computar os deltas acumulados por mês em memória num único passe (ou uma RPC public.account_balances_at_months(p_dates[]) que retorna saldo por data). Garantir que o cron de snapshots rode no signup/onboarding pra que o caminho de fallback quase nunca seja exercido.  

**12. Substituir force-dynamic + router.refresh agressivo por cache segmentado** — _L · 2-3d_  
Dashboard é export const dynamic='force-dynamic' (page.tsx:53): todo F5 reexecuta o pipeline inteiro, sem cache HTTP. Combinado com use-realtime-refresh (hooks/use-realtime-refresh.ts:21-27) que dá router.refresh() a CADA postgres_changes de transactions/accounts, edições em massa ou múltiplas abas disparam re-renders completos do servidor repetidos. Ações: (1) trocar force-dynamic por revalidatePath('/dashboard') disparado nas server actions de mutação (transactions.actions.ts etc.) + segmentos com 'use cache'/unstable_cache nos blocos não-voláteis (composição, histórico 6m, IR estimate), mantendo dados do mês corrente frescos; (2) no hook, aumentar o debounce e ignorar eventos originados pela própria aba (dedup por commit id) pra não auto-refrescar em loop. Medir com k6 cenário multi-aba.  
⚠️ _Decisão do dono:_ Política de frescor: o que pode tolerar revalidate de 60-300s (composição, IR, histórico) vs o que precisa ser sempre fresco (saldo do mês corrente). Dono define os limites aceitáveis de defasagem.  

**13. Validação final: rodar k6 pós-otimização e travar gates em CI** — _M · ~1d_  
Reexecutar perf/dashboard.k6.js contra o staging com 30k tx + 50 households e confirmar p95 do dashboard < 800ms (meta) com os mesmos VUs do baseline; comparar EXPLAIN das 4 queries quentes provando que o custo por linha do RLS sumiu (initplan em vez de subplan por linha) e que os índices são usados (Index Scan, não Seq Scan). Documentar antes/depois em docs/perf-baseline.md. Adicionar o k6 como step opcional/manual no fluxo de release (não bloqueia PR comum, mas roda em release) e abrir CONCURRENTLY no runbook de deploy pros índices em prod. Marcar a dimensão como fechada só quando os números provarem o ganho.  

</details>

**Riscos de execução:**
- A migration de RLS faz DROP+CREATE de ~119 policies — se gerada errada por um script, pode abrir vazamento entre households. Mitigar: gerar do pg_policy real (não de regex frágil sobre arquivos), revisar diff manualmente, e rodar teste de isolamento (usuário A não vê dados de B) em staging ANTES de prod.
- React cache() chaveia por igualdade referencial dos argumentos: se algum call site passar objeto/array novo, o cache não acerta e a memoização é silenciosamente inútil. Auditar todos os call sites; preferir args primitivos. Teste de contagem de queries trava a regressão.
- Mover agregação pra RPCs SQL muda a borda de arredondamento/conversão de moeda — resultados podem divergir por centavos dos atuais (que somam em JS). Travar com testes de paridade comparando RPC vs implementação JS antes de remover a JS.
- CREATE INDEX em migration transacional bloqueia escrita na tabela; em prod com volume isso causa downtime. Necessário rodar CONCURRENTLY manualmente no deploy (fora de transação) — documentar no runbook, não confiar só no supabase db push.
- Tirar brapi do render e depender do cron pode deixar cotação defasada se o cron falhar; precisa de alerta/monitoramento do cron (já há system-alerts) e fallback pro snapshot mais recente, nunca render quebrado.
- Sem um ambiente de staging com volume realista, todas as medições são teóricas e a dimensão não pode ser declarada 10/10 — o provisionamento do staging é pré-requisito de tudo e depende do dono.

**Env vars desta dimensão:** `PERF_TEST_USER_EMAIL`, `PERF_TEST_USER_PASSWORD`, `PERF_TEST_BASE_URL`, `SUPABASE_STAGING_DB_URL`


### CRON — Jobs/cron e dependências externas em escala

> **Score atual 3.5/10 → meta 10/10**  ·  **19 dias-pessoa**  ·  **19 tarefas**  ·  entra na **Fase 3**


**Estratégia.** Trocar o modelo "uma invocação serverless faz loop sequencial sobre todos os households" por um modelo fila + worker idempotente: um cron leve (dispatcher) enumera households e enfileira um job por household no QStash (com tabela job_queue própria como fonte de verdade + dead-letter); cada job vira uma invocação curta e isolada que processa UM household, com retry automático do QStash e checkpoint/resume. Padronizar TODAS as deps externas (brapi/BCB/Tesouro/Frankfurter/OpenAI/Resend) atrás de um lib/external/resilient-fetch.ts com timeout+retry+circuit-breaker que SEMPRE degrada (nunca return 500 que aborta o batch). Resolver o conflito de plano comprometendo-se com Vercel Pro (decisão do dono) e tornando vercel.json a única fonte de verdade dos schedules. Fechar com observabilidade real (tabela cron_runs + job_queue dashboards) que detecta "rodou mas processou 50 de 500".


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **DECISÃO: plano Vercel + provider de fila/orquestração** | S | — | `docs/architecture/jobs.md`, `vercel.json` |
| 2 | **Migration: tabela job_queue + cron_runs (fonte de verdade)** | M | DECISÃO: plano Vercel + provider de fila/orquestração | `supabase/migrations/20260601100000_job_queue.sql`, `supabase/migrations/20260601110000_cron_runs.sql`, `types/database.ts` |
| 3 | **lib/external/resilient-fetch.ts — wrapper único pra deps externas** | M | DECISÃO: plano Vercel + provider de fila/orquestração | `lib/external/resilient-fetch.ts`, `lib/external/__tests__/resilient-fetch.test.ts` |
| 4 | **Refatorar update-rates e update-indexers pra degradar (não abortar)** | M | lib/external/resilient-fetch.ts — wrapper único pra deps externas | `app/api/cron/update-rates/route.ts`, `app/api/cron/update-indexers/route.ts`, `app/api/cron/__tests__/update-rates.test.ts`, `app/api/cron/__tests__/update-indexers.test.ts` |
| 5 | **Refatorar sync-tesouro-prices pra não abortar o sync inteiro** | M | lib/external/resilient-fetch.ts — wrapper único pra deps externas | `app/api/cron/sync-tesouro-prices/route.ts`, `app/api/cron/__tests__/sync-tesouro.test.ts` |
| 6 | **services/job-queue.ts — enqueue/claim/complete idempotente** | L | Migration: tabela job_queue + cron_runs (fonte de verdade) | `services/job-queue.ts`, `services/__tests__/job-queue.test.ts` |
| 7 | **lib/qstash.ts — cliente de publish + verificação de assinatura** | M | DECISÃO: plano Vercel + provider de fila/orquestração | `lib/qstash.ts`, `lib/__tests__/qstash.test.ts`, `package.json` |
| 8 | **Dispatcher pattern: cron leve enumera households e enfileira** | L | services/job-queue.ts — enqueue/claim/complete idempotente | `app/api/cron/dispatch/route.ts`, `app/api/cron/__tests__/dispatch.test.ts` |
| 9 | **Worker route: processa 1 household por invocação (idempotente)** | L | Dispatcher pattern: cron leve enumera households e enfileira | `app/api/jobs/worker/route.ts`, `app/api/jobs/worker/handlers.ts`, `supabase/migrations/20260601120000_cron_runs_increment_rpc.sql`, `app/api/jobs/worker/__tests__/worker.test.ts` |
| 10 | **Migrar notifications.ts pro modelo per-household worker** | L | Worker route: processa 1 household por invocação (idempotente) | `services/notifications.ts`, `app/api/jobs/worker/handlers.ts`, `services/__tests__/notifications-per-household.test.ts` |
| 11 | **OpenAI: timeout + orçamento + fora do hot-path do cron** | M | Migrar notifications.ts pro modelo per-household worker | `services/ai/monthly-narrative.ts`, `lib/openai/client.ts`, `services/__tests__/monthly-narrative-timeout.test.ts` |
| 12 | **year-end-snapshot e materialize: per-household via fila** | L | Worker route: processa 1 household por invocação (idempotente) | `app/api/cron/year-end-snapshot/route.ts`, `app/api/cron/materialize-recurrences/route.ts`, `app/api/jobs/worker/handlers.ts` |
| 13 | **snapshot-patrimonio e snapshot-quotes: paginar/escopar por tenant + budget brapi** | L | services/job-queue.ts — enqueue/claim/complete idempotente | `app/api/cron/snapshot-patrimonio/route.ts`, `app/api/cron/snapshot-quotes/route.ts`, `lib/financial/brapi.ts` |
| 14 | **Fila de email: backoff, isolamento e batch menor** | M | services/job-queue.ts — enqueue/claim/complete idempotente | `services/email.ts`, `app/api/cron/send-pending-emails/route.ts`, `vercel.json` |
| 15 | **Observabilidade real: cron_runs + detecção de processamento parcial** | L | Worker route: processa 1 household por invocação (idempotente) | `services/cron-status.ts`, `app/api/cron/health-check/route.ts`, `app/api/admin/jobs/route.ts`, `services/email.ts` |
| 16 | **vercel.json como fonte única de verdade + limpar comentários divergentes** | M | Observabilidade real: cron_runs + detecção de processamento parcial | `vercel.json`, `app/api/cron/__tests__/schedules.test.ts`, `docs/architecture/jobs.md` |
| 17 | **Remover daily-master/evening-snapshot e o fan-out HTTP interno** | M | vercel.json como fonte única de verdade + limpar comentários divergentes | `app/api/cron/daily-master/route.ts`, `app/api/cron/evening-snapshot/route.ts`, `vercel.json` |
| 18 | **Env vars, .env.example, validação de boot e migrations aplicadas** | M | Remover daily-master/evening-snapshot e o fan-out HTTP interno | `.env.example`, `lib/env.ts`, `types/database.ts`, `docs/architecture/jobs.md` |
| 19 | **Teste de carga + ensaio de falha (não deixar pendência)** | L | Env vars, .env.example, validação de boot e migrations aplicadas | `scripts/seed-load-test.ts`, `docs/architecture/jobs.md` |

<details><summary>Detalhe de cada tarefa</summary>


**1. DECISÃO: plano Vercel + provider de fila/orquestração** — _S · <½d_  
O dono precisa decidir 3 coisas que travam o resto: (1) Vercel Pro (maxDuration até 300s, >2 crons, custo ~US$20/mês/membro) — obrigatório porque Hobby mata em 10s e o vercel.json já tem 3 crons; (2) provider de fila: recomendação = QStash da Upstash (HTTP-native, serverless, retry+DLQ embutidos, sem infra; alternativas Inngest/Trigger.dev são mais poderosas mas mais lock-in/curva) — usaremos QStash como camada de entrega + uma tabela job_queue própria como fonte de verdade idempotente; (3) política de SLA por job (quanto tempo um household pode ficar sem snapshot antes de alertar). Registrar a decisão em docs/architecture/jobs.md.  
⚠️ _Decisão do dono:_ Vercel Pro SIM/NÃO; QStash vs Inngest vs Trigger.dev vs tabela-própria-pura; SLA por job (ex: snapshot stale após 36h)  

**2. Migration: tabela job_queue + cron_runs (fonte de verdade)** — _M · ~1d_  
Criar migration supabase/migrations/<ts>_job_queue.sql com: (a) public.job_queue (id uuid pk, job_type text, household_id uuid null, payload jsonb, status text check in ('pending','processing','done','failed','dead'), attempts int default 0, max_attempts int default 5, run_after timestamptz default now(), locked_at timestamptz, locked_by text, last_error text, dedup_key text unique, created_at, updated_at) com índices em (status, run_after) e (job_type, household_id); (b) public.cron_runs (id, job_type, started_at, finished_at, status, households_total int, households_processed int, households_failed int, error_summary jsonb) pra observabilidade real. Incluir índice parcial WHERE status in ('pending','processing'). RLS: nenhuma policy pública (só service-role acessa). Aplicar via pnpm db:push e regenerar types com pnpm db:types.  

**3. lib/external/resilient-fetch.ts — wrapper único pra deps externas** — _M · ~1d_  
Criar lib/external/resilient-fetch.ts exportando resilientFetch(url, {timeoutMs, retries, retryOn=[429,502,503,504], backoffMs}) usando AbortController (padrão já usado no brapi.ts:93) + retry com backoff exponencial + jitter. Adicionar um circuit-breaker em memória por host (abre após N falhas consecutivas, half-open após cooldown) pra não martelar BCB/Tesouro fora do ar. Exportar tipo Result<T> = {ok:true,data} | {ok:false,error,degraded:boolean}. REGRA central: callers NUNCA fazem return 500 numa dep externa — coletam o erro e seguem. Cobrir com testes unitários (mock fetch) em lib/external/__tests__/resilient-fetch.test.ts: timeout, retry-then-success, circuit-open, degraded-result.  

**4. Refatorar update-rates e update-indexers pra degradar (não abortar)** — _M · ~1d_  
Em update-rates/route.ts:76-78 e update-indexers/route.ts:87-89, remover o `return NextResponse.json(..., {status:500})` no primeiro upsert/par que falha. Trocar fetchRate/fetchLatest por resilientFetch. Acumular erros num array, continuar o loop dos 12 pares / 3 séries, e retornar 200 com {ok: errors.length===0, updated, errors} (status 207 quando parcial, espelhando o padrão já bom de materialize-recurrences/route.ts:77-86). Registrar falhas em system_alerts. Atualizar/criar testes app/api/cron/__tests__/update-rates.test.ts cobrindo: 1 par falha → os outros 11 ainda upsertam.  

**5. Refatorar sync-tesouro-prices pra não abortar o sync inteiro** — _M · ~1d_  
Em sync-tesouro-prices/route.ts:202-207 e :225-229, o download CSV falho ou um chunk de upsert falho retorna 502/500 e mata todo o sync de Tesouros de todos os households. Trocar por: se o CSV falhar (resilientFetch degraded), pular o re-download e seguir com as quotes já em cache no banco (linha :237 já recarrega do banco); se um chunk de upsert falhar, registrar e continuar os demais chunks. Nunca abortar a fase 3 (sync por investimento). Também: registrar em system_alerts (user_facing=true, household do investimento) quando inferTesouroParams falha (route.ts:275-296 hoje é skip silencioso — blocker [low]) pra o usuário saber que o Tesouro dele não atualizou. Teste: CSV 500 → usa cache e ainda sincroniza.  

**6. services/job-queue.ts — enqueue/claim/complete idempotente** — _L · 2-3d_  
Criar services/job-queue.ts com: enqueueJob({jobType, householdId?, payload, dedupKey, runAfter}) (INSERT ... ON CONFLICT (dedup_key) DO NOTHING — idempotência, dedupKey = `${jobType}:${householdId}:${dateBucket}`); claimNextBatch(jobType, limit, lockToken) usando UPDATE ... SET status='processing', locked_at=now(), locked_by=$token WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT $n) RETURNING * (lock atômico, sem corrida entre workers); completeJob(id), failJob(id, error) que incrementa attempts e re-agenda (run_after = now()+backoff) ou manda pra 'dead' quando attempts>=max_attempts; reapStuck() que volta jobs 'processing' presos há >10min pra 'pending'. Tudo via createAdminClient (admin.ts). Testes em services/__tests__/job-queue.test.ts com client mockado: dedup, claim SKIP LOCKED não duplica, retry incrementa attempts, dead-letter após max.  

**7. lib/qstash.ts — cliente de publish + verificação de assinatura** — _M · ~1d_  
Criar lib/qstash.ts: publishJob(targetUrl, body, {retries, delay}) que faz POST pra QStash REST (https://qstash.upstash.io/v2/publish/) com QSTASH_TOKEN; e verifyQStashSignature(req) que valida o header Upstash-Signature (HMAC) com QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY — substitui o auth por Bearer CRON_SECRET nas rotas de worker (que agora são chamadas pelo QStash, não pelo Vercel cron). Manter CRON_SECRET só nas rotas dispatcher (essas continuam disparadas por vercel.json/x-vercel-cron). Adicionar @upstash/qstash ao package.json. Teste de verifyQStashSignature com payload/assinatura conhecidos.  
_Pacotes:_ `@upstash/qstash`  
⚠️ _Decisão do dono:_ confirmar QStash (se o dono escolheu Inngest/Trigger.dev na tarefa 1, esta tarefa muda de SDK)  

**8. Dispatcher pattern: cron leve enumera households e enfileira** — _L · 2-3d_  
Criar app/api/cron/dispatch/route.ts (1 endpoint, parametrizado por ?job=notifications|year-end-snapshot|materialize|tesouro-sync). Ele faz UMA query paginada de households (ou de households com recurring_rules ativas, espelhando materialize-recurrences:47-56), e pra cada um chama enqueueJob + publishJob(`${baseUrl}/api/jobs/worker`, {jobType, householdId}). Resolve o blocker [critical] de loop sequencial: o dispatcher roda em <2s mesmo com milhares de households (só INSERTs + publishes em lote de 100). Gravar uma linha em cron_runs no início (households_total) e fim. baseUrl: validar NEXT_PUBLIC_APP_URL no boot e falhar cedo com mensagem clara (hoje daily-master:78-82 só descobre em runtime).  

**9. Worker route: processa 1 household por invocação (idempotente)** — _L · 2-3d_  
Criar app/api/jobs/worker/route.ts (POST, auth via verifyQStashSignature). Recebe {jobType, householdId}, faz claim do job na job_queue, e despacha pra um handler por jobType. Cada handler processa UM household e é idempotente (já há upserts on-conflict e last_sent stamps no código atual). Em sucesso → completeJob; em erro → failJob (QStash re-tenta automaticamente respeitando o run_after). export const maxDuration = 60 (Pro). Por ser 1 household por invocação, NUNCA estoura timeout independente da escala — resolve o conflito de timeout do blocker [critical]. Atualizar cron_runs.households_processed/failed via increment atômico (RPC).  

**10. Migrar notifications.ts pro modelo per-household worker** — _L · 2-3d_  
Refatorar services/notifications.ts: extrair o corpo do `for (const h of households)` (linhas :42-117) numa função runNotificationsForHousehold(householdId) que vira um handler do worker. Resolve o blocker [critical]: hoje são dezenas de round-trips SEQUENCIAIS por household (prefs + owner + auth.admin.getUserById:73 + checkDarf + checkIrGaps + checkCreditCardBills com 3-4 queries/cartão + OpenAI) tudo numa invocação. No novo modelo cada household é uma invocação isolada. Otimizar getUserById:73 → buscar emails em lote no dispatcher (admin.auth.admin.listUsers paginado) e passar o email no payload do job, eliminando 1 round-trip Auth por household. Manter idempotência via *_last_sent.  

**11. OpenAI: timeout + orçamento + fora do hot-path do cron** — _M · ~1d_  
Em services/ai/monthly-narrative.ts:110-128, a chamada openai.chat.completions.create não tem timeout/AbortController (blocker [high]). Adicionar timeout via o cliente OpenAI (getOpenAI com {timeout: 20000, maxRetries: 1}) ou AbortSignal.timeout. Como agora o monthly_recap roda no worker per-household (1 household/invocação), N chamadas LLM deixam de ser sequenciais num único cron. Adicionar guarda de orçamento: ler MONTHLY_AI_BUDGET_CENTS do env e, antes de gerar, somar estimateCostCents do mês (já existe lib/openai/client) — se estourar, degradar pra um recap determinístico (sem IA) em vez de abortar. Teste: timeout da OpenAI → status 'error' sem derrubar o job; budget estourado → fallback determinístico.  

**12. year-end-snapshot e materialize: per-household via fila** — _L · 2-3d_  
Refatorar year-end-snapshot/route.ts (loop :70 com 3 queries+upserts/household) e materialize-recurrences/route.ts (loop :63, 1 RPC/household) pra handlers do worker, enfileirados pelo dispatcher. year-end já é raro (só 02/jan) mas em escala o loop estoura mesmo assim; materialize roda diário e é o mais sensível. materialize já acumula erros sem abortar (bom) — só precisa virar per-household-job pra ter retry idempotente real (hoje um erro só é re-tentado no próximo dia, blocker). Manter o guard de data do year-end (route.ts:35-56) no dispatcher (só enfileira em 02/jan).  

**13. snapshot-patrimonio e snapshot-quotes: paginar/escopar por tenant + budget brapi** — _L · 2-3d_  
snapshot-patrimonio/route.ts:71-89 carrega accounts/investments/physical_assets/currency_rates GLOBAIS em memória (blocker [medium] — RAM ilimitada em escala). Reescrever pra processar por lote de households (a query de rates é global e pequena, mas accounts/investments devem ser filtrados por household_id IN (batch)). snapshot-quotes/route.ts:45-73 lê TODOS os tickers globais e faz DELETE+refetch — em escala estoura o brapi free (15k/mês: a projeção em brapi.ts:138-141 assume N=10 de UM dono, não a união de todos os tenants). Mitigações: (a) deduplicar tickers globalmente (já faz) mas processar em batches; (b) decidir BRAPI_TOKEN pago vs limitar refetch; (c) remover o DELETE+refetch e confiar no TTL adaptativo do fetchQuotes (que já degrada pra snapshot stale).  
⚠️ _Decisão do dono:_ BRAPI: assinar plano pago (qual tier) ou capar nº de tickers/refresh por household no plano free?  

**14. Fila de email: backoff, isolamento e batch menor** — _M · ~1d_  
drainEmailQueue (services/email.ts:188-244) processa até 100 POSTs Resend SEQUENCIAIS num request (send-pending-emails:24 passa 100) — pode estourar timeout e deixar parte sem marcar como sent (blocker [medium]). Mudanças: (1) reduzir limit pra 25 e rodar o cron a cada 5min (schedule no vercel.json); (2) adicionar backoff exponencial por tentativa via run_after/metadata.attempts (hoje retry sem backoff, email.ts:225); (3) status 'failed' após 5 tentativas já existe — adicionar um system_alerts quando email vira dead; (4) sem RESEND_API_KEY a fila acumula indefinidamente (email.ts:171) — adicionar alerta em cron_runs/health quando há >50 'queued' e skippedNoApiKey=true. Idealmente mover o envio pra o mesmo modelo de fila (1 email = 1 job QStash) pra paralelizar com retry nativo.  

**15. Observabilidade real: cron_runs + detecção de processamento parcial** — _L · 2-3d_  
Reescrever services/cron-status.ts pra ler da tabela cron_runs (não mais o proxy 'última data nas tabelas', cron-status.ts:5-11). Detectar o modo de falha que hoje é invisível (blocker [medium]): 'rodou mas households_processed < households_total' → status 'partial'. Em health-check/route.ts:70-81, alertar TAMBÉM em 'partial' e 'missing' (hoje só 'stale'). Adicionar endpoint app/api/admin/jobs/route.ts (guard isPlatformAdmin) expondo job_queue: pending/processing/dead counts por jobType, pra dashboard. Atualizar tmplCronStale (email.ts:551) pra incluir 'X de Y households processados'. O alerta não pode depender só da fila de email que pode estar quebrada — adicionar fallback (log estruturado + system_alerts visível no admin).  

**16. vercel.json como fonte única de verdade + limpar comentários divergentes** — _M · ~1d_  
Reescrever vercel.json com os crons reais do novo modelo: dispatchers (notifications, materialize, tesouro-sync, year-end), reaper (reseta jobs presos a cada 10min: */10 * * * *), send-pending-emails (*/5 * * * *), snapshot-quotes (2x/dia úteis), health-check. Remover daily-master e evening-snapshot (substituídos por dispatchers diretos — fim do fan-out HTTP frágil do blocker [high]). Apagar TODOS os comentários divergentes: daily-master:4/evening:4 ('Hobby=2 crons'), snapshot-quotes:18-20 e materialize:8 (schedules documentados que não existem). Adicionar um teste app/api/cron/__tests__/schedules.test.ts que valida que todo path em vercel.json tem rota correspondente e vice-versa (evita drift futuro). Documentar cada schedule em docs/architecture/jobs.md.  

**17. Remover daily-master/evening-snapshot e o fan-out HTTP interno** — _M · ~1d_  
Deletar app/api/cron/daily-master/route.ts e app/api/cron/evening-snapshot/route.ts (blocker [high]: fan-out via fetch(`${baseUrl}${path}`) com 4 waves awaited em série, wall-time = soma dos máximos, frágil a NEXT_PUBLIC_APP_URL/VERCEL_URL errado). As sub-rotas que eram só helpers globais (advance-balances, update-rates, update-indexers — não são per-household) viram dispatchers diretos no vercel.json chamados por x-vercel-cron, sem orquestrador intermediário. advance-balances já é 1 RPC global idempotente (advance-balances:42), pode continuar como cron direto. Garantir que nada mais importe/chame as rotas removidas (grep). Atualizar quaisquer testes/docs que referenciem daily-master.  

**18. Env vars, .env.example, validação de boot e migrations aplicadas** — _M · ~1d_  
Atualizar .env.example com QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, MONTHLY_AI_BUDGET_CENTS e documentar que NEXT_PUBLIC_APP_URL agora é OBRIGATÓRIO em produção (QStash precisa de URL pública absoluta pra entregar). Adicionar validação no boot (lib/env.ts ou similar) que falha cedo se faltar env crítica em produção. Aplicar todas as migrations via pnpm db:push (job_queue, cron_runs, increment RPC, reaper) e regenerar types via pnpm db:types. Rollback: cada migration com DROP correspondente documentado; o novo sistema pode coexistir com o antigo atrás de uma flag JOBS_QUEUE_ENABLED pra rollout gradual (dispatcher só enfileira se flag on, senão cai no loop antigo) — remover a flag e o código antigo só depois de 1-2 semanas estáveis.  

**19. Teste de carga + ensaio de falha (não deixar pendência)** — _L · 2-3d_  
Antes de declarar 10/10: (1) seed de ~1000 households fake num ambiente de staging e rodar o dispatcher → confirmar que TODOS são processados (cron_runs.households_processed == total) e nenhum fica de fora (o modo de falha original). (2) Ensaio de caos: derrubar brapi/BCB/Tesouro (mock 503) e confirmar que o batch degrada sem abortar e que system_alerts/cron_runs registram. (3) Matar um worker no meio → confirmar reaper devolve o job e ele completa idempotente sem duplicar (sem email duplicado, sem snapshot duplicado). (4) Validar custo: QStash msgs/mês e brapi req/mês projetados pra N households reais documentados em jobs.md. Marcar a dimensão como done só quando os 4 ensaios passam.  

</details>

**Riscos de execução:**
- Vercel Pro é custo recorrente real (~US$20/mês/membro) — se o dono recusar e ficar no Hobby (10s timeout, máx 2 crons), o modelo de fila ainda funciona (dispatcher é <2s e cada worker é 1 household curto), mas QStash vira obrigatório e não opcional; e os 3 crons atuais já violam o limite Hobby hoje.
- Dependência de novo SaaS externo (QStash/Upstash) adiciona mais um ponto de falha e lock-in; se o dono preferir zero deps externas, dá pra fazer fila 100%-DB-própria (pg_cron + tabela job_queue + um cron que faz self-fan-out via fetch), mas perde retry/DLQ/observabilidade prontos e re-introduz parte da fragilidade de fan-out HTTP.
- Idempotência sob retry é o calcanhar de Aquiles: o QStash pode entregar a mesma mensagem 2x (at-least-once). Todo handler PRECISA ser idempotente de verdade — os upserts on-conflict e *_last_sent ajudam, mas checkCreditCardBills insere em system_alerts com dedup por query (notifications.ts:498-517) que tem janela de corrida sob concorrência; precisa virar unique constraint real no banco.
- Migração big-bang é arriscada: a flag JOBS_QUEUE_ENABLED + coexistência com o caminho antigo é essencial pra rollback, mas dobra temporariamente a superfície de código a manter; disciplina pra remover o código antigo depois de estável.
- brapi free (15k req/mês) quase certamente estoura com a união de tickers de múltiplos tenants — sem decisão de plano pago ou cap por household, snapshot-quotes degrada (serve stale) mas a experiência piora silenciosamente; precisa de alerta de quota explícito.
- O parsing do Tesouro por heurística de nome (sync-tesouro-prices:113-157) continua frágil pra nomenclatura livre de usuários reais; mesmo com alerta, muitos Tesouros podem não casar e o usuário fica com saldo defasado — pode exigir um campo estruturado (tipo+vencimento) no cadastro do investimento, fora do escopo desta dimensão mas dependência pra precisão real.

**Env vars desta dimensão:** `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `MONTHLY_AI_BUDGET_CENTS`, `JOBS_QUEUE_ENABLED`


### OBS — Observabilidade, erros e operação (CI/CD incluso)

> **Score atual 3.5/10 → meta 10/10**  ·  **13 dias-pessoa**  ·  **16 tarefas**  ·  entra na **Fase 0**


**Estratégia.** Hoje o app é cego: zero error monitoring, zero error boundaries, zero instrumentation.ts, e migrations empurradas à mão via psql do laptop. A estratégia tem 3 eixos paralelizáveis. (1) Captura de erros: Sentry via @sentry/nextjs com instrumentation.ts/onRequestError no servidor + global-error.tsx/error.tsx por route group no client, tudo correlacionado com user_id/household_id e integrado ao system_alerts caseiro que já existe (não jogar fora, promover a "structured logging" com um logger central). (2) CI/CD: GitHub Actions com gate de typecheck+lint+test em PR + workflow de deploy de migrations versionado usando Supabase CLI link (config.toml + GH secrets), aposentando o db-push.sh artesanal. (3) Operação SaaS: rate limit com Upstash nas rotas pagas/auth, paginação real no dashboard admin, .env.example completo com validação fail-fast no boot, alertas que escalam pro operador (Sentry alerts + email), e remoção dos catch silenciosos. O critério de 10/10 é: nenhum erro de runtime morre sem rastro, nenhum schema muda sem PR+CI, e o operador é notificado ANTES do usuário reclamar.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Pinar toolchain: .nvmrc + packageManager + scripts de validação atômicos** | S | — | `.nvmrc`, `package.json`, `vitest.setup.ts` |
| 2 | **Centralizar validação de env vars com fail-fast no boot (lib/env.ts com Zod)** | M | — | `lib/env.ts`, `services/email.ts`, `.env.example` |
| 3 | **Completar e reorganizar .env.example (5 vars faltando + bloco Sentry/Upstash)** | S | Centralizar validação de env vars com fail-fast no boot (lib/env.ts com Zod) | `.env.example` |
| 4 | **Instalar e configurar Sentry (@sentry/nextjs) com 3 configs + sourcemaps** | M | Completar e reorganizar .env.example (5 vars faltando + bloco Sentry/Upstash) | `package.json`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |
| 5 | **Criar instrumentation.ts com register() + onRequestError (hook nativo Next 16)** | M | Instalar e configurar Sentry (@sentry/nextjs) com 3 configs + sourcemaps | `instrumentation.ts` |
| 6 | **Adicionar error boundaries: global-error.tsx + error.tsx por route group** | M | Instalar e configurar Sentry (@sentry/nextjs) com 3 configs + sourcemaps | `app/global-error.tsx`, `app/(app)/error.tsx`, `app/(auth)/error.tsx`, `app/(contador)/error.tsx` |
| 7 | **Logger estruturado central (lib/logger.ts) + enriquecer Sentry com user/household scope** | L | Criar instrumentation.ts com register() + onRequestError (hook nativo Next 16) | `lib/logger.ts`, `lib/observability/scope.ts`, `services/system-alerts.ts` |
| 8 | **Eliminar catch silenciosos e padronizar tratamento de erro em background** | M | Logger estruturado central (lib/logger.ts) + enriquecer Sentry com user/household scope | `services/transactions.import.actions.ts`, `services/goals.actions.ts` |
| 9 | **CI: workflow de gate em PR (typecheck + lint + test) — .github/workflows/ci.yml** | M | Pinar toolchain: .nvmrc + packageManager + scripts de validação atômicos | `.github/workflows/ci.yml` |
| 10 | **Versionar migrations: linkar Supabase CLI (config.toml) + aposentar db-push.sh manual** | L | CI: workflow de gate em PR (typecheck + lint + test) — .github/workflows/ci.yml | `supabase/config.toml`, `scripts/db-push.sh` |
| 11 | **CD: workflow de deploy de migrations versionado (.github/workflows/deploy-migrations.yml)** | L | Versionar migrations: linkar Supabase CLI (config.toml) + aposentar db-push.sh manual | `.github/workflows/deploy-migrations.yml`, `.github/workflows/ci.yml` |
| 12 | **Rate limiting com Upstash (lib/rate-limit.ts) nas rotas pagas/sensíveis** | L | Centralizar validação de env vars com fail-fast no boot (lib/env.ts com Zod) | `lib/rate-limit.ts`, `app/(app)/inbox/_actions/upload.ts`, `app/(auth)/login/actions.ts`, `app/(auth)/cadastro/actions.ts` |
| 13 | **Corrigir paginação do dashboard admin (listUsers perPage:1000 → loop completo)** | M | — | `services/admin-metrics.ts`, `services/platform-admin.ts` |
| 14 | **Alertas que escalam pro operador: Sentry alert rules + cron heartbeat + dedup** | L | Logger estruturado central (lib/logger.ts) + enriquecer Sentry com user/household scope | `services/cron-status.ts`, `app/api/cron/health-check/route.ts`, `supabase/migrations/20260601000000_cron_runs.sql` |
| 15 | **Parametrizar domínio/URLs dos templates de email via NEXT_PUBLIC_APP_URL** | S | Centralizar validação de env vars com fail-fast no boot (lib/env.ts com Zod) | `services/email.ts` |
| 16 | **Testes da camada de observabilidade + smoke do pipeline** | M | Rate limiting com Upstash (lib/rate-limit.ts) nas rotas pagas/sensíveis | `lib/env.test.ts`, `lib/rate-limit.test.ts`, `services/system-alerts.test.ts`, `README.md` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Pinar toolchain: .nvmrc + packageManager + scripts de validação atômicos** — _S · <½d_  
Pré-requisito do CI: criar .nvmrc com a versão Node (ex.: 22) e adicionar campo "packageManager": "pnpm@<versao>" no package.json (hoje ausente — CI precisa saber qual pnpm usar via corepack). Adicionar script "ci": "pnpm typecheck && pnpm lint && pnpm test" no package.json pra ter um único entrypoint reproduzível local e no Actions. Garantir que pnpm test (vitest run) NÃO depende de Supabase real — checar vitest.setup.ts; se hoje toca rede/DB, mockar via env de teste. Isso destrava todas as tarefas de CI abaixo.  
⚠️ _Decisão do dono:_ Qual versão de Node fixar (recomendo 22 LTS, alinhado com @types/node 22).  

**2. Centralizar validação de env vars com fail-fast no boot (lib/env.ts com Zod)** — _M · ~1d_  
Criar lib/env.ts que valida com Zod (já é dep) TODAS as env vars do app em dois grupos: server (SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM, CRON_SECRET, CRON_ALERT_EMAIL, SUPABASE_AUTH_HOOK_SECRET, OPENAI_API_KEY opcional, SENTRY_DSN, UPSTASH_*) e client (NEXT_PUBLIC_*). Marcar quais são obrigatórias em produção (process.env.NODE_ENV==='production') — ex.: RESEND_API_KEY e EMAIL_FROM passam a ser obrigatórias pra não ter o bug de email silencioso. Exportar um objeto `env` tipado e substituir os acessos diretos a process.env nos services. Chamar a validação em instrumentation.ts register() pra falhar o boot cedo. Importante: drainEmailQueue (services/email.ts:170-173) hoje retorna skippedNoApiKey silencioso — trocar por: se prod e sem RESEND_API_KEY, recordSystemAlert severity=error + capturar no Sentry.  

**3. Completar e reorganizar .env.example (5 vars faltando + bloco Sentry/Upstash)** — _S · <½d_  
Adicionar ao .env.example, com comentários explicando impacto: RESEND_API_KEY (sem ela, TODO email — verificação de conta, reset de senha, DARF, alertas — falha), EMAIL_FROM (formato 'Nome <addr@dominio>'), CRON_ALERT_EMAIL (destino dos alertas de cron stale), SUPABASE_AUTH_HOOK_SECRET (valida webhook de auth do Supabase), NEXT_PUBLIC_CONTACT_EMAIL. Adicionar bloco novo pra observabilidade: SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN (pra upload de sourcemaps), SENTRY_ORG, SENTRY_PROJECT, SENTRY_ENVIRONMENT; e Upstash: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN. Manter alinhado 1:1 com lib/env.ts.  

**4. Instalar e configurar Sentry (@sentry/nextjs) com 3 configs + sourcemaps** — _M · ~1d_  
Adicionar @sentry/nextjs. Rodar o wizard ou criar à mão: sentry.client.config.ts (browser, com tracesSampleRate ~0.1, replaysOnErrorSampleRate, beforeSend pra scrubbing de PII financeira — remover valores monetários/CPF de breadcrumbs), sentry.server.config.ts (server, tracesSampleRate), sentry.edge.config.ts (middleware/edge). Envolver next.config.ts com withSentryConfig pra upload automático de sourcemaps no build (precisa SENTRY_AUTH_TOKEN no CI/Vercel). Setar environment=SENTRY_ENVIRONMENT pra separar prod/preview. Configurar tunnelRoute pra não ser bloqueado por adblock. CRÍTICO de privacidade (app financeiro BR/LGPD): habilitar sendDefaultPii=false e um beforeSend que faz redaction de campos sensíveis.  
_Pacotes:_ `@sentry/nextjs`  
⚠️ _Decisão do dono:_ Provider de monitoring: Sentry (recomendado — onRequestError nativo no Next 16, tier free generoso, self-host possível). Alternativa Datadog/Bugsnag custa mais e integra pior com App Router. Decidir org/projeto e plano (free 5k erros/mês deve bastar no início).  

**5. Criar instrumentation.ts com register() + onRequestError (hook nativo Next 16)** — _M · ~1d_  
Criar instrumentation.ts na raiz com: (a) register() que importa sentry.server.config / sentry.edge.config conforme NEXT_RUNTIME e chama a validação de lib/env.ts (fail-fast); (b) export onRequestError = Sentry.captureRequestError — este é o hook oficial do Next 16 que captura TODO erro de Server Component/RSC/route handler/server action que hoje some nos logs efêmeros da Vercel. Confirmar que next.config não precisa de experimental.instrumentationHook (no Next 16 é estável/default). Este é o coração da correção dos 3 blockers critical.  

**6. Adicionar error boundaries: global-error.tsx + error.tsx por route group** — _M · ~1d_  
Criar app/global-error.tsx (captura erros do root layout, único lugar onde precisa renderizar <html><body>; chamar Sentry.captureException no useEffect e mostrar fallback de marca com botão 'tentar de novo' via reset()). Criar error.tsx em cada route group/segmento crítico: app/(app)/error.tsx, app/(auth)/error.tsx, app/(contador)/error.tsx — cada um como 'use client', reportando ao Sentry e oferecendo reset(). Opcionalmente error.tsx em segmentos pesados (app/(app)/inbox, app/(app)/ir, app/(app)/investimentos) pra recuperação granular sem derrubar a navegação inteira. Hoje existem 28 loading.tsx e ZERO error.tsx — qualquer exceção mostra a tela genérica do Next sem captura.  

**7. Logger estruturado central (lib/logger.ts) + enriquecer Sentry com user/household scope** — _L · 2-3d_  
Criar lib/logger.ts que padroniza logs em JSON (level, msg, requestId, userId, householdId, kind) pra logs da Vercel virarem pesquisáveis, e que em error chama Sentry.captureException. Criar um helper lib/observability/scope.ts pra, dentro de server actions/route handlers, setar Sentry scope (setUser({id}), setTag('household_id')) usando getCurrentUserContext()/services/auth — assim TODO erro capturado já vem com 'qual usuário foi afetado', que é exatamente o gap citado. Substituir console.error espalhados nos paths críticos por logger.error. Integrar com o recordSystemAlert existente (services/system-alerts.ts): fazer recordSystemAlert também encaminhar severity='error' pro Sentry (capture) — unificando a observabilidade caseira com a externa em vez de manter dois mundos.  

**8. Eliminar catch silenciosos e padronizar tratamento de erro em background** — _M · ~1d_  
Corrigir os swallow points citados: services/transactions.import.actions.ts:241 (catch {} '/* não bloqueia o import */') passa a logger.warn + recordSystemAlert(kind='import_row_failed') registrando a linha que falhou; services/goals.actions.ts:89 (catch => return []) passa a logar/capturar antes de degradar, pra falha de leitura não virar 'lista vazia' silenciosa. Fazer um grep por 'catch {}' e 'catch (e) {}' / 'return []' em services e instrumentar os que escondem falha real. Definir convenção no logger: erros esperados (validação) não vão pro Sentry; inesperados sim.  

**9. CI: workflow de gate em PR (typecheck + lint + test) — .github/workflows/ci.yml** — _M · ~1d_  
Criar .github/workflows/ci.yml disparando em pull_request e push na main. Jobs: setup (actions/checkout, actions/setup-node com node-version-file=.nvmrc, corepack enable, pnpm install --frozen-lockfile com cache), depois rodar pnpm typecheck, pnpm lint, pnpm test (vitest run). Adicionar job opcional de build (pnpm build) com env vars dummy pra pegar erros de compilação de RSC que typecheck não pega. Configurar como required status check na branch protection da main (decisão do dono no GitHub). Sem isso, nada garante que PR não quebra o app.  
⚠️ _Decisão do dono:_ Ativar branch protection na main exigindo o check de CI verde antes de merge (config no GitHub repo settings).  

**10. Versionar migrations: linkar Supabase CLI (config.toml) + aposentar db-push.sh manual** — _L · 2-3d_  
Hoje NÃO existe supabase/config.toml e o db-push.sh itera hosts de pooler hardcoded por tentativa e erro. Rodar `supabase init` pra gerar supabase/config.toml (commitar com project_id setado), e `supabase link --project-ref $SUPABASE_PROJECT_REF`. As 88 migrations já estão em supabase/migrations com timestamps — garantir que a migration history remota (schema_migrations) está sincronizada via `supabase migration repair` se necessário (cuidado: prod já tem schema aplicado à mão, então pode ser preciso `supabase db pull` baseline ou repair pra alinhar sem reaplicar). Manter db-push.sh apenas como fallback de emergência documentado, mas o caminho oficial passa a ser CI.  
⚠️ _Decisão do dono:_ Confirmar que o schema_migrations remoto bate com as 88 migrations locais (se foram aplicadas via Management API sem registrar no histórico do CLI, vai precisar de migration repair). Decisão arriscada — fazer primeiro num projeto Supabase de staging.  

**11. CD: workflow de deploy de migrations versionado (.github/workflows/deploy-migrations.yml)** — _L · 2-3d_  
Criar .github/workflows/deploy-migrations.yml que roda só em push na main (após merge). Steps: checkout, setup supabase CLI (supabase/setup-cli action), `supabase link --project-ref $SUPABASE_PROJECT_REF`, e `supabase db push` usando secrets do GitHub (SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF) — NUNCA do laptop. Adicionar step de pré-validação no CI de PR: `supabase db push --dry-run` (igual db-diff.sh já faz) pra mostrar no PR o diff de schema antes de mergear. Resultado: schema do prod só muda via PR mergeado, com log de quem/quando no Actions, gate de revisão e rollback = revert do commit. Considerar um job manual (workflow_dispatch) com `supabase migration down` pra rollback emergencial.  
⚠️ _Decisão do dono:_ Criar projeto Supabase de STAGING separado e apontar deploy de branches preview/staging pra ele, mantendo prod intocado até PR aprovado. Configurar os GH secrets (SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SENTRY_AUTH_TOKEN).  

**12. Rate limiting com Upstash (lib/rate-limit.ts) nas rotas pagas/sensíveis** — _L · 2-3d_  
Adicionar @upstash/ratelimit + @upstash/redis. Criar lib/rate-limit.ts com limiters nomeados (slidingWindow): 'ai' (caro — OpenAI no inbox, ex. 20/dia por usuário + alerta de custo), 'auth' (login/cadastro/recuperar-senha — ex. 5/min por IP contra brute force), 'export' (/api/me/export, /api/me/backup — pesado). Aplicar em: app/(app)/inbox/_actions/upload.ts (uploadAndExtractAction — hoje sem teto = custo OpenAI descontrolado), app/(auth)/login/actions.ts, app/(auth)/cadastro/actions.ts, app/(auth)/recuperar-senha + nova-senha actions, app/api/me/export/route.ts, app/api/me/backup/route.ts. Quando estourar, retornar erro amigável + recordSystemAlert(kind='rate_limit_hit'). Migrar o rate limit in-memory do geocoding (lib/geocoding) pra Upstash também, pra funcionar em serverless multi-instância.  
_Pacotes:_ `@upstash/ratelimit`, `@upstash/redis`  
⚠️ _Decisão do dono:_ Provider de rate limit/Redis: Upstash (serverless, REST, free tier) é o casamento natural com Vercel. Definir as cotas por limiter (especialmente o teto diário de IA por usuário, que impacta custo OpenAI).  

**13. Corrigir paginação do dashboard admin (listUsers perPage:1000 → loop completo)** — _M · ~1d_  
Criar helper services/admin-metrics.ts (ou lib/supabase/admin-users.ts) `listAllAuthUsers()` que itera todas as páginas do admin.auth.admin.listUsers ({page, perPage:1000}) até esgotar, em vez de truncar em 1000. Aplicar nos 5 call sites: services/admin-metrics.ts:53 (getDAUWAUMAU) e :135, services/platform-admin.ts:132, :260, :337. Sem isso, acima de 1000 usuários DAU/WAU/MAU e contagens de crescimento mentem silenciosamente — operador decide com número errado. Adicionar teste unitário do paginador com mock retornando >1000 users.  

**14. Alertas que escalam pro operador: Sentry alert rules + cron heartbeat + dedup** — _L · 2-3d_  
Configurar no Sentry alert rules: notificar (email/Slack) quando (a) novo issue não-resolvido aparece, (b) taxa de erro de um endpoint sobe acima de threshold, (c) erro com tag kind='rate_limit_hit'/'email_send_failed'/'ai_quota'. Promover o health-check caseiro (app/api/cron/health-check + services/cron-status.ts) de 'proxy de staleness' pra um heartbeat real: criar tabela cron_runs (migration) registrando started_at/finished_at/status/error de cada cron, e o health-check alerta se um job não rodou no schedule esperado (resolve o gap 'só cobre staleness de tabela'). Usar Sentry Cron Monitors (check-ins) nos 13 crons como camada externa independente da Vercel. Resolver o risco do Vercel Hobby (vercel.json tem 3 crons; Hobby permite 2) — decisão de plano abaixo.  
⚠️ _Decisão do dono:_ Upgrade do Vercel pra Pro (resolve limite de 2 crons + maxDuration + dá mais cron schedules) OU manter a consolidação no daily-master. Em SaaS público, Pro é praticamente obrigatório.  

**15. Parametrizar domínio/URLs dos templates de email via NEXT_PUBLIC_APP_URL** — _S · <½d_  
Substituir os hardcodes em services/email.ts: linhas ~346, ~382, ~545 trocam 'https://nossasfinancas.com.br/...' por `${env.NEXT_PUBLIC_APP_URL}/...`, e a linha ~583 que aponta pra 'vercel.com/dashboard' vira link configurável (ou removido) — botões de email apontando pra domínio fixo quebram em preview/staging/outro tenant. Reusar lib/email/layout (button/urlBox) garantindo que toda URL passa pelo env. Adicionar teste que renderiza um template e asserta que nenhuma URL hardcoded de produção aparece.  

**16. Testes da camada de observabilidade + smoke do pipeline** — _M · ~1d_  
Não deixar pendência de cobertura: adicionar vitest pra (a) lib/env.ts (valida que falta de var obrigatória em prod lança), (b) lib/rate-limit.ts (limiter bloqueia após N, com mock do Upstash), (c) paginador de listAllAuthUsers (>1000), (d) recordSystemAlert encaminhando severity=error pro Sentry (mock @sentry/nextjs), (e) render de email sem URL hardcoded. Adicionar um teste/smoke que importa instrumentation.ts e confirma que register/onRequestError existem. Garantir que o CI roda tudo isso. Atualizar CLAUDE.md/README com o novo runbook operacional (como ver erros no Sentry, como deployar migration via PR, como rotacionar secrets).  

</details>

**Riscos de execução:**
- Sincronização de migration history: as 88 migrations foram aplicadas no prod via Management API/psql sem necessariamente registrar no schema_migrations do CLI. Rodar `supabase db push` no CI sem alinhar o histórico primeiro pode tentar reaplicar migrations já existentes e quebrar o prod. Testar TUDO num projeto Supabase de staging antes de apontar pro prod; pode precisar de `supabase migration repair`.
- Vazamento de PII financeira no Sentry: breadcrumbs/request bodies podem conter valores monetários, CPF, e-mails. Sem beforeSend de redaction + sendDefaultPii=false, vira problema de LGPD. Tratar como bloqueante antes de ligar Sentry em prod.
- onRequestError e instrumentation.ts têm semântica específica no Next 16 (runtime edge vs nodejs); configuração errada faz captura silenciosamente não funcionar — validar com um erro proposital em staging.
- Rate limit muito agressivo em auth/IA pode bloquear usuários legítimos (NAT compartilhado, famílias no mesmo IP). Calibrar por usuário autenticado quando possível, não só por IP.
- Sourcemaps via withSentryConfig exigem SENTRY_AUTH_TOKEN no build da Vercel e no CI; se faltar, stacktraces vêm minificados e a observabilidade fica meia-boca (pareceria 10/10 mas não é).
- Migrar geocode/rate limit in-memory pra Upstash adiciona latência de rede e dependência externa nova no hot path — garantir fail-open (se Upstash cair, não derrubar a request, só logar).
- Branch protection exigindo CI verde pode travar o dono (hoje solo) se o pipeline ficar flaky; estabilizar os testes antes de tornar o check obrigatório.

**Env vars desta dimensão:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_ENVIRONMENT`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_ALERT_EMAIL`, `SUPABASE_AUTH_HOOK_SECRET`, `NEXT_PUBLIC_CONTACT_EMAIL`


### UX — UX, onboarding, acessibilidade e i18n

> **Score atual 5/10 → meta 10/10**  ·  **22 dias-pessoa**  ·  **14 tarefas**  ·  entra na **Fase 4**


**Estratégia.** Caminho recomendado: internacionalizar AGORA com next-intl (não deixar só "arquiteturado"), shippar pt-BR + en-US, e tratar o IRPF como módulo opcional gated por país de residência fiscal — não como pré-requisito do loop. A justificativa: o postmortem já considera o loop BR fluido; o teto da nota está em 5 frentes ortogonais ao IRPF — (1) zero lib i18n + lang/timezone hardcoded, (2) wizard travado em CPF, (3) acessibilidade fraca (sem skip-link/role/alt/focus), (4) sem landing pública, (5) timezone de SP computando "hoje" errado pra quem está fora do BR. Faço i18n de verdade com extração incremental (o motor primeiro: shell, nav, auth, onboarding, empty states, settings; deixo as telas internas do IRPF em pt-BR já que o módulo é gated por BR), adiciono preferência de locale+timezone em users.preferences com detecção via Accept-Language no middleware, destravo o onboarding sem CPF, e faço uma passada sistemática de a11y com testes automatizados (axe). Billing/login social ficam como dependências externas sinalizadas — não são desta dimensão, mas a landing e o estado "pago" precisam existir pro loop fechar.


| # | Tarefa | Esf. | Depende de | Arquivos-chave |
|---|--------|------|-----------|----------------|
| 1 | **Decisão do dono: escopo e política de i18n/locale** | S | — | `CLAUDE.md` |
| 2 | **Instalar e configurar next-intl com roteamento sem prefixo de URL** | M | Decisão do dono: escopo e política de i18n/locale | `i18n/routing.ts`, `i18n/request.ts`, `i18n/locale.ts`, `next.config.ts` |
| 3 | **Detecção e persistência de locale + timezone no middleware e preferências** | M | Instalar e configurar next-intl com roteamento sem prefixo de URL | `lib/supabase/middleware.ts`, `services/locale.ts`, `app/(auth)/callback/route.ts` |
| 4 | **Parametrizar lib/utils/format.ts por locale e timezone (remover hardcode pt-BR/SP)** | L | Detecção e persistência de locale + timezone no middleware e preferências | `lib/utils/format.ts`, `lib/financial/currency.ts`, `lib/utils/use-formatters.ts` |
| 5 | **Corrigir cálculo de 'hoje' (todayISO) e timezone hardcoded nos 41 arquivos** | L | Parametrizar lib/utils/format.ts por locale e timezone (remover hardcode pt-BR/SP) | `lib/utils/today.ts`, `components/transactions/add-transaction-dialog.tsx`, `lib/utils/__tests__/today.test.ts` |
| 6 | **Criar catálogos de mensagens e extrair strings do 'motor' (shell, nav, auth, settings)** | XL | Corrigir cálculo de 'hoje' (todayISO) e timezone hardcoded nos 41 arquivos | `messages/pt-BR.json`, `messages/en-US.json`, `components/layout/sidebar.tsx`, `components/layout/mobile-nav.tsx` |
| 7 | **Gate do módulo IRPF por país de residência fiscal** | L | Criar catálogos de mensagens e extrair strings do 'motor' (shell, nav, auth, settings) | `components/layout/sidebar.tsx`, `app/(app)/ir/page.tsx`, `app/(app)/dashboard/page.tsx`, `components/dashboard/ir-estimate-hero.tsx` |
| 8 | **Destravar onboarding: CPF opcional e wizard sem barreira BR** | L | Gate do módulo IRPF por país de residência fiscal | `components/onboarding/onboarding-wizard.tsx`, `messages/pt-BR.json`, `messages/en-US.json` |
| 9 | **Language switcher e seção de idioma/região nas configurações** | M | Destravar onboarding: CPF opcional e wizard sem barreira BR | `components/ui/language-switcher.tsx`, `services/locale.actions.ts`, `app/(app)/configuracoes/profile-forms.tsx`, `app/(auth)/login/page.tsx` |
| 10 | **Landing page pública com proposta de valor, preço e CTA** | L | Language switcher e seção de idioma/região nas configurações | `app/page.tsx`, `app/(marketing)/_components/hero.tsx`, `app/(marketing)/_components/pricing.tsx`, `app/(marketing)/_components/features.tsx` |
| 11 | **Acessibilidade: skip-link, landmarks, foco e ESLint jsx-a11y** | L | Instalar e configurar next-intl com roteamento sem prefixo de URL | `eslint.config.mjs`, `app/(app)/layout.tsx`, `components/ui/input.tsx`, `components/ui/checkbox.tsx` |
| 12 | **Login social (Google) e e-mail sem barreira de confirmação forçada** | M | Acessibilidade: skip-link, landmarks, foco e ESLint jsx-a11y | `app/(auth)/login/login-form.tsx`, `app/(auth)/cadastro/signup-form.tsx`, `app/(auth)/login/actions.ts`, `app/(auth)/callback/route.ts` |
| 13 | **Varredura final de strings residuais e moeda hardcoded** | M | Login social (Google) e e-mail sem barreira de confirmação forçada | `app/(app)/ir/page.tsx`, `scripts/i18n-check.mjs`, `messages/pt-BR.json`, `messages/en-US.json` |
| 14 | **Testes: i18n, a11y (axe) e timezone; e gate de CI** | L | Varredura final de strings residuais e moeda hardcoded | `lib/utils/__tests__/format.test.ts`, `components/__tests__/a11y.test.tsx`, `scripts/i18n-check.mjs`, `CLAUDE.md` |

<details><summary>Detalhe de cada tarefa</summary>


**1. Decisão do dono: escopo e política de i18n/locale** — _S · <½d_  
Decidir e registrar em CLAUDE.md: (a) shippar en-US agora junto do pt-BR (recomendado) vs só arquiteturar; (b) política de timezone — derivar do browser (Intl.DateTimeFormat().resolvedOptions().timeZone) com override manual nas configurações, com fallback America/Sao_Paulo; (c) país de residência fiscal default = BR, e o IRPF fica visível só quando country_tax_residence='BR'; (d) en-US usa formato de data MM/DD/YYYY e símbolo $ via displayCurrency já existente. Sem código — só as escolhas que travam o resto.  
⚠️ _Decisão do dono:_ Internacionalizar agora (pt-BR + en-US) OU só arquiteturar deixando catálogo pt-BR? Timezone: auto-detect do browser ou fixo? Recomendo: i18n agora + timezone auto-detect com override.  

**2. Instalar e configurar next-intl com roteamento sem prefixo de URL** — _M · ~1d_  
Adicionar next-intl. Criar i18n/routing.ts (locales=['pt-BR','en-US'], defaultLocale='pt-BR', localePrefix='never' — não quero /en no path, o locale vem de cookie/preferência), i18n/request.ts (getRequestConfig lendo o locale resolvido), e i18n/locale.ts (helper getUserLocale/setUserLocale via cookie NEXT_LOCALE + sync com users.preferences.locale). Envolver next.config.ts com createNextIntlPlugin. Adicionar <NextIntlClientProvider> dentro de app/providers.tsx para os client components. Trocar app/layout.tsx para lang dinâmico via getLocale() (RootLayout vira async). Como o app não usa segmento [locale] no path, a resolução é por cookie/header — documentar isso no i18n/request.ts.  
_Pacotes:_ `next-intl`  

**3. Detecção e persistência de locale + timezone no middleware e preferências** — _M · ~1d_  
Em lib/supabase/middleware.ts (já é o middleware ativo): se não houver cookie NEXT_LOCALE, derivar de Accept-Language (negociar contra ['pt-BR','en-US'], default pt-BR) e setar o cookie. Estender users.preferences (Json, já existe — sem migration de schema) com chaves locale e timezone. Criar services/locale.ts com getUserLocale()/setUserLocale()/getUserTimezone()/setUserTimezone() espelhando o padrão de services/currency.ts (getDisplayCurrency/setDisplayCurrency). No login/callback, persistir o locale negociado em preferences se ainda vazio.  

**4. Parametrizar lib/utils/format.ts por locale e timezone (remover hardcode pt-BR/SP)** — _L · 2-3d_  
Refatorar lib/utils/format.ts: substituir os Intl.* fixos em 'pt-BR'/'America/Sao_Paulo' por factories que recebem locale+timezone. Como a maioria são chamados em RSC, criar getFormatters(locale, timezone) e uma versão client via hook useFormatters() que lê o NextIntlClientProvider. Manter o tratamento de 'calendar date' (YYYY-MM-DD em UTC) intacto — esse fix é independente de locale. greetingForHour/getGreeting passam a receber timezone. Mover os símbolos de moeda para já respeitarem displayCurrency (já existe Currency). Isto é a peça central: 43 arquivos importam estes formatadores.  

**5. Corrigir cálculo de 'hoje' (todayISO) e timezone hardcoded nos 41 arquivos** — _L · 2-3d_  
Criar lib/utils/today.ts com todayISO(timezone) e migrar os ~41 arquivos que hardcodam 'America/Sao_Paulo' (ex.: components/transactions/add-transaction-dialog.tsx:51) para usar o timezone do usuário (RSC: getUserTimezone(); client: via provider). Varredura: grep -rl 'America/Sao_Paulo'. Onde o valor é estritamente fiscal-BR (datas da Receita, cotação BCB 31/12) MANTER SP/UTC com comentário, pois é correto. Adicionar teste lib/utils/__tests__/today.test.ts cobrindo virada de dia em fuso negativo (ex.: America/Los_Angeles) e positivo (Europe/Lisbon).  

**6. Criar catálogos de mensagens e extrair strings do 'motor' (shell, nav, auth, settings)** — _XL · 1sem+_  
Criar messages/pt-BR.json e messages/en-US.json com namespaces (common, nav, auth, onboarding, empty, settings, dashboard, errors, billing, landing). Extrair strings hardcoded das telas de alto tráfego e do shell: components/layout/sidebar.tsx (labels Início/Transações/etc), app/(auth)/login + cadastro/signup-form.tsx ('Confirme seu e-mail', botões), app/(app)/configuracoes/*, mobile-nav, command-palette, toasts globais. Usar useTranslations (client) e getTranslations (RSC). Criar scripts/i18n-check.mjs que falha o CI se en-US tiver chaves faltando vs pt-BR. NÃO traduzir as telas internas do IRPF (gated BR) nesta tarefa — ficam pt-BR.  
⚠️ _Decisão do dono:_ Confirmar lista de telas no escopo de tradução do v1 (motor + onboarding + empty states + landing) vs telas internas BR-only que ficam em pt-BR.  

**7. Gate do módulo IRPF por país de residência fiscal** — _L · 2-3d_  
Adicionar users.preferences.taxResidence (default 'BR') via services/locale.ts. Em components/layout/sidebar.tsx filtrar o group:'ir' (IRPF, Declarantes) quando taxResidence !== 'BR'. Em app/(app)/ir/page.tsx e rotas /ir/*, se taxResidence !== 'BR', renderizar empty state explicando que o módulo IRPF é exclusivo Brasil (com CTA para mudar país nas configurações), em vez de exigir CPF. No dashboard, components/dashboard/ir-estimate-hero.tsx só monta o card-herói quando taxResidence==='BR'; para outros países, substituir por um hero alternativo (ex.: resumo de patrimônio/metas). Adicionar seletor de país de residência fiscal em configuracoes/profile-forms.tsx.  
⚠️ _Decisão do dono:_ Para usuário não-BR, qual vira o card-herói do dashboard no lugar do IRPF? (sugiro: patrimônio líquido + progresso de metas/FIRE).  

**8. Destravar onboarding: CPF opcional e wizard sem barreira BR** — _L · 2-3d_  
Em components/onboarding/onboarding-wizard.tsx: tornar CPF opcional — canAdvance (linha ~341) deixa de exigir titular.cpf.length===11; CPF vira campo opcional (remover required em StepTitular ~linha 504) com texto 'usado só para o IRPF (Brasil)'. Quando taxResidence!=='BR', PULAR os passos fiscais (Titular CPF, Cônjuge/regime, Dependentes, Fontes pagadoras IRRF/INSS) e mostrar só Contas + Renda + Despesas + Meta. Trocar os PRESET_ACCOUNTS (bancos BR) por presets condicionais ao país (BR: Itaú/Nubank/...; outros: presets genéricos tipo 'Checking account'/'Credit card'/'Investments'). Internacionalizar as strings do wizard (namespace onboarding). Garantir que o QuickStart 'valor primeiro' continua sendo o default.  

**9. Language switcher e seção de idioma/região nas configurações** — _M · ~1d_  
Criar components/ui/language-switcher.tsx (Select pt-BR/en-US) que chama setUserLocale (grava cookie NEXT_LOCALE + users.preferences.locale via server action) e dá router.refresh(). Colocá-lo (a) na página pública de login/cadastro (canto superior) e (b) em configuracoes numa nova seção 'Idioma e região' junto com timezone, país de residência fiscal e displayCurrency (que já existe). Criar services/locale.actions.ts com 'use server' para os setters. Acessível por teclado e com aria-label traduzido.  

**10. Landing page pública com proposta de valor, preço e CTA** — _L · 2-3d_  
Trocar app/page.tsx: em vez de redirect direto, RootPage renderiza uma landing pública (componente em app/(marketing)/_components) para anônimos e só redireciona logados para /dashboard. Landing com hero (diferencial IRPF automático para BR), seção de features, pricing (lendo dos planos quando billing existir; placeholder até lá), e CTAs 'Criar conta' / 'Entrar'. i18n via namespace landing. SEO: metadata por locale, OG tags. Esta tela é necessária para o loop de SaaS e para conversão; coordenar 'pricing real' com a dimensão de Billing.  
⚠️ _Decisão do dono:_ Conteúdo/posicionamento da landing e tabela de preços. (Pricing real depende da dimensão Billing — usar placeholder até lá.)  

**11. Acessibilidade: skip-link, landmarks, foco e ESLint jsx-a11y** — _L · 2-3d_  
Adicionar eslint-plugin-jsx-a11y ao eslint config (recommended) e corrigir o que ele apontar. Em app/(app)/layout.tsx: adicionar skip-link ('Pular para o conteúdo' / 'Skip to content', visível no foco) antes do Sidebar e id='main-content' no <main>; adicionar role/aria-current na nav. Garantir alt em todas as <img>/ícones informativos (hoje só 1 alt no app) e aria-hidden nos decorativos. Adicionar focus-visible ring consistente nos primitivos que faltam (hoje só button/select/textarea/row-actions têm) — link, input, checkbox, dialog close, tabs, badges clicáveis. Garantir Dialog/Sheet com foco-trap (Radix já dá, validar) e aria-label nos bottom-sheets. Tornar a cor de erro (rust-600) acompanhada de ícone/texto, não só cor.  
_Pacotes:_ `eslint-plugin-jsx-a11y`  

**12. Login social (Google) e e-mail sem barreira de confirmação forçada** — _M · ~1d_  
Adicionar botão 'Continuar com Google' (signInWithOAuth provider google) em login-form.tsx e signup-form.tsx, com fluxo de callback já existente em app/(auth)/callback. Avaliar com o dono trocar 'confirmação de e-mail obrigatória' por confirmação não-bloqueante (permitir entrar e usar com banner 'confirme seu e-mail', limitando ações sensíveis) para reduzir abandono. i18n das novas strings. Depende de configurar o provider Google no projeto Supabase (Auth > Providers).  
⚠️ _Decisão do dono:_ Habilitar login com Google? Manter confirmação de e-mail obrigatória OU permitir uso imediato com confirmação não-bloqueante? (recomendo Google + confirmação não-bloqueante).  

**13. Varredura final de strings residuais e moeda hardcoded** — _M · ~1d_  
Rodar scripts/i18n-check.mjs e um grep dirigido por literais R$/pt-BR remanescentes em UI (ex.: app/(app)/ir/page.tsx:168 'R$ ...toLocaleString("pt-BR")' — trocar por formatMoney com a moeda do contexto). Garantir que toda copy de UI fora do IRPF passou pelos catálogos. Para as telas IRPF (BR-only, pt-BR), aceitar pt-BR mas remover toLocaleString manual em favor dos formatadores centralizados para respeitar displayCurrency onde aplicável. Adicionar regra de lint custom/grep no CI proibindo novas strings 'R$' literais e Intl com locale hardcoded em components/app.  

**14. Testes: i18n, a11y (axe) e timezone; e gate de CI** — _L · 2-3d_  
Adicionar vitest-axe (ou axe-core) e cobrir: (a) render de login/dashboard/onboarding em pt-BR e en-US sem chaves faltantes; (b) axe sem violations críticas nas telas-chave (login, dashboard, wizard, settings, landing); (c) testes de today.ts/format.ts cobrindo virada de dia em fusos diferentes; (d) gate de pipeline: i18n-check + jsx-a11y + typecheck no CI. Documentar processo de adicionar string nova (sempre nos 2 catálogos) em CLAUDE.md. Rollback: feature flag 'i18n_enabled' lendo de feature-flags (já existe /admin/feature-flags) para reverter o switcher/en-US sem deploy se algo quebrar em produção.  
_Pacotes:_ `vitest-axe`  

</details>

**Riscos de execução:**
- Extração de strings é o item de maior volume e mais propenso a regressão visual (211 componentes). Mitigar fazendo por namespace/tela com o gate scripts/i18n-check.mjs e revisão visual; não tentar big-bang.
- Refatorar lib/utils/format.ts atinge 43 arquivos que o importam — quebra silenciosa de datas é difícil de pegar. Blindar com testes de timezone antes de migrar os call-sites.
- Risco de duplo-bug com o fix de 'calendar date' (YYYY-MM-DD em UTC): ao trocar SP por timezone do usuário, é fácil reintroduzir o shift de -1 dia em datas literais. Manter a distinção calendar-date vs instant intacta e testá-la explicitamente.
- Tradução en-US de qualidade exige revisor humano fluente; tradução literal por IA gera copy ruim e mata a conversão da landing. Marcar como decisão de quem revisa o en-US.
- Gate do IRPF por país pode esconder o diferencial-herói para quem deveria vê-lo se a detecção de país/locale errar (ex.: brasileiro viajando). Default BR + override manual fácil mitigam; nunca inferir taxResidence só do Accept-Language.
- Billing e login social dependem de configuração externa (Stripe, provider Google no Supabase) fora desta dimensão — a landing e o 'estado pago' do loop ficam bloqueados até a dimensão de Billing entregar; tratar pricing como placeholder até lá.
- localePrefix='never' (locale por cookie, sem /en na URL) simplifica mas prejudica SEO multi-idioma e compartilhamento de link no idioma certo. Aceitável para app logado; reavaliar para a landing pública se SEO en-US virar prioridade.


## 7. Apêndices

### A. Novos pacotes npm

| Pacote | Para quê |
|--------|----------|
| `stripe` | SDK de billing (servidor) |
| `file-type` | validação de mime-type real no upload |
| `@sentry/nextjs` | observabilidade / error monitoring |
| `@upstash/ratelimit` | rate-limit serverless (se for o backend escolhido) |
| `@upstash/redis` | store do rate-limit / cache |
| `@upstash/qstash` | fila de jobs (cron → worker por household) |
| `husky` | git hooks (pre-commit: typecheck/lint/test) |
| `next-intl` | internacionalização (pt-BR + en-US) |
| `eslint-plugin-jsx-a11y` | lint de acessibilidade |
| `vitest-axe` | testes automatizados de a11y |

_pgTAP_ (extensão Postgres) e _k6_ (load test) entram como ferramentas de teste, não como deps npm de produção.

### B. Novas env vars (consolidadas)

Total de ~30 chaves novas/a-documentar. Agrupadas por área. As do bloco **Stripe** são a *única* pendência real do billing — tudo o mais é codado e testável com placeholders/chaves de teste.


**Stripe (billing — pendente só a conta)**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_FAMILY_MONTHLY`
- `STRIPE_PRICE_LIFETIME`
- `NEXT_PUBLIC_STRIPE_BILLING_ENABLED`

**Observabilidade (Sentry)**
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_ENVIRONMENT`

**Rate-limit / fila (Upstash + QStash)**
- `UPSTASH_REDIS_REST_URL` — SÓ se a decisão for usar Upstash p/ rotas públicas — caso contrário não criar
- `UPSTASH_REDIS_REST_TOKEN` — idem
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `JOBS_QUEUE_ENABLED`

**Anti-abuso (captcha)**
- `TURNSTILE_SECRET_KEY` — se Cloudflare Turnstile for o captcha escolhido
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — captcha no client
- `AUTH_RATELIMIT_DISABLED` — opcional, p/ dev/e2e

**Cota de IA**
- `MONTHLY_AI_BUDGET_CENTS`
- `AI_MONTHLY_BUDGET_CENTS_FREE` — opcional, override do default por tier
- `AI_MONTHLY_BUDGET_CENTS_PRO` — opcional

**Dados externos / câmbio**
- `BRAPI_TOKEN` — já existe no .env.example, garantir setado em prod
- `BCB_PTAX_ENABLED` — flag opcional para ligar a fonte PTAX no cron de IR

**LGPD**
- `LGPD_DELETION_GRACE_DAYS` — ex.: 7 — janela de arrependimento antes do hard-delete, se optar por grace period
- `LGPD_DPO_EMAIL` — email do Encarregado de dados exibido em /privacidade e nas respostas LGPD
- `CRON_SECRET` — provavelmente já existe — reusar pro cron de deletions/retention

**Já usadas — documentar no .env.example**
- `RESEND_API_KEY` — documentar — já usado, faltava no .env.example
- `EMAIL_FROM` — documentar
- `CRON_ALERT_EMAIL` — documentar
- `SUPABASE_AUTH_HOOK_SECRET` — documentar
- `NEXT_PUBLIC_CONTACT_EMAIL` — documentar
- `NEXT_PUBLIC_APP_URL`

**Testes / staging (CI)**
- `DATABASE_URL_TEST` — string de conexão do Postgres efêmero usada por scripts/db-test.sh quando não usar supabase start
- `PERF_TEST_USER_EMAIL` — usuário de teste pro k6 autenticar no staging
- `PERF_TEST_USER_PASSWORD` — senha do usuário de teste pro k6
- `PERF_TEST_BASE_URL` — URL do staging alvo do load test, ex. https://staging.financas.app
- `SUPABASE_STAGING_DB_URL` — conexão direta ao Postgres de staging pra rodar EXPLAIN ANALYZE no harness

### C. Mapa de dependências entre dimensões

```
OBS (Fase 0) ─┬─→ tudo (CI/CD, observabilidade, env)
              ├─→ SEC, AUTH, CRON   (lib/rate-limit base)
              └─→ FIN, RLS, LGPD    (harness de teste SQL/integração)

FIN ──→ LGPD   (estreitar RLS do contador por ano não pode quebrar Bens/Direitos do IR)
IR  ──→ LGPD   (export precisa cobrir as tabelas de IR)
BILL ──→ SEC   (tier do Stripe alimenta a cota de IA por tier)
BILL ──→ UX    (estado "pago" e pricing da landing dependem do billing)
CRON ──→ BILL  (cron de dunning) , LGPD (cron de exclusão)  — reusam a fila da Fase 0
AUTH ──→ SEC   (captcha/rate-limit de auth compartilham a base de rate-limit)
```

### D. Definição de "10/10" por dimensão (Definition of Done)

| Dim | Pronto quando… |
|-----|----------------|
| **IR** | Nenhuma renda some em silêncio; perfis (65+, moléstia, 13º, MEI, autônomo) cobertos; golden tests verdes; parecer jurídico arquivado. |
| **FIN** | Nenhum caminho escreve saldo em moeda estrangeira sem cotação; cross-currency converte ou bloqueia; testes SQL cobrem trigger de saldo, transfer, dívida, materialize e fatura. |
| **RLS** | Guard no banco em toda RPC admin; `account_id` validado no boundary; suíte cross-tenant **falha** ao tentar vazar e roda no CI. |
| **BILL** | Checkout/portal/webhook/dunning/gating/trial codados e testados em test-mode; única pendência = conta Stripe + 6 env vars. |
| **AUTH** | Bootstrap auto-curável (trigger + retry); e-mail verificado gated no código; captcha + rate-limit no signup; convites endurecidos. |
| **SEC** | Toda rota que toca API paga tem cota atômica por household/tier; leak de métricas admin fechado no banco; headers de segurança; mime-type validado. |
| **LGPD** | Export cobre as ~48 tabelas; consentimento com gate server-side real; `delete_account_complete` provado sem órfãos; DPO + retenção documentados. |
| **PERF** | RLS com `(select …)` em todas as policies; agregadores memoizados; índices nas colunas quentes; p95 sob meta no k6, travado em CI. |
| **CRON** | Modelo fila + worker por household, idempotente, com retry/DLQ; deps externas degradam sem abortar; `cron_runs` detecta processamento parcial. |
| **OBS** | Nenhum erro morre sem rastro (Sentry + boundaries); nenhum schema muda sem PR+CI; operador é alertado antes do usuário reclamar. |
| **UX** | pt-BR + en-US via next-intl; timezone por usuário; onboarding sem barreira de CPF; axe sem violações críticas; landing pública. |

---

## Como executar

1. **Confirme as decisões da seção 2** (pelo menos as do bloco 2.1 e 2.2) — elas destravam o trabalho. Onde concordar com a recomendação, basta dizer "segue a recomendação".
2. **Fase 0 primeiro, sempre.** Sem CI/observabilidade/teste, as fases seguintes voam às cegas.
3. Trabalhe **uma dimensão por vez dentro da fase** (ou duas em paralelo com 2 devs), seguindo a ordem de tarefas da seção 6 — elas já estão topologicamente ordenadas.
4. **Cada tarefa fecha com teste + migration + rollback** antes de seguir. É o que diferencia "10" de "8".

> Este roadmap é o mapa completo. Quando você aprovar o início, eu executo dimensão a dimensão — começando pela Fase 0 — sem deixar pendências entre uma e outra.
