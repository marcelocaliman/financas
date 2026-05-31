# Auditoria de UX/IA — diagnóstico (workflow multi-agente)

> Avaliação a fundo de 6 superfícies (código real) + síntese de diretor de produto.

> Decisão do dono: executar a **reestruturação grande** (IA 17→~10, Patrimônio unificado, IRPF em wizard/abas).

Este é um diagnóstico de produto, não uma tarefa de código. Tenho todas as 6 avaliações em JSON e o contexto do app. Vou consolidar diretamente sem precisar ler o codebase. Aqui está o diagnóstico único.

---

# Diagnóstico Único — Finanças (BR · IRPF automático)

## 1) Veredito geral

**O app é profissional e visualmente excelente, mas está PESADO e CONFUSO — e, ironicamente, falha justamente na prioridade nº 1 do dono: entrada de dados rápida.**

Há uma tensão central no produto: a camada de *apresentação* é premium (design system coeso navy/olive/gold, PageHeaders consistentes, Monte Carlo, FIRE, IRPF automático real), mas a camada de *arquitetura e fluxo* é de um app que cresceu por acumulação. São ~30 páginas e 17 itens de sidebar para algo cujo uso diário é "lancei um gasto de R$ 30". O resultado: o usuário **sente** que é caro/sofisticado, mas **não consegue** fazer a ação mais comum com fluidez, e se perde tentando entender qual das 3-4 páginas parecidas deve usar.

Diagnóstico em uma frase: **vitrine de banco privado, fluxo de ERP.** Simples na superfície de cada página, complexo no sistema como um todo.

Os dois pecados capitais, repetidos em TODAS as 6 avaliações:
- **Fricção de entrada de dados** (crítico em Dashboard, Transações, IRPF, Metas/Investimentos, páginas de config).
- **Redundância conceitual** — "patrimônio" tem 3 significados, "histórico" tem 2 páginas, "metas" aparece 3×, "adicionar transação" tem 3 mecanismos sem guia.

---

## 2) Os problemas mais importantes (priorizados por impacto)

### P1 — A ação mais comum (lançar gasto/receita) é periférica, não primária *(crítico)*
**Onde:** Dashboard, Transações (AddTransactionDialog), navegação global.
O botão "Adicionar" vive escondido na PageHeader entre MonthSwitcher e CreditCardBillShortcut; o QuickAdd é modal global (⌘K / Cmd+Shift+T) que ninguém descobre sem acaso; em mobile o FAB fica atrás do bottom nav. O usuário lê a home bonita e **não tem um CTA óbvio para a ação que vai repetir 10×/dia.** Contradiz frontalmente a prioridade do dono.

### P2 — Formulários de entrada têm campos demais para o caso comum *(crítico)*
**Onde:** AddTransactionDialog (~8 campos visíveis, até 123 fields no DOM), RecurrenceSheet (15-20 campos para uma Netflix), GoalSheet (942 linhas, 15+ campos + financiamento com 8 sub-campos), InvestmentSheet (indexador/taxa/multiplicador não-óbvios).
Uma despesa de mercado não precisa de "forma de pagamento", "fonte pagadora", "não declarar no IRPF" ou "vincular dívida" na vista principal. Uma assinatura simples não precisa de "intervalo/dia/tax deductible". **Usuário novo abandona ao tentar criar a primeira meta ou investimento.**

### P3 — "Patrimônio" significa 3 coisas diferentes em 3 páginas *(crítico)*
**Onde:** /investimentos ("Patrimônio · carteira financeira"), /patrimonio ("Imobilizado · bens"), /independencia ("Patrimônio atual" = contas + investimentos + imóveis).
Não existe um lugar único que responda "qual é o meu patrimônio total?". O usuário precisa pular 3 páginas e somar de cabeça. Cada página usa nomenclatura diferente (carteira / imobilizado / líquido / earmarked). **Quebra de confiança nos números — pecado mortal num app financeiro.**

### P4 — A página de IRPF (o diferencial!) é a mais confusa do app *(crítico)*
**Onde:** /ir/[year] (481 linhas, 7+ seções num scroll infinito), /ir/[year]/configuracoes (6 painéis), /declarantes (duplica config).
KPIs de "imposto a pagar" aparecem ANTES do usuário inserir os dados ("de onde vem esse número?"). Não há wizard pré-exportação. Dependentes ficam em /declarantes **E** em /configuracoes — qual é a fonte de verdade? ChecklistPanel aponta erro mas não navega para corrigir (3+ cliques por campo). O maior trunfo comercial do app é a tela mais penosa de usar.

### P5 — Análise vs Relatórios vs Dashboard se sobrepõem *(alto)*
**Onde:** /analise (6 meses, movers, top categorias), /relatorios (anual, top categorias, bens), Dashboard (tudo isso + mais).
Análise e Relatórios têm **ambas** tabela mês-a-mês e top categorias. Os nomes são genéricos demais ("Análise", "Relatórios" parece relatório de admin). Usuário não sabe qual abrir.

### P6 — Dashboard sem hierarquia: 4 "heróis" competindo *(alto)*
**Onde:** Dashboard (13+ componentes condicionais).
Sobra + Patrimônio + IR + Carteira têm peso visual equivalente; nenhum vence. Empty states opacos (sem insights = "está quebrado?"). WelcomeBanner e SetupBanner competem na primeira visita (lógica OR onde devia ser sequencial).

### P7 — Entrada de dados lenta nas telas de configuração (sem inline-edit / bulk) *(alto)*
**Onde:** Orçamento, Categorias, Contas, Dívidas.
Tudo é modal: ajustar 5 orçamentos = 2-3 min abrindo/fechando sheets. Sem edição in-place com save on-blur, sem bulk-archive de categorias não-usadas (o app *avisa* "X sem uso" mas obriga arquivar uma a uma). Bonus técnico: BudgetManager usa `window.__budget` (anti-pattern frágil).

### P8 — Três caminhos de automação/fluxo que não conversam *(alto)*
**Onde:** Metas (aporte automático/waterfall) vs Resgates (saque automático); FireCalculator (/independencia) vs FirePreferencesForm (/configuracoes/fire).
Aporte e saque alimentam o mesmo `current_balance` em direções opostas, sem visão de fluxo de caixa unificada. O FireCalculator com sliders "brincáveis" reseta ao salvar porque o save real está em outra página — usuário mexe, gosta, não sabe como guardar.

---

## 3) Redundâncias e proposta de IA mais enxuta

### Redundâncias confirmadas (eliminar/fundir)

| Redundância | Diagnóstico | Ação |
|---|---|---|
| **Análise ↔ Relatórios** | Ambas = histórico (mensal vs anual) | Fundir: 1 página "Histórico" com toggle Mensal/Anual. O recorte "anual IRPF/export" vira aba dentro dela. |
| **Patrimônio ↔ Investimentos ↔ Independência** | "Patrimônio" = 3 significados | Criar 1 fonte única de "Patrimônio total" (breakdown: contas + carteira + bens). /investimentos = "Carteira", /patrimonio = "Bens". |
| **Assinaturas ↔ Recorrentes** | /assinaturas é só `redirect` para /recorrentes?view=subscriptions | **Remover do menu.** Já é pill dentro de Recorrentes (commit recente). |
| **/declarantes ↔ /ir/[year]/configuracoes** | Ambas renderizam Filers+Dependents | Manter UM hub. Sugestão: /declarantes = cadastro permanente; config do ano só aloca. Ou deletar /declarantes. |
| **/ir/[year]/revisao + /auditoria** | Páginas separadas que deviam ser seções | Colapsar como abas/seções dentro de /ir/[year]. |
| **IrWarningsBanner ↔ ChecklistPanel** | Mesma mensagem 2× | Banner = só crítico (fail-loud); Checklist = contexto/navegação. |
| **Metas ↔ Dashboard GoalRemindersCard** | Metas aparece 3× | Card = só "ação necessária" + "Ver todas →". Reminders=inbox, Metas=planejamento. |
| **Quick-add ↔ Bulk-add ↔ Inbox** | 3 formas de "adicionar", sem guia | Unificar entrada no ⌘K (modo simples / lote / documento). Renomear "Inbox" → "Documentos". |
| **FireCalculator ↔ FirePreferencesForm** | Sliders em 2 lugares | Calculator vira "testar cenário" dentro do form de preferências; /independencia mostra só resultado. |
| **Orçamento ↔ Categorias** | Teto definido em página separada do cadastro | Orçamento inline em /categorias (já parcial). |

### IA proposta — de 17 itens para ~9-10

**DIA A DIA** (operacional, alta frequência)
- Início (dashboard enxuto)
- Transações *(inclui Recorrentes como aba/filtro, não item separado)*
- Histórico *(= Análise + Relatórios fundidos, toggle mensal/anual)*

**PATRIMÔNIO**
- Patrimônio *(página unificadora: total + breakdown → linka Carteira/Bens/Metas)*
- Metas
- Independência (FIRE)

**IRPF**
- IRPF *(com sub-páginas/wizard internos: dados, bens, rendimentos, cálculo)*

**AJUSTES**
- Contas
- Categorias *(com orçamento inline)*
- Configurações *(perfil, fiscal, FIRE, contas)*

Sai do menu de topo: Assinaturas (redirect), Relatórios (vira aba), Recorrentes (vira aba/filtro de Transações), Declarantes (vira parte de IRPF/Config), Resgates e Dívidas como sub-itens de Patrimônio/Contas. **Móvel:** bottom nav de 3 fixos (Início · Transações · Carteira) + FAB de lançar sempre dominante + hamburger para o resto. Resolve a densidade do drawer e a dúvida do "4º item".

---

## 4) Facilidade de inserir dados — é rápido o suficiente?

**Não. É o ponto mais fraco do app, e é a prioridade declarada do dono.** Tem boas fundações (defaults inteligentes: última conta, moeda da conta, data=hoje; ⌘K; pills para tipo) mas a execução tem fricção alta exatamente no caso comum.

**Tempos atuais (estimados das avaliações):**
- Despesa simples: ~8-10s desktop (com atalho decorado), **~15-45s mobile.**
- Assinatura/recorrência: **2-3 min** (15+ campos para uma Netflix).
- Meta "casa": ~20 cliques/inputs.
- IRPF: caminho tortuoso, >4 cliques por campo, formulários espalhados.

**O que melhoraria (em ordem de impacto):**

1. **Modo "rápido" de transação** — só 3 campos: descrição, valor, conta. Categoria → "uncategorizada" (categorizar depois em lote), data → hoje. Tudo o mais (forma, IR, fonte pagadora, dívida, histórica/não-declarar) atrás de um "Mais detalhes" colapsado. Isso sozinho leva o lançamento simples de 8 campos para 3.

2. **Parser de texto inteligente** — campo único tipo `"30 mercado"` → valor 30, categoria Alimentação/mercado, conta default. É o quick-win de maior efeito percebido para "entrada rápida".

3. **CTA primário inegável** — FAB grande sempre dominante (acima do bottom nav, não atrás) + card sticky na home com 3 micro-CTAs (+Despesa / +Receita / +Transferência). Tornar ⌘K *descoberto* (hint no FAB, menção no onboarding).

4. **Navegação por teclado** — Enter avança para o próximo campo obrigatório; ⌘Enter salva (já existe). Quem digita rápido lança em segundos.

5. **Progressive disclosure nos forms pesados** — RecurrenceSheet, GoalSheet, InvestmentSheet em 2 passos: essencial primeiro, avançado/condicional depois. Esconder CNPJ/IR/financiamento por padrão. Pré-popular tipo de ativo a partir do ticker.

6. **Wizard de IRPF** — "Faltam 3 coisas: dependentes, deduções, outras rendas" com correção em contexto. ChecklistPanel com link direto que abre o form certo. Pedir CPF *quando* o usuário entra no IR, não num onboarding de 7 passos.

7. **Inline-edit + bulk nas configs** — Orçamento/Categorias/Contas: editar nome/saldo/teto in-place com save on-blur; bulk-archive de categorias não-usadas.

---

## 5) Plano de ação priorizado

### 🟢 Quick wins — ALTO impacto / BAIXO esforço (fazer primeiro, esta/próxima sprint)

1. **Remover /assinaturas do menu** (já é redirect). 5 min, reduz ruído. *(P-redundância)*
2. **FAB dominante + card de 3 CTAs na home** — promover a ação primária. *(P1)*
3. **Modo "rápido" de transação** (3 campos; resto em "Mais detalhes" colapsado). *(P1, P2)*
4. **Esconder por padrão** forma de pagamento, IR, histórica/não-declarar, dívida no AddTransactionDialog. *(P2)*
5. **Enter-to-next-field** nos campos críticos. *(P4 entrada)*
6. **GoalRemindersCard = só "ação necessária" + "Ver todas →"**; corrigir lógica Welcome vs Setup banner (sequencial, não OR). *(P6)*
7. **Renomear** "Análise"→"Histórico", "Relatórios"→aba; "Independência"→"Liberdade financeira"; "Inbox"→"Documentos". *(P5, nomenclatura)*
8. **ChecklistPanel do IR com link direto** para o form de correção. *(P4)*
9. **Refatorar `window.__budget`** para state React + edição inline com save on-blur em Orçamento. *(P7)*
10. **Bulk-archive** de categorias não-usadas. *(P7)*

### 🟡 Médio — alto impacto, esforço médio (sprint seguinte)

11. **Fundir Análise + Relatórios** em "Histórico" com toggle mensal/anual + aba IRPF/export. *(P5)*
12. **Progressive disclosure** em RecurrenceSheet, GoalSheet, InvestmentSheet (2 passos). *(P2)*
13. **Parser de texto** `"30 mercado"` no quick-add. *(P1)*
14. **Unificar entrada no ⌘K** (simples / lote / documento) com guia. *(redundância de entrada)*
15. **Reordenar Dashboard** com 1 herói (Sobra/Patrimônio), IR isolado, Carteira secundária; empty states contextualizados. *(P6)*
16. **Pré-popular tipo de ativo pelo ticker**; simplificar indexador/taxa em uma pergunta "Qual a taxa?". *(P2)*

### 🔴 Reestruturações maiores (planejar — alto impacto, alto esforço)

17. **Fonte única de "Patrimônio total"** (`patrimonio.ts`) + página/seção unificadora com breakdown (contas/carteira/bens); todas as outras páginas linkam a ela e param de reivindicar "patrimônio". *(P3)*
18. **Refatorar /ir/[year]** em dashboard + sub-rotas/abas (bens, rendimentos, deduções, cálculo) e **wizard pré-exportação**; consolidar /declarantes + /configuracoes; absorver revisao/auditoria como seções. *(P4)*
19. **Nova IA de 17→~9-10 itens** + bottom nav móvel de 3 + FAB; Recorrentes vira aba de Transações; Resgates/Dívidas viram sub-itens. *(densidade, P-redundância)*
20. **Painel de "Fluxo automático"** unificando aporte (Metas) e saque (Resgates) numa visão única; mover FireCalculator para dentro das preferências. *(P8)*

---

**Norte para o dono:** o app não precisa de mais features — precisa de **subtração**. Cada quick win acima remove campos, páginas ou cliques. Se a régua de toda decisão de produto nos próximos 2 meses for *"isso deixa lançar um gasto mais rápido ou deixa o menu mais curto?"*, o app vira o que ele pediu: profissional, simples e rápido — sem perder o diferencial do IRPF, que só precisa ser **guiado** em vez de despejado numa página de 481 linhas.


---

## Avaliações por superfície (resumo)

### Navegação global (Sidebar + Mobile Drawer), IA da sidebar com 17 itens em 4 grupos, Onboarding (Welcome → QuickStart ou Full Setup) — _bom_
Arquitetura de navegação bem pensada com agrupamento lógico de 17 itens em 4 grupos (Dia a dia, Patrimônio, IRPF, Ajustes), reduzindo ruído visual. Onboarding profissional leva ao "aha" rápido (2 passos pro valor mínimo viável). Porém: redundância entre Análise/Relatórios, alguns empty states passivos, e fricção de entrada de dados persiste em certos fluxos.

**Problemas:**

- **[medio/densidade]** 17 itens na sidebar = visão completa mas densidade alta em mobile/tablet — Considerar 'core nav' (6-8 itens) com seção expansível 'Mais' pra ajustes/IR. Ou tabs na home (Dia a dia, Patrimônio, IR) filtrando menu dinamicamente.
- **[medio/redundancia]** Redundância Análise ↔ Relatórios — Renomear: Análise → 'Histórico' e colocar seletor anual/mensal nela. Ou mover Relatórios pra sub-item (histórico → relatórios anuais). Atualmente ambas têm títulos vagos.
- **[baixo/redundancia]** Metas aparece 3 vezes (Sidebar, Dashboard card, Goal Reminders) — GoalRemindersCard mostrar APENAS 'action needed', com link 'Ver todas' → /metas. Clear separation: reminders = inbox, metas = planning.
- **[baixo/clareza]** Empty states não são proativos o suficiente — Padronizar: todo empty state deve ter CTA contextual (link + copy explicando 'por que vazio' + 'como preencher'). Componente EmptyState já existe, usar consistentemente.
- **[alto/friccao-entrada]** Fricção na entrada de transação — múltiplos campos opcionais — Modo 'quick' com apenas (descrição, valor, conta) — categoria e data defaultam (hoje, 'uncategorized'). Expandir em dialog secundário. Ou: campo inteligente tipo '10 refeição' interpreta valor+categoria de texto. IconButton com 'mais' abre advanced panel. Teste com usuário novo.
- **[medio/navegacao]** Quick Add (FAB) e Command Palette (⌘K) são 'hidden features' — Adicionar tooltip/hint: FAB mostra '+ ou ⌘K' on hover. Onboarding menciona '⌘K rápido + FAB'. Ou: bottom nav mostra ⌘K em badge discreto pra desktop.
- **[baixo/nomenclatura]** Nomenclatura imprecisa em alguns labels — Considerar: 'Análise' → 'Histórico' (clearer). 'Relatórios' → 'Fechamento anual'. 'Independência' → 'Liberdade financeira' (menos jargão). 'Orçamento' → item principal (não sub) ou em 'Dia a dia' (é operacional). Retestar nomenclatura com cohort novo.
- **[medio/friccao-entrada]** Onboarding full setup é 7 passos, potencialmente overwhelm — Manter QuickStart default, mas: (A) depois de lançar 1ª transação, mostrar 'Setup IR' banner discreto no dashboard. (B) Quebrar full setup em 2 phases: 'essencial' (titular + contas) e 'fiscal' (fontes, dependentes, renda). (C) Abordar cada phase em contexto (ex: quando user acessa IR, pedir CPF naquele momento).
- **[baixo/navegacao]** Sidebar nav não destaca caminho (breadcrumb ausente) — Adicionar <Breadcrumb> ao PageHeader ou manter Mini breadcrumb no mobile header fixo (ex: ← Resgates). Ou: highlight path — se em /resgates, marcar tanto 'Investimentos' quanto 'Resgates' como ativo.
- **[baixo/navegacao]** Mobile nav (bottom 5 items) não inclui acesso rápido a Análise ou Metas — Permitir customização de bottom nav (ex: pinning favoritos), ou reduzir pra 3 items (Home, Transações, Carteira) + drawer hamburger sempre visível = cleaner.

**Fricção de entrada:** Lançar transação simples em mobile: 8 campos (kind, account, category, amount, date, + opcional IR fields) via dialog único. Usuário novo precisa: (1) toque FAB/⌘K, (2) escolher tipo (expense/income/transfer), (3) preencher 5-8 campos conforme tipo, (4) submit. Desktop é OK (~15-20s), mobile é desconfortável (~30-45s por transação). Bom: QuickStart onboarding usa presets (bancos pré-populados), reduz primeiras contas de 5-10 passos pra 2. Ruim: não há 'quick mode' (descrição+valor=suficiente) nem autocomplete inteligente ("10 refeição" = valor 10 em categoria refeição). Entrada de dados é prioritária (dono enfatizou) — atual está em 'aceitável' (desktop 3 cliques), mas mobile precisa atrito reduzido.

### Início / Dashboard (app/(app)/dashboard/page.tsx) — _ok-mas-melhora_
A home é profissional e visualmente bem montada, mas sofre de SOBRECARGA ESTRUTURAL: 13+ componentes renderizados (muitos condicionais) com dois problemas graves que prejudicam a UX priorizada: (1) Fricção de entrada de dados é INDIRETA — o QuickAdd é global (Cmd+Shift+T), não contextualizado; (2) Hierarquia carece de foco — IR estimado é o "ímã", mas fica lado a lado com Carteira (sem vencer nenhum); o fluxo visual direciona para 7 dias + metas, não para a ação mais comum (adicionar transação).

**Problemas:**

- **[critico/friccao-entrada]** Fricção brutal de entrada de dados — QuickAdd hidden e não-contextualizado — Adicionar um banner/card ACIONÁVEL após o DashboardHero ou flutuando no rodapé (sticky) com 3 CTAs (+ Despesa, + Receita, + Transferência) — simples, direto. OU promover o QuickAdd para um ícone maior/mais visível na navbar. Prioridade #1: reduzir cliques para a ação mais comum de 2+ para 1.
- **[alto/hierarquia]** Hierarquia pulverizada — múltiplos 'heróis' sem foco primário — Reordenar: (1) DashboardHero (Sobra/Patrimônio) — claro, núcleo; (2) IR Estimate isolado em nova seção, sem competir; (3) Carteira como card secundário OU integrado no IR (ex: nota 'investimentos: R$ X'). OU mover Carteira para /investimentos e deixar IR como 2º card sólido.
- **[medio/redundancia]** Redundância parcial com /transacoes e /analise — rolo de três páginas — Dashboard = snapshot (Top 3 categorias, máximo). Links diretos para /analise (filtros avançados, histórico 12 meses, heatmaps). OU integrar um filtro de data DENTRO do TopCategoriesPanel (mini-date-range) pra evitar salto.
- **[medio/densidade]** Densidade visual conflitante — cards em grid lg:2, mas conteúdo irregular — Standardizar altura: todos os cards condicionais devem ter min-h-[300px] ou usar CSS grid auto-rows. OU reordenar por prioridade: Upcoming + Goals sempre, depois insights/anomalies em row separada.
- **[medio/clareza]** Contextualização vaga dos cards — quem/quando eles aparecem é opaco — Adicionar um empty state contextualizado: 'Sem insights por enquanto — continue lançando transações, e a IA detectará padrões.' Ou card discreto 'Achados desta semana' sempre visível mas vazio (explica purpose).
- **[baixo/friccao-entrada]** CreditCardBillShortcut é feature específico (ótimo UX) mas esconde a ação geral — Mover CreditCardBillShortcut para dentro de UpcomingObligationsCard (como sub-action no header) OU deixar só o QuickAdd global. Isso libera espaço na header e reduz cognitive load.
- **[baixo/nomenclatura]** Nomenclatura vaga em alguns labels — 'Sobra' vs 'Projetada' — Clarificar: 'Sobra do mês (realizado até hoje)' ou 'Sobra projetada no mês' com ícone de info simples. Mesmo pra 'Confiança alta/preliminar' — explique na tooltip.
- **[baixo/navegacao]** Setup Banner + Onboarding Banner competing — confusão visual na primeira vez — Lógica clara: WelcomeBanner ONLY se nunca entrou. SetupBanner AFTER onboarding feito OU 1+ transação. Não ambos (AND lógica, não OR).

**Fricção de entrada:** ALTÍSSIMA (crítico — contradiz prioridade #1). Inserir dados aqui exige: (1) Achar o botão 'Adicionar' pequeno na header (ou lembrar Cmd+Shift+T), (2) Clicar → abre modal, (3) Preencher tipo, valor, conta, data, categoria (5+ campos). Compare com home de app concorrente (ex: YNAB): CTA flutuante em baixo, 1 clique abre form simplificado com defaults. AQUI a entrada é periférica (não primária). Nota: CreditCardBillShortcut é excelente (3 campos: valor, conta, data), mas é CASE ESPECÍFICO. A solução é: (a) adicionar um card sticky ou flutuante na home com 3 micro-CTAs (Despesa, Receita, Transferência) que abrem formas rápidas, (b) OU simplificar QuickAdd em 2-steps (tipo → valor/descrição/conta, sem categorizar agora). Sem isso, usuário entra, vê bonito, mas não entra dados com fluidez.

### Entrada de dados — Transações, Recorrentes, Inbox (diálogos/modais + páginas de listagem) — _ok-mas-melhora_
A superfície é profissional e bem estruturada visualmente, com atalhos teclado (Cmd+K) e defaults inteligentes (última conta salva, moeda da conta, hoje como data). Porém, inserir transações simples requer 4-7 campos/cliques obrigatórios em fluxo linear sem otimizações claras — há muito espaço para reduzir fricção e agrupar melhor o essencial do acessório. Inbox/documentos estão bem, mas recorrentes têm overhead desnecessário (15+ campos mesmo pra casos simples).

**Problemas:**

- **[alto/densidade]** Excesso de campos na adição simples de transação — Separar campos obrigatórios (5: valor, descrição, conta, categoria, data) dos acessórios (forma, moeda opcionais; IR/dívida em popover/expansível). Reduzir modal principal pra ~300px height em mobile/tablet.
- **[medio/friccao-entrada]** Forma de pagamento é quase sempre ignorável em despesa comum — Tornar 'Forma' truly opcional com default 'não especificado' ou remover da vista principal. Se relevante, mostrar em seção 'Mais detalhes' colapsada.
- **[medio/redundancia]** Recurso IR (seção expansível) cria confusão visual — Mover pra um botão 'Detalhes IR' separado ou em modal secundário. Ou deixar collapsed por default e só abrir se user clica (atual já faz, mas visual weight é alto). Considerar AI/sugestão automática (calcular IRRF baseado em fonte + valor).
- **[medio/clareza]** Checkboxes Histórica e Não declarar no IRPF sem contexto claro — Consolidar em 1 campo 'Tipo de registro' (padrão, histórica, não declarar IRPF) com radio buttons ou dropdown simples. Mover pra seção colapsada 'IR'. Aliviar visual weight.
- **[medio/hierarquia]** Transferência requer visibilidade de ambas as contas (layout quebra em 1 conta) — Desabilitar pill 'Transferência' (não esconder) quando <2 contas existem, com tooltip explicativo. Ou redirecionar pra página de contas com mensagem clara.
- **[medio/densidade]** Grid 2 colunas força categoria + forma lado a lado — Colocar categoria em linha própria (full-width pra mobile, grid-cols-1 sm:grid-cols-2). Forma fica abaixo ou em seção colapsada.
- **[baixo/friccao-entrada]** Nenhum atalho pra tabular entre campos — Enter não avança — Implementar onKeyDown Enter nos campos críticos (valor, descrição) pra 'focus next required field'. Ou confirmar modal se tudo preenchido.
- **[baixo/navegacao]** Bulk-add está escondido em menu de ações — Promover bulk-add: link no empty state, atalho (Cmd+Shift+B?), ou toggle quick-add pra 'modo lote' visual.
- **[alto/densidade]** Recorrentes usa o mesmo RecurrenceSheet (15+ campos) pra todos tipos — Progressive disclosure: mostrar apenas Kind + Valor + Descrição + Conta. Botão 'Mais opções' abre popover/modal secundário com frequência/agenda/tax/IR. Ou separar 'Nova assinatura' (formulário simples) de 'Nova recorrência' (formulário completo).
- **[baixo/redundancia]** Inbox: redundância com quick-add (ambos adicionam dados ao app) — Adicionar na homepage/início guidance visual: 'Lançar rápido? Use Cmd+K · Várias de uma vez? Bulk · Documentos? Inbox'. Ou mostrar opções em Cmd+K. Renomear Inbox pra 'Documentos' pra clareza.
- **[baixo/hierarquia]** Recorrentes: calendário visual não mostra próximas datas — No calendário, ao passar mouse em um dia, mostrar pop-up com próximas ocorrências daquela data + valores. Ou mostrar 'R$ 2k' no dia em vez de só contador.

**Fricção de entrada:** FRICÇÃO ALTA em casos comuns. Despesa típica (mercado R$ 150): 1) clica Cmd+K (0 clique se atalho decorado), 2) seleciona despesa (já é default) ou muda, 3) digita valor (1 campo), 4) digita descrição (1 campo), 5) valida conta (pode estar salva, senão 1 clique dropdown), 6) valida categoria (1 clique, mas sem defaults inteligentes — picker fica vazio) = 3-5 cliques + 2 campos texto = ~15-20 segundos em mobile, 8-10 em desktop com atalhos. Recorrência simples (assinatura R$ 50/mês): forma aberta tem 15+ campos visíveis, usuário vê Frequência/Intervalo/Dia/Fonte pagadora/Tax deductible pra uma netflix = 2-3 minutos pra preencher. INBOX é smooth (drop + IA extrai, confirma 1-2 valores), mas pouco usado. BULK-ADD é escondido. Sem contexto: 9/10 usuários usam quick-add mesmo pra múltiplas transações, clicking muitas vezes.

### app/(app)/ir/[year]/page.tsx — A superfície IRPF (declaração de pessoa física) — _confuso_
A declaração concentra MUITA informação em UMA única página (481 linhas de código, 7+ seções principais), o que a deixa densa, poluída visualmente e cognitivamente sobrecarregada. A hierarquia existe mas está enterrada em componentes; a fricção de entrada é ALTA porque cada seção tem seu próprio formulário disperso, e há MUITA redundância com /declarantes. Um leigo se perde facilmente.

**Problemas:**

- **[critico/densidade]** Página única DEMASIADO densa — 481 linhas, 7 seções grandes, sem scroll anchor claro — Quebrar em ABAS ou SUB-PÁGINAS: /ir/[year] = Dashboard apenas (resumo, KPIs, CTA para próximo passo), e /ir/[year]/bens, /ir/[year]/rendimentos, /ir/[year]/variavel, /ir/[year]/deducoes, /ir/[year]/calculo-final como sub-rotas. Ou tabs com scroll nativo.
- **[critico/friccao-entrada]** Fricção de entrada: formulários espalhados sem caminho claro — Consolidar entrada em UMA página-raiz: /ir/[year]/dados-pessoais que centraliza filers, dependentes, deduções. OU: retirar /declarantes da sidebar se não é autossuficiente. Eliminar duplicação.
- **[alto/hierarquia]** Hierarquia confusa: KPIs genéricos antes do contexto dos dados — Mudar ordem: Checklist pré-exportação PRIMEIRO (o que falta fazer), depois KPIs (resultado final), depois detalhes (Bens, Rendimentos, etc). OU: fazer KPIs contextuais com links diretos às seções.
- **[alto/redundancia]** Redundância: /declarantes duplica /ir/[year]/configuracoes — OPÇÃO A: deletar /declarantes, pôr link em /ir/[year]/configuracoes. OPÇÃO B: /declarantes = hub permanente (só cadastro), /ir/[year]/config = alocação por ano-base.
- **[medio/nomenclatura]** Nomenclatura: 'Declaração [year]' vs 'IRPF/[year+1]' vs 'ano-base [year]' é confuso — Padronizar: 'IRPF/2025 (entrega) · ano-base 2024 (apuração)'. Colocar 1 parágrafo: 'Valores de 2024, entregue ao Fisco em 2025 (prazos 1º março a 30 abril).'
- **[medio/densidade]** Seção 'Imposto a pagar' com 2 cards lado a lado é apertada em mobile — Cards empilhados em mobile (já faz isso com lg:grid-cols-2). Adicionar tooltips/ícones ajuda ('Educação limitada a R$ 3.561,50 por dependente. Saúde sem limite.').
- **[alto/friccao-entrada]** /ir/[year]/configuracoes é outra página gigante — 6 panels, muito scroll — Quebrar em sub-rotas: /ir/[year]/config/titular, /config/dependentes, /config/deducoes, etc. Ou: criar WIZARD modal que aparece se checklist tem >2 erros.
- **[medio/redundancia]** Avisos (IrWarningsBanner) vs Checklist (ChecklistPanel) duplicam propósito — Deixar avisos CRÍTICOS no banner (fail-loud), contexto/checklist apenas em ChecklistPanel. Sem duplicação.
- **[medio/consistencia]** Micro-patterns inconsistentes: form inline vs sheet drawer vs modal — Padronizar: campos simples (3-4) → form inline. Campos complexos → Sheet drawer. Aplicar a TODOS os managers.
- **[medio/friccao-entrada]** Sem validação contextual: ChecklistPanel aponta erro mas não navega pra corrigir — ChecklistPanel item com erro deve ter link direto: item.link = '/ir/[year]/configuracoes#dependentes' ou modal editável inline. OU: criar IncorrectItemWidget que abre o form relevante.

**Fricção de entrada:** CRÍTICA E MUITO ALTA. Usuário novo que quer preencher a declaração: /ir → [vê que falta dados] → clica 'Configurar' → /ir/[year]/configuracoes (outra página gigante) → scroll por 6 panels → encontra DependentsManager → clica Add → form pequeno inline aparece → preenche → repeat para Deductions, Outras Rendas, Fontes. Cada ação é isolada. SEM WIZARD que diga "Faltam 3 coisas: dependentes, deduções, outras rendas". PROBLEMAS: (1) Caminho tortuoso com >4 cliques por campo. (2) Formulários espalhados: Dependentes em /declarantes E /configuracoes. (3) Sem validação clara: ChecklistPanel aponta erro mas não leva direto pra correção. (4) Entradas manuais são "extra" — usuário pode não saber se está em Rendimentos, Carnê-leão, Variável ou Outras Rendas. (5) Inconsistência form inline vs sheet drawer. (6) Sem guia de contexto: "Se vendeu ação vá pra Renda Variável. Se recebeu aluguel vá pra Carnê-leão." (7) /ir/[year]/configuracoes é TÃO densa quanto /ir/[year]. RECOMENDAÇÃO: Criar WIZARD pré-exportação interativo que caminha: "Você tem dependentes? Sim → quem?" → preenche. "Despesas dedutíveis? Sim → qual tipo?" → vai pra seção correta. Ou: consolidar entrada em UMA página /ir/[year]/dados-pessoais com sub-formulários claros. Reduzir para <2 cliques por campo crítico.

### Investimentos, Patrimônio, Independência, Metas, Resgates (5 páginas + 30 subcomponentes) — _confuso_
App profissional e visualmente polido, com lógica financeira sofisticada (Monte Carlo, FIRE, waterfall). PORÉM: superfícies sofrem de redundância conceitual severa ('patrimônio' = 3 significados, dois gráficos de trajetória paralelos) e fricção crítica de entrada de dados (GoalSheet 942 linhas com 15+ campos + condicionais complexos; InvestmentSheet com indexador/taxa/multiplicador não-óbvio). Usuário novo abandona ao tentar criar meta ou investimento. Imperativo: consolidar redundâncias, dividir formulários complexos em steps, simplificar campos opcionais (ocultar CNPJ/IR por padrão), padronizar nomenclatura (patrimônio, sobra, rendimento) em todas as 5 páginas. Visão geral de patrimônio total + relações entre páginas está FALTANDO (precisa de página unificadora ou dashboard hero).

**Problemas:**

- **[critico/clareza]** Redundância semântica crítica: 'Patrimônio' = 3 significados diferentes em 3 páginas — Padronizar: (1) /investimentos = 'Carteira de investimentos' (não 'Patrimônio'); (2) /patrimonio = 'Bens (Imobilizado)'; (3) criar página OU seção de dashboard que mostre ÚNICO 'Patrimônio total' = soma de contas + carteira + imóveis, breakdown com 3 colunas. Todas as outras páginas linkam a esse 'patrimônio.ts' único. Retire '%x do patrimônio' de todas as outras páginas.
- **[alto/redundancia]** Dois gráficos de 'trajetória' redundantes com lógica diferente (Investimentos vs Resgates) — Consolidar: (1) /investimentos = 'Evolução da carteira' (foco: quanto tenho agora, quanto terei, volatilidade com Monte Carlo); (2) /resgates = 'Renda passiva: saques do ano' (foco: quanto saco este mês, próximos saques, histórico). Tirar Panel de 'trajetória' do Resgates, deixar só 'próximos saques' + 'histórico' + 'simulador' (que já existe e é único).
- **[alto/redundancia]** Dois pipelines de automação (Aporte vs Saque) sem visão coordenada — (1) Centralizar 'Fluxo de caixa automático' em um lugar (novo painel tipo /automacoes ou no dashboard). Mostrar: entrada mês (aportes às metas) + saída mês (saques de resgates) = saldo. (2) Simplificar: remover 'plano de aportes' de Metas se o usuário não tem modo automático ativo (ex: 'Manual' mode). (3) Documentar: quando aporta manual + tem saque automático, qual tem prioridade? Sistema já cuida, mas usuário não vê.
- **[critico/friccao-entrada]** GoalSheet (942 linhas) = formulário scroll infinito com 15+ campos, 4 modos de alocação não-óbvios + financiamento com 8 sub-campos condicionais — (1) Dividir GoalSheet em 2 telas / passos: Tela A = essencial (tipo + nome + valor + moeda), Tela B = avançado (alocação + fontes + financiamento). Ou usar multi-step. (2) Simplificar modos: remover 'waterfall' do MVP (deixar como future), oferecer só 'manual / R$ fixo / %'. (3) Melhorar labels: 'Modo de aporte' em vez de 'allocation mode'; 'Dia de aporte planejado' em vez de 'contribution_day'; 'Comece a contar a partir de' em vez de 'tracking_starts_at'. (4) Vincular fontes em página separada post-criação (tipo ações em /investimentos/edit → abrir PhysicalAssetSheet). (5) Financiamento: gated por tipo=casa, esconder por padrão.
- **[alto/friccao-entrada]** InvestmentSheet (619 linhas) = 10+ campos não-óbvios (indexador + taxa + multiplicador + CNPJ + IR colapsados) — (1) Pré-popular 'Tipo ativo' baseado no ticker (ex: 'LCI' → detecta fixed_income_private). (2) Se tipo = 'fixed_income' (qualquer), mostrar APENAS uma opção: 'Qual é a taxa?' com radio (Selic/CDI/IPCA/prefixado/nenhuma) → condicional mostrar campo (% ou taxa). (3) CNPJ + IR em drawer separado acessível via link 'Adicionar dados fiscais (opcional)'. (4) Simplificar: remover 'Advanced' collapse, integrar taxa/indexador inline após tipo ativo. (5) Labels: 'Multiplicador do Selic' em vez de 'indexer_multiplier'.
- **[medio/hierarquia]** Hierarquia visual: 5 páginas com 'hero' não-coordenados (5 diferentes headers + designs) — (1) Criar seção 'Visão geral financeira' no dashboard ou em página nova (/riqueza) que mostre: Patrimônio total (breakdown em 3 colunas: contas, investimentos, bens). Dela, links pra /investimentos, /patrimonio, etc. (2) Padronizar headers: todos com mesmo eyebrow format, mesmo subtitle style. (3) Adicionar seção de 'Relações' tipo 'Esta meta usa estas fontes' visual.
- **[medio/nomenclatura]** Nomenclatura inconsistente entre 'sobra mensal' (FIRE + Metas) e 'rendimento mensal' (Resgates) — Padronizar: (1) 'Sobra mensal' = net savings (só em FIRE + Metas); (2) 'Rendimento mensal' = yield from investments (só em Resgates + Investimentos). (3) Adicionar hints inline: 'Sobra mensal: suas receitas menos despesas dos últimos 6 meses' vs 'Rendimento mensal: juros de sua carteira (Selic/CDI/dividendos)'.
- **[medio/clareza]** PhysicalAssetCard mostra '%x do patrimônio total' sem deixar claro que é SÓ imobilizado, não o todo — Adicionar contexto no header de Patrimônio: 'Seu patrimônio total é R$ 5.5M: investimentos (R$ 2.5M), imobilizado (R$ 1.2M), contas (R$ 1.8M)'. Link visual (ex: pie chart) que mostre breakdown.
- **[medio/redundancia]** Metas com 'fontes vinculadas' + Resgates com 'regras' = conceitos paralelos que não conversam — Renomear em metas: 'Vincular conta/investimento como ORIGEM' (não 'fonte'). Nota: 'Quando você aporta, vai sair desta origem'. Em Resgates: 'Origem do saque' (não confundir). Layout paralelo nas duas páginas pra mostrar 'O que alimenta metas' vs 'O que sai de investimentos'.
- **[baixo/hierarquia]** GoalsOverview mostra 'Próximas conquistas' (top 3 metas por % progresso), mas usuário talvez queira ver PRÓXIMAS POR DATA — Adicionar tab/toggle em GoalsOverview: 'Próximas conquistas' (sort by %) vs 'Próximas por prazo' (sort by target_date). Ou, adicionar coluna 'dias até' em Próximas conquistas.
- **[baixo/redundancia]** FireCalculator (sliders interativos) vs FirePreferencesForm (settings) = duplicação — Mover FireCalculator pra /configuracoes/fire como seção 'Teste cenários' abaixo do form. Deixar /independencia mostrando APENAS resultados (trajetória, Monte Carlo, cenários comparativos pré-salvos em prefs). Ou: deixar calculator em /independencia mas marcar sliders como 'temporary, click Save to keep'.

**Fricção de entrada:** **Muito Alta** (crítico). Duas superfícies têm fricção severa:

1. **Metas (GoalSheet.tsx, 942 linhas)**: Formulário scroll infinito com 15+ campos obrigatórios + condicionais. Cenário typical: criar meta "Casa" = tipo (1 click) + nome (1 input) + moeda (1 select) + valor alvo (1 input) + modo alocação (1 select) + data alvo (1 input) + vincular contas/investimentos como fontes (N pills com dropdown + %), depois SE casa: ativar financiamento, preencher preço imóvel, entrada %, custos %, taxa, prazo, sistema (SAC vs Price). Usuário precisaria de ~20 cliques/inputs pra uma meta de casa completa. Modo "cascata" em metas é avançado e confunde iniciantes.

2. **Investimentos (InvestmentSheet.tsx, 619 linhas)**: Form com "Advanced" + "IR" collapsos. Ao inserir novo investimento: conta (1) + ticker (1) + tipo ativo (8 opções) + saldo (1) + [depende do tipo]: indexador (Selic/CDI/IPCA/prefixado) + taxa/multiplicador (complexo pra RF) + CNPJ (opcional, raro) + filer + regime IR. Taxa e indexador têm lógica condicional não óbvia (ex: CDB indexado ao CDI usa multiplicador, Tesouro usa taxa prefixada fixa). CNPJ + IR ocupam 3 campos colapsados mas clutteiam pra 95% dos usuários.

**Comparação:**
- Patrimônio: 4-5 campos visíveis, rápido (simples + baixa fricção)
- Resgates: 4-5 campos, muito rápido (simples + modal pequeno)
- Independência: 7 sliders com defaults inteligentes, médio (interativo)
- Metas: 15+, scroll longo, condicional complexo, MUITO ALTO
- Investimentos: 10-12, não-óbvio domínio (indexadores/taxas), ALTO

**Impacto**: Dono pediu "entrada de dados rápida e fácil (prioridade nº1)". Metas e Investimentos FALHAM nisso. Usuário novo abandon a após 3 cliques em Metas.


### Análise, Relatórios, Orçamento, Categorias, Contas, Dívidas, Assinaturas — _ok-mas-melhora_
Páginas profissionais e bem estruturadas visualmente. Mas sofrem de redundância severa (Análise vs Relatórios vs Dashboard), entrada de dados é lenta (edição em modal de vários campos para cada item, sem inline-edit generalizado), e falta fluxo natural de composição de dados (usuário não consegue ir direto de orçamento para gastos por categoria, precisa pular entre páginas).

**Problemas:**

- **[alto/hierarquia]** Redundância severa entre Análise, Relatórios e Dashboard — Consolidar em duas: (1) 'Análise' = insights de 6 meses atrás até hoje (seletor mensal, gráfico income-vs-expense, maiores movedores, categorias TOP), (2) 'Relatórios' = anual only, focado em IRPF + bens + investimentos + export. Remover Dashboard ou virar um overview semanal (não-redundante) com upcoming bills, goals progress, alert-only insights.
- **[critico/friccao-entrada]** Entrada de dados lenta em todas as superfícies de configuração — Implementar inline-edit generalizado: Orçamento já está semi-inline, deixar input sempre visível, salvar on-blur. Categorias: reorder por drag já existe, mas edit de nome/cor deveria ser clique duplo in-place, não modal. Mesmo pra Contas/Dívidas quando não muda tipo — só nome/saldo.
- **[alto/navegacao]** Sem flow visual entre Orçamento e gastos reais por categoria — No Budget Manager, cada linha deveria ser um link pra /transacoes?categoryId=X&month=Y. Ou ao menos um botão 'Ver transações' ao lado do valor gasto.
- **[medio/redundancia]** Orçamento vs Categorias = entrada de dados duplicada — Mover 'definir orçamento' inline pra /categorias quando tipo='expense' (já está parcialmente em CategoryRow). Ou deixar /orcamento como única entrada, mas fazer link pra /categorias pra criar categoria faltante.
- **[baixo/consistencia]** Assinaturas está vazia (redirect para /recorrentes?view=subscriptions) — Remover '/assinaturas' do menu e apontar diretamente pra '/recorrentes?view=subscriptions'. Ou implementar a página de verdade em /assinaturas.
- **[medio/friccao-entrada]** Categorias: lista de não usadas é alerta, não ação — Adicionar checkboxes nas linhas de categorias não-usadas, bulk-archive via um botão.
- **[medio/densidade]** Contas: faturas abertas aparecem inline, tiram atenção do saldo — Mover faturas abertas pra um painel colapsível ou deixar em /transacoes com filtro padrão. Ou manter mas com 'show 3 itens, + load more'.
- **[medio/clareza]** Relatórios: investimentos + rendimentos por regime sem clara separação — Reorganizar: Fluxo anual → Top categorias → Investimentos (movimentos + rendimentos juntos) → Bens declaráveis. Ou: criar abas (Fluxo | Investimentos | IRPF).
- **[baixo/navegacao]** Sem busca em Categorias ou Dívidas para listas grandes — Adicionar search box em Categorias (filtra por nome). Opcional pra Dívidas se lista cresce.
- **[medio/consistencia]** Budget Manager usa window.__budget (anti-pattern) — Refatorar: BudgetManager deveria usar state React pra cada item, passar valor via prop ou contexto, não global.

**Fricção de entrada:** Crítica. Orçamento: 2 cliques por item (edit, depois Check). Categorias: 1 click edit, modal abre, 4+ campos, salvar. Contas: idem. Dívidas: idem. Reorder em Categorias é rápido (drag-drop), mas editar nome/cor exige modal. Rearranjar 10 budgets = ~2 min só com modals. Ajustar saldos de conta exige AccountSheet modal cada vez. Falta inline-edit (editar nome in-place, salvar on-blur). Falta bulk-actions (ex: arquivar N categorias não-usadas de uma vez). Recomendação: reduzir modals grandes em páginas de administração, mover pra inline-edit com auto-save on-blur ou Check button inline (já existe em Orçamento, estender pra outros).
