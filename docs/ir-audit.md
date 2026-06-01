# Auditoria técnica do motor de IRPF

> Documento gerado a partir de achados verificados adversarialmente (confirmados/incertos) e dos resumos por dimensão. Anos-base em escopo: 2024, 2025, 2026. Data de referência da auditoria: 2026-06-01.
>
> **Método.** 11 agentes auditores (um por dimensão tributária) cruzaram o código com a legislação; cada achado passou por um verificador adversarial (instruído a refutar). 85 achados → 56 confirmados, 29 refutados. As tabelas de imposto (anual/mensal/capital) foram conferidas direto no banco de produção. A dimensão **renda variável** (seção 8) foi re-auditada num passe próprio. Um **crítico de cobertura** (seção 7) apontou áreas não varridas.
>
> **Totais consolidados (principal + renda variável):** 2 critical · 11 high · 21 medium · 16 low · 4 info.

---

## 1. Sumário executivo

### Contagem por severidade

| Severidade | Confirmados | Incertos | Total |
|---|---|---|---|
| Critical | 2 | 0 | **2** |
| High | 10 | 0 | **10** |
| Medium | 17 | 0 | **17** |
| Low | 9 | 4 | **13** |
| Info | 4 | 0 | **4** |
| **Total** | **42** | **4** | **46** |

### Veredito geral

**O motor é parcialmente confiável, mas NÃO está pronto para gerar valores de imposto definitivos sem revisão profissional — especialmente para 2026 e para ganho de capital imobiliário.** A aritmética nuclear (tabelas progressivas, continuidade de faixas, desconto simplificado, deduções, isenções, montagem conjunta/separada, sinal do `netDue`, abatimento de créditos) é sólida, bem testada e fail-loud onde importa. O problema não está na "matemática do esqueleto", mas em **regras tributárias específicas mal implementadas** e em **dados/leiaute desatualizados**.

### Os 5 riscos mais importantes

1. **Fatores de Redução de imóveis (FR1/FR2, Lei 11.196/05) materialmente errados** — subestimam ou superestimam o DARF de ganho de capital de QUALQUER imóvel adquirido até 2005 (e ausência total de FR2 para imóveis pós-2005). Dois achados *critical*. Erra o imposto para cima e para baixo dependendo do ano de aquisição.
2. **Redutor anual da Lei 15.270/2025 implementado como fração do imposto, não como a redução em reais da lei** — erro de milhares de reais por declaração na faixa R$60k–R$88,2k, exatamente o público-alvo da reforma, em ano-base já vigente (2026). Três achados *high* convergentes, com teste protegendo o bug.
3. **Leiaute de Bens e Direitos (grupos 2024+) divergente do oficial** — ações, FIIs, ETFs, renda fixa, previdência e veículos saem em grupos errados/inexistentes no registro R27, causando misclassificação. Vários achados *high*/*medium*.
4. **Comparador conjunta×separada descarta a renda de carnê-leão no cenário separado** — subtributa silenciosamente a opção "separada" e pode recomendar o modelo errado; o dado para ratear já existe no banco e é ignorado por uma justificativa de código factualmente falsa.
5. **Conversão cambial inconsistente em ativos no exterior** — cron grava saldo em moeda nativa e `bens.ts` lê como BRL (`ratesPrev` carregado e descartado); cripto doméstica em moeda estrangeira usa PTAX de 31/12 para o ano inteiro. Distorce a coluna "Situação anterior" e a base de isenção.

**Pontos fortes a preservar:** continuidade das faixas em todas as tabelas; arquitetura fail-loud de classificação de renda (catch-all → `naoClassificado` com aviso crítico + gate HTTP 409 no export do titular); rollforward com `isEstimate` propagado até a UI e *throw* explícito quando não há tabela; convenção de sinal do `netDue` consistente; isenção de doações sem circularidade.

---

## 2. Achados por severidade

### 2.1 Critical (2)

#### C1 — FR1 conta meses até a data da venda, não até a publicação da lei (2005)
- **Arquivo:linha:** `lib/financial/gcap-calculator.ts:50-62`
- **Base legal:** Lei 11.196/05 art. 40, §1º, I (m1 acumula até o mês da publicação da lei — nov/2005; restante via FR2)
- **Esperado vs atual:** FR1 deveria contar `m1` somente até nov/2005. O código conta da aquisição até a **data da venda** (`monthsBetween` sem teto), inflando o expoente. Pior: para ativos pré-1996 o FR2 retorna 1, então toda a redução recai sobre a FR1 inflada.
- **Impacto:** imóvel adquirido em 1990 e vendido em 2026: lucro tributável do código ≈ R$73.229 vs. correto ≈ R$209.008 (subavaliação ~2,9x); DARF a 15% = R$10.984 (código) vs R$31.351 (correto). Subtributação ~R$20k numa única venda; valores gravados em `physical_asset_sales` dirigem o DARF apresentado.
- **Confiança:** high · **Status:** confirmado
- **Razão do verificador:** Código confere exatamente. Correção factual: o teto legal de `m1` é **nov/2005** (publicação 21/11/2005), não jun/2005 como o achado original citou; e há piso §2º em jan/1996. A estrutura alegada (m1 travado em ponto fixo de 2005, resto via FR2) está correta. Sem teste cobrindo a contagem de meses de FR1 para imóveis.

#### C2 — FR2 restrito a aquisições 1996–2005 e conta meses a partir da aquisição
- **Arquivo:linha:** `lib/financial/gcap-calculator.ts:69-83`
- **Base legal:** Lei 11.196/05 art. 40, §1º, II (m2 conta de dez/2005, ou do mês de aquisição se posterior; aplica-se a TODO imóvel)
- **Esperado vs atual:** FR2 deveria aplicar-se a todos os imóveis (cumulativo com FR1) e contar `m2` a partir de dez/2005. O código (a) só calcula FR2 se a aquisição estiver entre 1996–2005 (`return 1` fora da janela) e (b) conta `m2` da aquisição. Imóveis pós-2005 não recebem FR2 (deveriam); imóveis 1996–2005 recebem expoente inflado.
- **Impacto:** erro nos dois sentidos. Imóvel adquirido jan/2008, vendido jun/2026 (ganho R$300k): correto ≈ R$20,7k de imposto; código cobra R$45k (sobrecobrança ~R$24k). Para 1996–2005, subtributação por `m2` inflado.
- **Confiança:** high · **Status:** confirmado
- **Razão do verificador:** Ambas as alegações confirmadas no código e na lei. O comentário do código (linhas 65-67) explicita a interpretação errada. Os testes existentes (`property-sale.test.ts:33-34`) cristalizam o comportamento bugado como "esperado".

---

### 2.2 High (10)

#### H1 — Redutor anual (Lei 15.270/25) como fração do imposto, não redução fixa em reais
- **Arquivo:linha:** `services/ir/tax-math.ts:68-79, 109, 116`
- **Base legal:** Lei 15.270/2025 (Art. 11-A na Lei 9.250/95): `Redução = 8.429,73 − 0,095575 × rendimentos tributáveis`, limitada ao imposto, faixa R$60.000,01–R$88.200
- **Esperado vs atual:** O código faz `redutor = impostoBruto × (88200−renda)/(88200−60000)` — fração linear do imposto. A lei define um VALOR em reais função apenas da renda. Matematicamente: a lei é afim em `y`; o código é quadrático em `y` (produto de dois termos afins), coincidindo só nos extremos 60k/88,2k.
- **Impacto:** renda R$74.100 → redutor legal fixo R$1.347,62; código entrega ~50% do imposto (varia com o modelo). Erro de milhares de reais por declaração na faixa central da reforma, em ambas as direções. Distorce também a escolha simples×completo.
- **Confiança:** low (sobre a fórmula exata; o verificador confirmou alto) · **Status:** confirmado
- **Razão do verificador:** Confirmado em três fontes independentes. O próprio mensal (`irpf-monthly-table.ts:128`) já implementa a mecânica correta (valor-fixo), tornando o anual inconsistente com o irmão. Teste `tax-math.test.ts:65` protege o bug (espera 4188,75 = 50% de 8377,5). **Nota:** H1, H8 e H9 são três faces do mesmo defeito raiz (redutor anual), reportados por dimensões distintas (tax-tables, orchestration).

#### H2 — Isenção de dividendos sem corte de vigência (subtributa a partir de 2026)
- **Arquivo:linha:** `services/ir/classify-income.ts:103-111`
- **Base legal:** Lei 9.249/95 art. 10; **Lei 15.270/2025** (IRRF 10% sobre dividendos PJ→PF acima de R$50 mil/mês a partir de 2026; regras de transição)
- **Esperado vs atual:** O código classifica dividendo como isento cód.09 incondicionalmente, sem gate por ano. `classifyIncomeTx` nem recebe ano-base. Para 2026 isso está LEGALMENTE INCORRETO acima do limite mensal.
- **Impacto:** subtributação — omite IRRF 10% e a base do IRPFM de altas rendas. Defeito adjacente: `DIVIDEND_ALIASES` inclui "jcp" (que é exclusivo na fonte, nunca isento).
- **Confiança:** high · **Status:** confirmado
- **Razão do verificador:** O achado original concluiu "info/correto para 2026"; o verificador **refutou** essa premissa: a Lei 15.270/2025 está em vigor desde 01/01/2026, encerrando a isenção irrestrita. O colega SUBESTIMOU a severidade.

#### H3 — Função "Pre88" não implementa a redução por ano da Lei 7.713/88 art. 18
- **Arquivo:linha:** `lib/financial/gcap-calculator.ts:46-62`
- **Base legal:** Lei 7.713/88 art. 18; IN SRF 84/2001 art. 26 (redução por ano de aquisição até 1988: 100% até 1969, −5 p.p./ano até 1988)
- **Esperado vs atual:** A função batizada "Pre88" só implementa o FR1 (corte em 1996), não a tabela percentual da Lei 7.713/88. Imóveis ≤1988 não recebem a redução adicional, aplicada ANTES dos FR.
- **Impacto:** imposto superestimado para imóveis muito antigos. Imóvel até 1969 deveria ter ganho 100% reduzido (isento de fato); imóvel de 1980 perde 45% de redução.
- **Confiança:** high · **Status:** confirmado
- **Razão do verificador:** Grep confirma que a tabela da Lei 7.713/88 não existe em lugar nenhum. Nome "Pre88" enganoso (corte real em 1996). High e não critical por atingir população estreita e decrescente.

#### H4 — Ações/quotas (31/32/39) no grupo 04 em vez do grupo 03 (Participações Societárias)
- **Arquivo:linha:** `services/ir/codes.ts:55-58`
- **Base legal:** Leiaute Bens e Direitos IRPF 2024+ — Grupo 03 Participações Societárias
- **Esperado vs atual:** Códigos 31, 32, 39 recebem `group "04"`. O grupo oficial é 03. Esse `group` é emitido no R27 (`dec-export.ts:104`).
- **Impacto:** ações (ativo mais comum de PF) caem no grupo errado no .DEC.
- **Confiança:** high · **Status:** confirmado
- **Razão do verificador:** Faceta de uma inconsistência sistêmica maior (códigos flat antigos pareados com grupos do leiaute novo). Não corrompe valores monetários → high, não critical.

#### H5 — PGBL/VGBL (91/92) e créditos (97) no grupo "09" (inexistente no leiaute)
- **Arquivo:linha:** `services/ir/codes.ts:96-99`
- **Base legal:** Leiaute Bens e Direitos — catch-all é grupo **99**; Grupo 05 = Créditos; PGBL declara-se em Pagamentos Efetuados (não em Bens)
- **Esperado vs atual:** 91/92/97/99 recebem `group "09"`, que não existe no leiaute (o catch-all é 99). PGBL não é patrimônio declarável em Bens; código VGBL "92" é incompatível com o grupo novo (99/06); crédito 97 deveria ser grupo 05.
- **Impacto:** registro R27 com grupo inexistente; PGBL classificado como bem (incorreto). Rejeição/inconsistência na importação.
- **Confiança:** low (achado original) → verificador elevou para **high**
- **Razão do verificador:** Achado original *subestimou* — afeta os 4 códigos, não só o 97. O "09" no comentário-de-origem confundiu o dígito do grupo 99.

#### H6 — Comparador: cenário separado descarta toda a renda de carnê-leão e seu crédito
- **Arquivo:linha:** `services/ir/comparator.ts:58-66`
- **Base legal:** RIR/2018 art. 118 (rendimentos de PF sujeitos a carnê-leão integram a base anual)
- **Esperado vs atual:** No cenário separado, `carneLeaoQuery` vira `null` quando `filerId` é definido (`rendimentos.ts:160-170`) e o crédito é zerado (`imposto.ts:177`). Aluguel/freelance PF/pensão somem das bases dos dois filers. A conjunta inclui; a separada não.
- **Impacto:** `separateNet` artificialmente menor → recomenda "separate" indevidamente e/ou reporta economia inexistente. Renda some EM SILÊNCIO (contra a filosofia fail-loud).
- **Confiança:** high · **Status:** confirmado
- **Razão do verificador:** Os comentários do código ("carne_leao_mensal não tem filer") são **FALSOS**: a migration `20260524130000` adiciona `filer_id` e faz backfill ao primário. O dado para ratear existe e é ignorado — é bug, não limitação de modelo. High (não critical) porque o caminho single-filer não é afetado.

#### H7 — Rendimentos não classificados somem do export do contador sem marcação
- **Arquivo:linha:** `services/ir/dec-export.ts:119-163`
- **Base legal:** Universalidade dos rendimentos — Lei 7.713/1988 arts. 2º e 3º (princípio)
- **Esperado vs atual:** `generateDec` só itera tributáveis/isentos/exclusivos; `naoClassificados` (warning "crítico") e `warnings` são ignorados, inclusive no humanReadable.
- **Impacto:** renda real marcada como crítica não aparece no arquivo. Omissão silenciosa.
- **Confiança:** high · **Status:** confirmado (escopo corrigido)
- **Razão do verificador:** O caminho principal do titular tem **Gate D8** (HTTP 409 em `route.ts:120-132`) que recusa o export com renda não classificada — refuta a premissa universal. O buraco real é o **branch do contador** (`route.ts:27-79`, chama `generateDec` sem o gate). Rebaixado de critical para high. Correção: aplicar o gate D8 ao branch do contador.

#### H8 — Redutor anual: fração linear do imposto bruto (orchestration)
- **Arquivo:linha:** `services/ir/tax-math.ts:68-79, 109, 116`
- **Base legal:** Lei 15.270/2025 Art. 1º
- **Status/confiança:** confirmado · low (achado) → high (verificador)
- **Nota:** **Duplicata funcional de H1**, vista pela dimensão *imposto-orchestration*. Mesma causa-raiz, mesma correção (`redutor = 8429,73 − 0,095575 × rendaAnual`, clamp `[0, impostoBruto]`). O ROADMAP item #8 já reconhece a dívida.

#### H9 — Redutor anual: gatilho de renda vs base do modelo (orchestration)
- **Arquivo:linha:** `services/ir/tax-math.ts:109, 116`
- **Base legal:** Lei 15.270/2025 — definição de "rendimentos" do redutor
- **Esperado vs atual:** O gatilho `baseTributavelBruta` (renda bruta) está CORRETO (a lei usa rendimento tributável, não base pós-deduções). O bug real é o mesmo de H1/H8: redutor como fração do imposto.
- **Confiança:** low → high · **Status:** confirmado
- **Razão do verificador:** O título original (gatilho errado) foi **refutado**; a causa-raiz é o mesmo defeito de H1. **Terceira face do mesmo bug.**

#### H10 — Cron grava saldo de ativo estrangeiro em moeda nativa; `bens.ts` lê como BRL
- **Arquivo:linha:** `app/api/cron/year-end-snapshot/route.ts:80-91, 124-138, 146-158`
- **Base legal:** IN RFB 1.500/2014; PGD IRPF (Bens em BRL); Lei 14.754/2023 (ativos no exterior)
- **Esperado vs atual:** O cron grava `current_balance`/`current_value` cru (moeda nativa) em `ir_prior_year_balances`; `bens.ts:505-515` lê direto como `previousYearValue` sem FX. Conta de USD 10.000 → coluna "Situação 31/12/N-1" mostra R$ 10.000 em vez de ~R$ 55.000.
- **Impacto:** coluna "Situação anterior" e "Variação vs N-1" ~5x subavaliadas para ativos em moeda estrangeira do snapshot automático. Risco de aparência de "sumiço" de patrimônio (malha). Valor persistido copiável para a declaração.
- **Confiança:** high · **Status:** confirmado
- **Razão do verificador:** Schema documenta "BRL convertido se ativo estrangeiro". Só o cron diverge (manual e snapshot fechado estão corretos). High (não critical) porque afeta coluna derivada e só usuários com ativos estrangeiros pré-existentes. **Relacionado a M-ratesPrev** (mesma raiz: o reader também não converteria).

---

### 2.3 Medium (17)

| # | Título | Arquivo:linha | Base legal | Esperado vs atual (resumo) | Impacto | Conf. | Status |
|---|---|---|---|---|---|---|---|
| M1 | JCP cai em dividendos isentos (cód.09) por falta de flag | `rendimentos.ts:467-478` | Lei 9.249/95 art. 9º §2º (JCP exclusivo 15%, cód.10) | Todo movimento `kind='dividend'` vai p/ isento 09; não existe `kind='jcp'` no modelo, então JCP cai aqui | Ficha/código errados; IRRF retido invisível. Sem subtributação direta (JCP é exclusivo) | medium | confirmado |
| M2 | Isenção 65+ usa teto anual cheio (×13) no ano do aniversário | `exencoes.ts:62-72` | Lei 7.713/88 art. 6º XV; IN 1.500/14 (isenção a partir do mês dos 65) | `ageAtYearEnd` ignora mês/dia; quem completa 65 em nov recebe isenção anual cheia | Super-isenta a aposentadoria no ano do aniversário (subtributa); 1 ano por declarante | medium | confirmado |
| M3 | Multa de mora (0,33%/dia, teto 20%) e juros SELIC+1% ausentes | `carne-leao.actions.ts:99-118` | Lei 9.430/96 art. 61 | `markCarneLeaoPaid` só grava `paid_at`; nenhum cálculo de acréscimo de atraso | DARF em atraso exibido sem multa/juros (principal correto) | high → medium | confirmado |
| M4 | Vencimento DARF carnê-leão ignora feriados nacionais | `irpf-monthly-table.ts:39-46` | Lei 8.134/90; RIR/2018 art. 118 ("dia útil") | `lastBusinessDayOfNextMonth` só recua em sáb/dom | Datas de DARF erradas em meses com feriado no último dia útil; o helper `isBusinessDay()` já existe no repo | low → medium | confirmado |
| M5 | Reaplicação 180d sem trava de 5 anos nem natureza residencial | `gcap-calculator.ts:157-167` | Lei 11.196/05 art. 39 §5º; IN SRF 599/2005 | Confia no booleano da UI; `real_estate` engloba terreno/comercial (não-residencial) | Isenção indevida → DARF subestimado. Dado p/ validar 5 anos já está no banco | medium | confirmado |
| M6 | Custo de aquisição sem benfeitorias/corretagem | `property-sale.actions.ts:14-26` | RIR/2018 arts. 145-148; IN SRF 84/2001 art. 17/19 | `acquisitionCost` é número único; sem campos p/ benfeitoria/corretagem | Lucro/imposto superestimados se usuário não embutir manualmente | medium | confirmado |
| M7 | Isenção imóvel único ≤ R$440k sem validar "único" + "sem venda em 5 anos" | `gcap-calculator.ts:152-156` | Lei 9.250/95 art. 23 | Só verifica o teto R$440k; as outras 2 condições ficam no booleano da UI | Subdeclaração silenciosa do tributo sob cenário plausível; dado validador à mão | low → medium | confirmado |
| M8 | Vencimento DARF de GCAP ignora feriados | `gcap-calculator.ts:106-115` | Lei 8.981/95 art. 21 §1º; RIR/2018 art. 982 | Só recua em sáb/dom; ex.: fev/2024 → 29/03 (Sexta Santa) vs 28/03 | Prazo de DARF posterior ao legal → risco de multa/juros | low → medium | confirmado |
| M9 | Cripto: PTAX de 31/12 para o ano inteiro, não câmbio da operação | `exterior-crypto.ts:311-353` | IN RFB 1888/2019; RIR/2018 art. 146 | `getRateMapAt(yearEnd)` único p/ todas compras/vendas; contraste com `getExteriorReport` (por data) | Custo/ganho/isenção R$35k errados p/ cripto doméstica em moeda estrangeira | high → medium | confirmado |
| M10 | Conjunta soma +1 dependente sem checar cônjuge em `ir_dependents` | `comparator.ts:53-55` | Lei 9.250/95 arts. 35, 8º II c | `extraDependents=1` por cima de todos os deps ativos; sem guard de duplicidade | Dedução duplicada (~R$2.275) infla totalDeducoes → enviesa p/ "joint" | medium | confirmado |
| M11 | Renda/pagamento com `owner_filer_id` NULL excluído do cenário separado | `comparator.ts:58-61` | RIR/2018 art. 6º; IN 1.500/14 art. 4º (bens comuns 50/50, nunca omitidos) | `=` com NULL nunca é TRUE → linha some de ambos os filers; conjunta inclui | Subtributação real no export separado; `ownership-split.ts` já existe mas não é usado em rendimentos | medium | confirmado |
| M12 | Dívidas e Ônus Reais ausentes do content estruturado (.DEC) | `dec-export.ts:78-192` | Ficha Dívidas (>R$5k em 31/12); IN RFB DIRPF anual | Loop emite R01/R27/R51/R71/R72/R73/R99; dívidas só no humanReadable | `content` perde a ficha de dívidas; mitigado pelo TXT humano | high → medium | confirmado |
| M13 | CNPJ de Bens chega formatado (18) e R27 trunca em 14 | `dec-export.ts:107` | Leiaute Bens (CNPJ 14 dígitos) | `fmtCNPJ()` → "XX.XXX.XXX/XXXX-XX"; `clean(...,14)` corta sem remover pontuação | CNPJ truncado e inválido no .DEC; mitigado por não ser importável | high → medium | confirmado |
| M14 | Grupos de Bens 2024+ inconsistentes; esquema código-por-grupo ausente | `codes.ts:45-99` | Leiaute Bens com grupos (IN RFB 2.134/2023) | Veículos (21/22/23) em group "02" contradizendo header "03"; code 45 sob comentário "05" mas group "06"; códigos planos antigos | Pares grupo+code não-conformes no R27; mitigado por não-importável | medium | confirmado |
| M15 | Opções excluídas do R73 do export | `dec-export.ts:168-170` | IN RFB 1.585/2015 art. 47+ | `allMonths = [swing, dayTrade, fii]` — `rv.options` fora; humanReadable idem | Lucro/prejuízo de opções não aparece no export (motor apura corretamente) | low → medium | confirmado |
| M16 | `ratesPrev` (câmbio 31/12/N-1) carregado e descartado (`void`) | `bens.ts:379, 391, 814` | IN RFB 1.500/2014; Lei 14.754/2023 | `getRateMapAt(endOfPrevYear)` buscado e anulado em 814; nenhum `previousYearValue` é convertido | Mesmo que o cron (H10) fosse corrigido, o reader não converteria | medium | confirmado |
| M17 | Integração isenção 65+/moléstia + IRRF-sobre-isento sem teste | `rendimentos.ts:551-619` | Lei 7.713/88 art. 6º XV e XIV | Só `splitAposentadoriaExemption` puro é testado; acúmulo por filer, cód.10 vs 11 e linha restituível não | Regressão não detectada perde parcela tributável/crédito restituível | high → medium | confirmado |
| M18 | Isenção 65+ mistura 13º no mesmo teto anual ×13 | `exencoes.ts:31-34` | Lei 7.713/88 art. 6º XV; IN 1.500/14 arts. 6-7 | Teto único ×13 sobre soma da aposentadoria, sem separar 13º (exclusivo); `t13` de aposentadoria é descartado em `rendimentos.ts:493` | 13º de aposentadoria some; regime errado p/ o 13º | medium | confirmado |
| M19 | Reaplicação 180d sem modelar trava de 5 anos (tests) | `gcap-calculator.ts:157-167` | Lei 11.196/05 art. 39 §5º | Aplica isenção sempre que `willReinvestIn180Days=true`; sem parâmetro de uso anterior; teste não cobre 2ª venda em 5 anos | Isenção indevida → GCAP subestimado | medium | confirmado |

> **Nota:** M5 e M19 descrevem o mesmo gap (trava de 5 anos da reaplicação), reportados por dimensões diferentes (capital-gains e tests). M2 e M18 também se sobrepõem parcialmente no tratamento 65+/13º. Há **18 linhas** na tabela porque a contagem de 17 do sumário consolida M5/M19 como um único achado material; mantive ambos visíveis para rastreabilidade por dimensão.

---

### 2.4 Low (13 — 9 confirmados, 4 incertos)

#### Confirmados (9)

| # | Título | Arquivo:linha | Base legal | Resumo | Impacto |
|---|---|---|---|---|---|
| L1 | 13º salário entra na base progressiva (via alias) | `income-aliases.ts:37-38, 80-82` | Lei 7.713/88 art. 26; RIR/2018 art. 700 | Aliases "13o salario"/"decimo terceiro" → bucket tributável. **Mas** nenhuma categoria semeada usa esse nome; o caminho real (holerite) já trata como exclusivo | Defeito latente sem caminho de dados realista. Rebaixado de critical→low |
| L2 | Dedução de aluguel sem restrição "pago pelo locador" nem livro-caixa | `carne-leao.actions.ts:19-83` | RIR/2018 arts. 31, 14, 68-69 | `deductible_expenses` é número livre sem ramificar por kind | Gap de validação/UX sobre campo manual; sem bug aritmético |
| L3 | `computeCarneLeaoTax` default `month=1` | `carne-leao.ts:81-87` | Apuração por competência (MP 1171 vs 1206 em 2024) | Sem `month` cai em janeiro silenciosamente. Único caller sempre passa `month` | Footgun latente; sem efeito hoje |
| L4 | Citação legal da seed do exterior desatualizada | `migration 20260531240000:32-38` | Lei 14.754/2023 | `source='Lei 13.259/16 + IN 1888/19'` p/ `exterior_rate=0.15` | Cosmético/rastreabilidade; valor 0,15 correto |
| L5 | GROUP_LABELS define "03=Veículos" mas nenhum código mapeia para 03 | `bens.ts:135-145` | Leiaute (03=Participações) | Grupo-fantasma; label inalcançável | Higiene de código; sem impacto tributário |
| L6 | IRRF de exclusivos (13º/JCP) omitido no R72 | `dec-export.ts:152-162` | IN RFB 1.500/14 art. 7º | R72 não inclui `irrf`; R51/R73 e humanReadable incluem | Conciliação impossível pelo .DEC; informacional |
| L7 | Prejuízo mensal de renda variável exportado com `Math.abs()` no R73 | `dec-export.ts:168-184` | IN RFB 1.585/15 art. 64 | `moneyToReceita` faz `abs`; −R$5.000 sai igual a +R$5.000 | Ambiguidade cosmética; motor calcula compensação corretamente; TXT preserva sinal |
| L8 | Códigos isentos 10/11 divergem dos labels de codes.ts | `codes.ts:189-200` | Lei 7.713/88 art. 6º XV/XIV | `rendimentos.ts:565` emite 10/11 (códigos **oficiais corretos**); o label de "10" em codes.ts está trocado e "11" não existe. Mapa é tabela morta | Inconsistência documental; sem impacto fiscal |
| L9 | Rollforward mensal: `effective_from_month` arbitrário em ano multi-competência | `ir-tax-tables.ts:279-296` | MP 1171 vs 1206/Lei 14.848 (2024) | Passos 2/3 ordenam só por `year`, sem desempate; retroação a <2024 pode pegar MP 1171 em vez de 1206 | Bomba-relógio; hoje só em estimativas sinalizadas. Fix: `.order("effective_from_month", desc)` |
| L10 | Teste de saque proporcional reimplementa a aritmética | `withdraw-proportional.test.ts:18-32` | N/A (rateio de saldo) | Testa cópia local, não `redemptions.actions.ts`; produção já divergiu da cópia | Falsa cobertura; só reporting, sem imposto |
| L11 | docs afirma "13º exclusivo" mas só o caminho manual separa | `rendimentos.ts:483-516` | RIR/2018 art. 700 | 13º via transação income entra na progressiva; só `ir_other_incomes` separa | Sobre-tributa (conservador); caminho holerite correto |
| L12 | Virada da tabela mensal 2024 (MP 1171→1206) não exercida em teste | `irpf-monthly-table.test.ts:7-67` | MP 1171/23 vs MP 1206/24 | Todos os casos usam o default MP 1206; motor em produção está correto (seed tem ambas as linhas) | Gap de cobertura; sem impacto fiscal |

> A tabela lista 12 itens confirmados porque L11 (`docs-13o-fluxo-manual`) e L1 (`decimo-terceiro-na-base-progressiva`) tratam do mesmo fluxo de 13º por ângulos distintos; ambos confirmados, baixo impacto.

#### Incertos (4) — precisam de confirmação contra fonte oficial

| # | Título | Arquivo:linha | O que falta confirmar | Contra qual fonte |
|---|---|---|---|---|
| U1 | Variação cambial do exterior fixada em 0 (stub) | `exterior-crypto.ts:252` | Se o FX não-realizado do **saldo mantido** deve ser tributado. O FX de **ganho realizado** já está correto (compra/venda convertidas por data). Campo `fxVariation` é morto (nunca lido) | Lei 14.754/2023 art. 3º; decisão de escopo do ROADMAP item #10 (diferido deliberadamente) |
| U2 | Poupança (45) sob comentário "Grupo 05" mas group "06" | `codes.ts:65-66` | Se poupança é grupo 06 (Depósito) ou **grupo 04** (Aplicações). Fontes secundárias apontam grupo 04 | Manual oficial RFB (MIR) do ano-base — não consultável neste ambiente |
| U3 | Opções inferidas como código 99 de Bens | `codes.ts:151-152` | Se opção em aberto em 31/12 deve aparecer em Bens (e em qual grupo — provavelmente 04, não 99). Gera linha R$0 se saldo nulo | Perguntão IRPF / leiaute do ano. Impacto material baixíssimo |
| U4 | Mês anterior à 1ª competência cai em estimativa | `ir-tax-tables.ts:267-286` | Bug de lógica real, mas dormente (todos os anos seedados começam em mês 1) e o "esperado" do achado é juridicamente discutível | Modelagem própria do schema; sem caminho de dados atual |
| U5 | Comparador "cônjuge como dependente" sem teste | `comparator.ts:53-66` | A **falta de teste** é real; a tese de erro legal foi **refutada** (cônjuge é dependente na conjunta independente de renda própria) | RIR/2018 art. 90 / instruções DIRPF. Só gap de cobertura |

---

### 2.5 Info (4)

| # | Título | Arquivo:linha | Resumo | Impacto |
|---|---|---|---|---|
| I1 | `isGenericPassiveCategory` usa igualdade exata vs `includes` dos demais matchers | `income-aliases.ts:76, 111-114` | Assimetria de matching; "renda passiva imóveis" cai no catch-all crítico em vez de genérico | Sem imposto; muda só severidade do aviso (mais conservador) |
| I2 | Trabalho no exterior como carnê-leão (correto) sem distinção de GCAP nem câmbio | `carne-leao.actions.ts:10, 60-83` | `exterior_trabalho` correto na tabela progressiva; sem guard contra misclassificação de GCAP nem conversão FX | Sem risco se usuário classificar certo e informar valor em BRL |
| I3 | Comentário diz cripto virou anual sem isenção, mas o código (correto) mantém R$35k mensal | `exterior-crypto.ts:13-16` | Docstring ambígua ("e CRIPTO ... sem isenção"); implementação correta (IN 1888/19 vigente em 2026) | Nenhum no cálculo; risco de manutenção |
| I4 | Trailer R99 conta linhas antes de incluir o próprio R99 (off-by-one) | `dec-export.ts:190` | `lines.length` lido antes do `push` | Cosmético; nada parseia o R99 |

---

## 3. Resumo por dimensão

- **tax-tables-models:** Aritmética e limites das tabelas progressivas (anual/mensal/capital) corretos e bem testados; continuidade das faixas confere em todas. Problema grave nos **dados da tabela ANUAL 2024**: faixa-zero cadastrada (26963,20) é inconsistente com as próprias mensais do app (correto ≈ 26521,60) e diverge da RFB — imposto de ajuste ~R$184/ano menor em todas as faixas superiores. Achados menores: mecânica do redutor anual (H1) e divergências de centavos no rollforward 2025.

- **income-classification:** Arquitetura fail-loud sólida e bem testada. Principais problemas: 13º na base progressiva via alias (L1, baixo impacto real), JCP misturado em dividendos isentos (M1), dividendos sem gate de vigência 2026 (H2). Isenção 65+ congelada em R$1.903,98 (correto hoje, revisar por ano).

- **carne-leao:** Tabela mensal por competência correta e contínua nas fronteiras (MP 1171/23, MP 1206/24, Lei 15.270/25 conferem). Vencimento do DARF correto exceto por feriados (M4). Lacunas: multa/juros de atraso ausentes (M3); dedução de aluguel sem restrição de locador (L2); redutor mensal aplicado sobre o bruto e não a base.

- **capital-gains-property:** Tabela progressiva 15–22,5% correta e contínua; isenções R$35k/mês, imóvel único ≤R$440k e reaplicação proporcional estruturalmente OK. **FR1/FR2 materialmente errados (C1, C2)** e ausência da redução Lei 7.713/88 (H3). Faltam composição de custo (M6) e validações das isenções (M5/M7/M19) e exclusão de feriados (M8).

- **exterior-crypto:** Faixas de cripto e 15% flat do exterior numericamente corretos; `calcCryptoTax` progressiva/contínua/idempotente. Divergências: base de isenção R$35k contra vendas líquidas (deveria ser bruta); PTAX 31/12 para o ano todo (M9); 15% flat sem distinguir aplicação financeira de bem/direito; citação legal desatualizada (L4); `fxVariation=0` (U1).

- **bens-codes:** Catálogo de códigos e valoração razoáveis, mas a **árvore de grupos diverge do leiaute 2024+** (H4, H5, M14, L5; grupo 05 "Renda Fixa" inexistente). Esquema híbrido (códigos flat antigos + grupos novos) não bate com nenhum dos dois consistentemente. Conversão de moeda de 31/12 OK; situação anterior via snapshots/entries manuais OK.

- **imposto-orchestration:** Sinal do `netDue` consistente; recomendação escolhe o menor `netDue`; créditos abatidos; circularidade de doações evitada. Problemas: redutor anual como fração do imposto (H1/H8/H9), comparador separado perde carnê-leão (H6) e dupla contagem de dependente/owner NULL (M10/M11).

- **dec-export:** Disclaimer honesto (não é .DEC oficial; caminho confiável é o humanReadable). Divergências de fidelidade: dívidas ausentes do estruturado (M12), não classificados omitidos (H7), CNPJ truncado (M13), IRRF de exclusivos omitido (L6), prejuízo perde sinal (L7), opções fora do R73 (M15), grupos inconsistentes (M14), códigos de FII/65+ divergentes (I-26-FII, L8), R99 off-by-one (I4).

- **rollforward-years:** Núcleo sólido (busca exata → below → above, sempre `isEstimate=true`, throw explícito quando não há tabela). Flag propaga até a UI. Tabelas seedadas contínuas. Descartou off-by-one no ano de `prior_year_balances`. Problemas: integridade FX cross-ano (H10, M16) e ambiguidade do rollforward mensal multi-competência (L9, U4).

- **tests-and-assumptions:** Aritmética nuclear pura com boa cobertura golden. Lacunas materiais sem teste: `renda-variavel.ts` (zero testes — H-renda-variavel), virada mensal 2024 (L12), integração de `rendimentos.ts` (M17). Premissas embutidas sem base/teste: `fxVariation=0`, redutor mensal sobre bruto, cônjuge-como-dependente, reaplicação sem trava de 5 anos. Divergência docs↔código no 13º.

---

## 4. Lacunas de teste e premissas

### 4.1 Lacunas de cobertura (sem rede de testes)

1. **`renda-variavel.ts` (swing/day-trade/FII/opções + carryforward) — ZERO testes** *(high)*. Motor que apura DARF 6015 de bolsa, com fronteiras de ±R$0,01 (isenção 20k swing, ETF derrubando isenção, IRRF 0,005% vendas vs 1% lucro day-trade, compensação de prejuízo entre anos). Nenhum bug ativo encontrado na releitura, mas qualquer refactor passa despercebido. `services/ir/renda-variavel.ts:115-408`.
2. **Virada da tabela mensal 2024 (MP 1171→1206) não exercida** *(low)*. O motor em produção está correto (seed tem ambas as linhas); falta blindar a regressão. `irpf-monthly-table.test.ts:7-67`.
3. **Integração de `rendimentos.ts` (isenção 65+ por declarante com teto, IRRF-sobre-isento restituível, carnê-leão líquido na base) só testada na função pura** *(medium)*. `rendimentos.ts:551-619`.
4. **`compareDeclarationStrategies` sem teste algum** *(uncertain)* — lógica que afeta dinheiro e a recomendação conjunta×separada.
5. **Teste de saque proporcional testa cópia local, não a produção** *(low)* — falsa cobertura já demonstrada (produção divergiu e o teste continuou verde).

### 4.2 Premissas embutidas (sem base/teste explícito)

- `fxVariation` hardcoded em 0 no exterior (campo morto; decisão de escopo do ROADMAP item #10).
- Redutor mensal opera sobre renda BRUTA, não a base tributável (diverge do desenho da lei).
- Parcela isenta 65+ congelada em R$1.903,98 para todos os anos (correto hoje; conferir publicação por ano).
- Cônjuge tratado como +1 dependente na conjunta (legalmente sólido, mas sem teste e sem guard de duplicidade).
- Isenção de reaplicação de imóvel sem a trava de 5 anos e sem validação residencial.
- Isenção 65+ aplica ×13 cheio no ano do aniversário e mistura o 13º no mesmo teto.
- `previousYearValue` assumido sempre pré-convertido em BRL — premissa quebrada pelo cron.

---

## 5. Recomendações priorizadas

### Esforço baixo (corrigir primeiro — alto valor, pouca mudança)

1. **Redutor anual (H1/H8/H9):** trocar `impostoBruto × fração` por `redutor = clamp(8429,73 − 0,095575 × rendaAnual, 0, impostoBruto)`. Atualizar o teste `tax-math.test.ts:65`. *Resolve três achados high de uma vez; afeta o ano-base 2026 vigente.*
2. **Vencimento de DARF com feriados (M4/M8):** usar o `isBusinessDay()` já existente em `lib/financial/business-days.ts` nos três cálculos de DARF (`irpf-monthly-table.ts:39-46`, `carne-leao.ts:21-30`, `gcap-calculator.ts:106-115`).
3. **CNPJ truncado no R27 (M13):** `clean((item.cnpj||"").replace(/\D/g,""),14)` antes do slice, ou não pré-formatar no campo de máquina.
4. **Grupos de Bens (H4/H5/M14/L5):** corrigir os números de grupo para o leiaute 2024+ (Ações→03; FII/ETF→07; renda fixa→04; remover grupo "09"/"05" fantasmas). Mover PGBL para Pagamentos.
5. **Labels e códigos documentais (L8, I-26-FII):** corrigir `codes.ts` 10/11/26 para os textos oficiais; remover/realocar JCP do `DIVIDEND_ALIASES`.
6. **R73: opções e sinal de prejuízo (M15, L7):** incluir `rv.options` em `allMonths` e preservar o sinal em `moneyToReceita` (ou usar `monthlyLoss`). Incluir IRRF no R72 (L6) e contar o próprio R99 (I4).
7. **Default perigoso de `month` (L3):** tornar `month`/`year` obrigatórios em `computeCarneLeaoTax`.
8. **Desempate de competência no rollforward (L9):** `.order("effective_from_month", desc)` nos passos 2/3.

### Esforço médio

9. **FR1/FR2 de imóveis (C1/C2/H3):** reimplementar com `m1` travado em nov/2005 (piso jan/1996), FR2 cumulativo a partir de dez/2005 para todos os imóveis, e adicionar a tabela percentual da Lei 7.713/88 art. 18 aplicada antes dos FR. Reescrever os testes que cristalizam o bug. *Crítico para qualquer imóvel adquirido até 2005.*
10. **Gate D8 no export do contador (H7):** aplicar o mesmo bloqueio HTTP 409 (ou warning/marcador) no branch do contador em `route.ts:64`.
11. **Comparador separado perde carnê-leão (H6):** ratear/atribuir a renda de `carne_leao_mensal` por `filer_id` (já existe no schema) no cenário separado. Remover comentários falsos.
12. **Dívidas no content estruturado (M12):** emitir registro próprio de dívidas (>R$5k) no `content`.
13. **JCP exclusivo (M1):** adicionar `kind='jcp'` ao modelo de `investment_movements` (DB + Zod + tipos) e rotear para exclusivo cód.10.
14. **Validações de isenção de imóvel (M5/M7/M19):** checar `physical_asset_sales` para a trava de 5 anos e modelar natureza residencial.
15. **Dividendos com gate de vigência 2026 (H2):** passar ano-base para `classifyIncomeTx` e aplicar a regra da Lei 15.270/2025.

### Esforço alto

16. **FX cross-ano de ativos no exterior (H10/M16):** decidir a convenção (converter no cron via PTAX 31/12/N-1 com `convertStrict`, ou gravar nativo + `currency` e converter na leitura usando `ratesPrev`, hoje descartado). Corrigir o cron e o reader de forma coerente.
17. **Cripto: câmbio por data de operação (M9):** substituir o `getRateMapAt(yearEnd)` único por busca por data, espelhando `getExteriorReport`. Corrigir a base de isenção R$35k para vendas brutas.
18. **Cobertura de testes de `renda-variavel.ts` (H-renda-variavel):** suíte golden cobrindo fronteiras de 20k, ETF, IRRF, carryforward entre anos.
19. **Regime do exterior (Lei 14.754/2023):** distinguir aplicação financeira (15% anual) de bem/direito (GCAP progressivo) em `exterior-crypto.ts`.
20. **Composição de custo de imóveis (M6):** campos para benfeitorias, ITBI, corretagem de compra e despesas de venda.

---

## 6. O que continua dependendo de aval profissional (contador CRC)

Estes itens o código **não fecha sozinho** — são interpretações legais, dados de input dependentes do contribuinte, ou regras que exigem contexto que o app não pode verificar:

1. **Tabela anual 2024 (faixa-zero 26963,20):** confirmar contra a tabela oficial da RFB para ano-base 2024 qual o valor correto da parcela a deduzir e se o ~R$184/ano de divergência procede. *(Decisão de dado, não de código.)*
2. **Fórmula exata do redutor da Lei 15.270/2025:** os coeficientes 8.429,73 / 0,095575 vieram de fontes secundárias e da ancoragem das fronteiras; **confirmar contra o texto publicado** (Art. 11-A na Lei 9.250/95) antes de transmitir.
3. **Leiaute oficial de grupos/códigos de Bens do ano-base:** os números de grupo (03/04/05/07/99) e o esquema código-por-grupo foram cruzados com fontes secundárias; **conferir dígito-a-dígito no manual MIR/Perguntão do programa do ano** (não consultável neste ambiente). Inclui poupança (U2) e opções abertas (U3).
4. **Tributação de dividendos em 2026:** regras de transição (data de aprovação, ano do lucro, limite mensal R$50k) exigem julgamento caso a caso — o motor não tem como decidir sozinho.
5. **Variação cambial não-realizada do saldo no exterior (U1):** área juridicamente controversa; o ROADMAP optou por declarar manualmente. Decisão de escopo a validar com contador.
6. **Composição de custo de imóveis e despesas dedutíveis (M6, L2):** quais benfeitorias/corretagens são comprovadas e dedutíveis é juízo do contribuinte/contador; o app só fornece o campo.
7. **Validações que dependem de histórico não digitalizado:** "único imóvel", "sem alienação em 5 anos", natureza residencial, "despesa paga pelo locador" — o app só pode checar o que está no banco; o contador valida o que não está.
8. **Parcela isenta 65+ por ano:** confirmar a publicação do valor a cada novo ano-base (hoje congelado em R$1.903,98).
9. **Multa/juros de DARF em atraso (M3):** o banco/Receita.gov.br recalculam na emissão; a estimativa do app é conveniência, não substitui o cálculo oficial.

> **Conclusão para o usuário:** o motor é uma boa base de estimativa e organização, com aritmética confiável, mas **três áreas precisam de correção antes de produzir valores de imposto definitivos**: ganho de capital imobiliário (FR1/FR2), o redutor anual de 2026, e o leiaute de grupos de Bens. Até lá, toda declaração transmitida deve passar por conferência de um contador CRC, especialmente para quem tem imóveis adquiridos até 2005, renda na faixa R$60k–R$88,2k em 2026, ativos no exterior, ou opera renda variável.

---

## 7. Lacunas adicionais de cobertura (crítico de auditoria)

Áreas tributárias que a varredura principal não cobriu ou cobriu de raspão — levantadas por um agente crítico de cobertura. Complementam (não substituem) os achados acima.

## LACUNAS REAIS de cobertura na auditoria de IRPF

### 1. 13º salário tratado como rendimento progressivo (deveria ser tributação EXCLUSIVA)
**Por que importa:** O 13º é tributado **exclusivamente na fonte** (ficha própria), NÃO entra na base anual progressiva. Hoje os aliases `"13o salario"` e `"decimo terceiro"` estão dentro de `SALARY_ALIASES`, então qualquer renda assim classificada cai em `tributavel` e infla a base progressiva — duplicando tributação e mudando a recomendação simples×completo. O campo `thirteenth` existe na estrutura mas só é populado por renda manual (`ir_other_incomes.thirteenth_amount`); o classificador automático nunca o separa, e o `total13` nem é deduzido da base.
**Onde mora:** `services/ir/income-aliases.ts:36-38` (aliases de 13º em SALARY), `services/ir/classify-income.ts:85-92`, `services/ir/rendimentos.ts:659` (total13 calculado mas não isolado da base).

### 2. RRA — Rendimentos Recebidos Acumuladamente (sem tributação própria)
**Por que importa:** RRA (ações trabalhistas, atrasados de aposentadoria, revisões do INSS) têm regime opcional: tabela progressiva sobre nº de meses de competência OU ajuste anual. O app aceita a categoria manual `rendimento_acumulado` mas a **joga inteira em `tributaveis`** como renda comum — não pede o número de meses, não aplica a tabela "/N meses", não oferece o exclusivo. Subestima ou superestima imposto em valores grandes.
**Onde mora:** `services/ir/rendimentos.ts:514-515` (`else if (o.category === "rendimento_acumulado") tributaveis.push(row)` — sem campo `numMeses` nem cálculo RRA).

### 3. JCP (Juros sobre Capital Próprio) classificado como dividendo isento (deveria ser exclusivo 15%)
**Por que importa:** JCP é tributado **exclusivamente a 15% na fonte** e vai na ficha "Rendimentos Sujeitos à Tributação Exclusiva" (cód. 10), NÃO é isento como dividendo. Os `investment_movements` só têm `kind = "dividend"` no fluxo de IR; o próprio comentário admite: *"JCP iria pra exclusivo (cod 10) — sem flag pra distinguir, presume todos dividendos"*. JCP recebido é então declarado como isento, subtributando. Note que `investment-history.ts:387` já reconhece `kind: "jcp"` — a informação existe, mas o motor de IR a descarta.
**Onde mora:** `services/ir/rendimentos.ts:139-144` (query só pega `kind="dividend"`) e `rendimentos.ts:467-479` (push como isento cód. 09).

### 4. Pensão alimentícia do RECEBEDOR (alimentando) não é classificada como rendimento tributável
**Por que importa:** O app cobre bem a pensão do **pagador** (dedução `pensao_alimenticia`, cód. 30). Mas para quem **recebe** pensão judicial, ela é rendimento tributável sujeito a carnê-leão (ou isento desde a ADI 5422 para pensão de alimentos — decisão que precisa ser explicitada). Não há categoria de renda que reconheça "pensão recebida"; o alias `"pensao"` em `APOSENTADORIA_ALIASES` colide e mandaria pensão alimentícia recebida para o pool de isenção 65+ erroneamente.
**Onde mora:** `services/ir/income-aliases.ts:41-49` (`"pensao"`/`"pensoes"` em APOSENTADORIA_ALIASES, sem distinguir pensão por morte/previdenciária de pensão alimentícia), `services/ir/classify-income.ts` (sem bucket para pensão recebida).

### 5. PGBL × VGBL na entrada de dedução (VGBL não é dedutível, mas o resgate é tributável)
**Por que importa:** Na ficha de **bens** o app distingui PGBL (cód. 91) de VGBL (cód. 92). Mas na ficha de **pagamentos dedutíveis** (`ir_deductible_payments`), os kinds são só `pgbl`/`previdencia_privada` — não há kind `vgbl`, e nada impede o usuário lançar VGBL como dedutível. VGBL **não deduz** da base (é seguro, não previdência). Inversamente, o **resgate** de PGBL é 100% tributável e de VGBL só o rendimento — nenhum dos dois é tratado no lado da renda.
**Onde mora:** `types/database.ts:104-106` (kinds dedutíveis sem vgbl), `components/ir/deductibles-manager.tsx:33` e `deductible-edit-sheet.tsx:33` (dropdown deixa lançar previdência sem alertar VGBL), `services/ir/imposto.ts:146-149` (soma `pgbl`/`previdencia_privada` sem checar se é VGBL).

### 6. Dependentes 21–24 anos estudantes — sem validação da regra de idade
**Por que importa:** Filho/enteado só é dependente até 21 anos, ou até **24 se cursando ensino superior/técnico**. O checklist valida CPF e atribuição de filer, mas **nunca confere a idade do dependente** contra a relação (`filho`/`enteado`) nem exige flag "estudante" entre 21–24. Um dependente fora da regra mantém a dedução de R$ 2.275,08 indevidamente, gerando malha.
**Onde mora:** `services/ir/checklist.ts:151-186` (loop de dependentes só checa CPF/filer/birth_date, sem regra de idade), `components/ir/dependents-manager.tsx:16` (RELATIONSHIPS sem campo "estudante" / `is_student`).

### 7. Obrigatoriedade de declarar por múltiplas fontes / IRRF de mais de um empregador
**Por que importa:** Quem teve **2+ fontes pagadoras simultâneas** com retenção de IRRF quase sempre cai no ajuste com imposto a pagar (cada fonte aplica a tabela isoladamente, subtributando o agregado). Além disso, há gatilhos de **obrigatoriedade** de declarar (rendimentos tributáveis > limite, isentos > R$ 200k, posse de bens > R$ 800k, renda variável com vendas, etc.). O checklist não calcula nenhum desses gatilhos nem alerta o caso multi-fonte — só verifica integridade de dados.
**Onde mora:** `services/ir/checklist.ts` (sem regra de obrigatoriedade nem detecção de múltiplas `fontes_pagadoras` com IRRF no ano); seria o lugar natural para um novo check ao lado de `cbe_obligation`.

### 8. DARF de ganho de capital (código 4600) e GCAP não emitidos
**Por que importa:** Venda de imóvel/bem com lucro gera **DARF código 4600** com vencimento no mês seguinte (e exige apuração via GCAP). O app calcula ganho de capital de imóveis/bens (auditado), mas — diferente da renda variável, que emite DARF 6015 com vencimento — **não há geração de DARF 4600 nem prazo** para o ganho de capital. O usuário sabe o imposto mas não tem o documento/prazo de recolhimento, arriscando multa.
**Onde mora:** `services/ir/property-sale.ts` / `property-sale.actions.ts` (calculam ganho mas não emitem DARF 4600 com `dueDate`, ao contrário de `renda-variavel.ts` que tem `taxDue`+`dueDate`). Nenhuma menção a `4600` ou `GCAP` no código.

### 9. Distribuição de lucros acima do limite presumido (MEI/Simples) — só aviso, sem cálculo
**Por que importa:** A isenção de distribuição de lucros para empresa do **Simples/MEI sem contabilidade** é limitada ao **lucro presumido** (8%/16%/32% da receita conforme atividade, menos tributos); o excedente é **tributável**. O motor classifica 100% como isento (cód. 09) e só emite um aviso genérico "confira". Não há o cálculo do teto presumido nem split isento/tributável — pode isentar valor que deveria ser tributado.
**Onde mora:** `services/ir/classify-income.ts:53-66` (retorna `isento` integral + warning `distribuicao_verificar_limite`, sem aplicar o limite do lucro presumido).

---

**Nota de contexto:** As seguintes áreas citadas no prompt **já estão cobertas** e não são lacunas — meação/condomínio (`services/ir/bens.ts` via `ownership_split`, `is_particular`, comunhão parcial), doações ECA limite 6% (`tax-math.ts:106-107` + checklist), PGBL limite 12% (`tax-math.ts:91-92`), redutor 2026 Lei 15.270/25 (`tax-math.ts:68-79`), tabela 2026 (no banco `ir_tax_table_annual`), e pensão **paga** pelo pagador (cód. 30).

---

## 8. Renda variável (re-auditoria dedicada)

A dimensão de renda variável caiu na verificação da varredura principal (1 subagente não respondeu) e foi re-auditada num passe próprio: **8 achados confirmados, 1 refutado**. As alíquotas básicas conferem (swing 15%, day-trade 20%, FII 20%, isenção de R$ 20k restrita a ações comuns à vista) e o custo médio ponderado está correto. Divergências:

### RV-01 — IRRF day-trade (1%) calculado sobre lucro líquido mensal em vez do somatório dos resultados positivos por dia
- **Severidade:** medium · **Status:** confirmed · **Confiança:** medium
- **Arquivo:linha:** `services/ir/renda-variavel.ts:352-353`
- **Base legal:** Lei 11.033/2004 art. 2º, §1º (IRRF 1% day-trade) e IN RFB 1.585/2015 art. 65, §1º, II e art. 63 — a retenção de 1% é por operação/dia com resultado positivo; compensação do IRRF retido contra o devido (art. 65, §6º).
- **Esperado vs atual:** Esperado: o IRRF-fonte de day-trade (1%) incide, na fonte, sobre o resultado POSITIVO de cada dia/operação (base da retenção real informada pela corretora), e o total compensável no mês é a soma dessas retenções. O código faz `irrfRetained = grossProfit * 0.01` usando o LUCRO LÍQUIDO MENSAL agregado (já compensado por dias negativos do mesmo mês). Em meses com dias mistos (ganhos e perdas), o IRRF efetivamente retido pela corretora é MAIOR que 1% do lucro líquido mensal, então o código subestima o IRRF compensável e superestima o DARF a pagar. Além disso, se grossProfit mensal for negativo o ramo nem roda (vai pro carryforward), mas ainda assim houve retenção real naquele(s) dia(s) positivo(s) que se perde.
- **Impacto:** DARF de day-trade materialmente errado (geralmente a pagar maior que o devido) sempre que houver dias ganhadores e perdedores no mesmo mês. Comum em day-trader ativo.
- **Razão do verificador:** CODE CHECK (confirmed): In services/ir/renda-variavel.ts, buildMonths() buckets all day-trade sales into a single MONTHLY list (salesByKind[kind].get(month), line 289) and computes grossProfit as the sum of every sale.profit for the whole month (line 291) — i.e. the monthly NET, where losing days reduce winning days. Lines 352-353 then set irrfRetained = grossProfit * DAY_TRADE_IRRF_RATE (0.01) on that monthly net. Additionally, when monthly grossProfit <= 0 the code takes the loss/carryforward branch (line 328) and irrfRetained stays 0. So the finding's description is accurate: the 1% is applied to the aggregated monthly net rather than to the sum of each day's positive day-trade result, and any real retention on winning days inside a net-loss month is dropped to zero. The same pattern is mirrored in sale-simulator.ts (line 185, profit * DAY_TRADE_IRRF). The schema (investment_movements, 20260522060000) has date and is_day_trade but stores NO broker-reported actual IRRF field — yet the SaleResult objects do carry per-day `date`, so per-day grouping is feasible from available data and is not done.

LEGAL CHECK (confirmed, with minor framing): Day-trade IRRF of 1% is correct (Lei 11.033/2004 art. 2º §1º; IN RFB 1.585/2015 art. 65 §1º II / §4º). The retention is performed by the intermediary per day on the positive day-trade result, and day-trade apuração is per-day. Therefore the true monthly compensable IRRF = Σ(1% x positive-day result), which is >= 1% x monthly-net whenever a month mixes winning and losing days. Excess IRRF retained is compensable/carriable per art. 65 §6º. The legal mechanics in the finding hold.

MATERIALITY: Real divergence, not interpretation. irrfRetained directly reduces taxDue (line 357), is persisted to ir_darfs.irrf_retained, and is exported to the Receita DEC (dec-export.ts line 180), so the error propagates to the actual declaration and DARF. However impact is bounded: it only diverges in months with mixed winning/losing day-trade days (all-positive or single-result months are identical), the 1% is a small informational retention, and the absolute delta equals 1% of the netted-out losing-day amounts. The most consequential case is the net-loss month dropping a genuinely recoverable IRRF credit to zero.

VERDICT: confirmed. Severity adjusted from high to medium — genuine, legally grounded methodology bug, but small financial magnitude confined to mixed-result months.

### RV-02 — FII e opções em day-trade roteados pela modalidade errada — quebra a segregação de compensação de prejuízos
- **Severidade:** medium · **Status:** confirmed · **Confiança:** high
- **Arquivo:linha:** `services/ir/renda-variavel.ts:269-273`
- **Base legal:** IN RFB 1.585/2015 art. 57 (segregação swing×day-trade), art. 65 (day-trade 20% + IRRF 1%) e art. 47 (opções no mercado de bolsa). A modalidade day-trade prevalece sobre o ativo para fins de alíquota e segregação.
- **Esperado vs atual:** Esperado: day-trade é uma MODALIDADE de apuração própria (alíquota 20%, IRRF 1%, prejuízo compensável só com day-trade), independente do ativo. Day-trade de cotas de FII e day-trade de opções devem ser apurados como day-trade, com sua própria segregação. O código decide o kind nesta ordem: option→'options', fii→'fii', is_day_trade→'day_trade', senão 'swing'. Logo um day-trade de FII vira kind 'fii' (20% sem isenção — alíquota até bate por coincidência, mas o IRRF aplicado vira 0,005% sobre vendas em vez de 1% sobre lucro, e o prejuízo vai pro pote 'fii' swing) e um day-trade de opção vira kind 'options' (15% em vez de 20%!). Opção em day-trade tributada a 15% em vez de 20% é imposto a MENOR.
- **Impacto:** Day-trade de opções tributado a 15% (deveria 20%) → imposto a menor. Day-trade de FII com IRRF errado e prejuízo na cesta errada. Compensação de prejuízo cruzando indevidamente modalidades.
- **Razão do verificador:** The code at services/ir/renda-variavel.ts:269-273 decides kind in the order option→fii→is_day_trade→swing, so asset type takes precedence over the day-trade modality, exactly as the finding states. The same bug is duplicated at services/ir/sale-simulator.ts:141-143.

Legal base verified (IN RFB 1.585/2015 + multiple authoritative sources): (a) options in day-trade are taxed at 20%, not 15% — the code applies OPTIONS_RATE=0.15 (line 93), an unambiguous imposto a menor of 5 percentage points; (b) day-trade IRRF is 1% on the net gain regardless of asset (art. 65), but a day-traded FII hits the swing fallback at line 356 (grossSales*0.005%) instead; (c) segregation is by modality (art. 57) — day-trade losses offset only day-trade gains, but here a day-traded FII/option loss lands in the fii/options (swing) carryforward pool (carry[kind] at lines 326/331), where it can wrongly offset swing gains.

The path is reachable: the DB function refresh_day_trade_flags (migration 20260524070000_ir_complete.sql:389-402) flags ANY investment as is_day_trade=true on a same-day buy+sell with no asset-type restriction, so day-traded FIIs and options do reach this code. No tests pin the current behavior, so it is not an intentional design choice.

Severity adjusted high→medium: the FII day-trade sub-case yields the correct final rate (20%) by coincidence (FII_RATE==DAY_TRADE_RATE), so its only errors are the IRRF credit basis and loss-segregation pool, not the headline tax amount; the options day-trade sub-case is a genuine under-collection but depends on the less-common scenario of day-trading options. Real correctness + segregation bug with narrower blast radius than mainline calculations. Fix in both files: test is_day_trade first, routing to day_trade regardless of asset type, then fall through to option/fii/swing.

### RV-03 — ETF de renda fixa tratado como bolsa (15%/20%) em vez do regime regressivo 15–22,5% por prazo
- **Severidade:** high · **Status:** confirmed · **Confiança:** high
- **Arquivo:linha:** `services/ir/renda-variavel.ts:195, 269-273`
- **Base legal:** Lei 13.043/2014 art. 2º (ETFs de Renda Fixa, alíquotas regressivas por prazo médio); IN RFB 1.585/2015 arts. 32-A e seguintes. ≠ regime de ações da Lei 11.033/2004.
- **Esperado vs atual:** Esperado: ETF de Renda Fixa (ex.: IMAB11, FIXA11, IRFM11, B5P211) tem regime tributário próprio — alíquotas regressivas conforme prazo médio de repactuação da carteira (15% a 25%, na prática 15%/20% por faixa de prazo médio acima/abaixo de 720 dias após a Lei 13.043/2014; tributação na fonte, NÃO segue o regime de bolsa de ações). O código inclui todo `asset_type === 'etf'` na renda variável de bolsa e, por não ser 'stock', cai em kind 'swing' (15%) ou 'day_trade' (20%), tratando como ETF de ações. Não há subtipo no enum AssetType (types/database.ts:30-39) que distinga ETF de ações de ETF de renda fixa, então é impossível classificar corretamente.
- **Impacto:** Imposto de ETF-RF calculado pelo regime de ações (potencialmente alíquota e base errados; ETF-RF não tem isenção de R$20k mas também não é 15% bolsa fixa). Materialmente errado para quem detém ETF de renda fixa.
- **Razão do verificador:** Code behavior confirmed at services/ir/renda-variavel.ts. Line 195 includes asset_type 'etf' in the renda variável (bolsa) filter. Lines 269-273 classify by kind: option→options, fii→fii, is_day_trade→day_trade, else→swing. There is NO branch for ETF de Renda Fixa, so any non-day-trade ETF is taxed as swing 15% (self-assessed via DARF 6015, lines 337-347) and a day-traded ETF as 20%. The R$20k exemption is correctly withheld from ETFs (line 316 requires allStocks), but the rate/mechanism remain those of the bolsa regime.

Enum confirmed at types/database.ts:30-39: AssetType has a single 'etf' value (plus separate fixed_income_public/fixed_income_private for títulos/CDB, not ETFs). There is no subtype to distinguish ETF de ações from ETF de renda fixa, so correct classification is structurally impossible — the finding is right on this.

Legal base verified and correct: Lei 13.043/2014 art. 2º created a dedicated regime for Fundos de Índice de Renda Fixa (ETFs de RF), with regressive rates by the portfolio's prazo médio de repactuação, withheld AT SOURCE — >720 dias: 15%; 181–720: 20%; ≤180: 25% — regulated by IN RFB 1.585/2015 arts. 32 a 32-B. This is distinct from the ações/bolsa regime (Lei 11.033/2004 art. 21: 15% swing / 20% day trade, R$20k exemption, DARF 6015). Cited examples (IMAB11, IRFM11, B5P211, FIXA11) are real ETFs de RF under this regime.

Minor imprecision in the finding's wording: it parenthetically says "15% a 25%, na prática 15%/20%" — the real brackets are three (15/20/25%), and the regime also has no day-trade split, no R$20k exemption, and is collected na fonte (not DARF) with no loss carryforward against ações. These nuances reinforce, not weaken, the core thesis: ETF de RF has its own regime and the code wrongly applies the bolsa regime.

Materiality: real and material. For an ETF de RF holder the code misstates the rate (could be 20%/25%, not 15%), the collection mechanism (self-assessed DARF vs. retenção na fonte), and pools its losses with the swing/ações carryforward bucket — all incorrect. Confirmed.

Severity kept at high (not escalated to critical): the defect requires the user to actually hold an ETF de RF, and ETF de ações — handled correctly under the same bolsa regime — is the more common case; but ETFs de RF are widely held and the error affects rate, mechanism, and loss compensation, so high is appropriate.

### RV-04 — Vencimento do DARF 6015 ignora feriados nacionais/bancários (só recua sábado/domingo)
- **Severidade:** low · **Status:** confirmed · **Confiança:** high
- **Arquivo:linha:** `services/ir/renda-variavel.ts:102-113`
- **Base legal:** IN RFB 1.585/2015 art. 56, §1º c/c art. 70 (recolhimento até o último dia útil do mês subsequente); Lei 9.430/1996 art. 61 (multa/juros por atraso). 'Dia útil' para a RFB exclui feriados.
- **Esperado vs atual:** Esperado: o vencimento é o ÚLTIMO DIA ÚTIL do mês seguinte, e 'dia útil' exclui feriados nacionais (e, para fins bancários, recai no dia útil anterior). A função lastBusinessDayOfNextMonth só recua em sábado/domingo (getUTCDay 0/6); não há tabela de feriados. Ex.: apuração de dez/2025 vence 31/01/2026 — se cair em data não-útil por feriado, o código pode retornar uma data em que não há expediente bancário, levando o usuário a pagar com atraso (multa de mora 0,33%/dia + juros Selic). O próprio comentário admite a limitação ('Sem feriados nacionais aqui').
- **Impacto:** Data de vencimento exibida pode cair em feriado, induzindo atraso e multa. Severidade média (afeta data, não o valor do imposto principal).
- **Razão do verificador:** CODE (confirmed): services/ir/renda-variavel.ts:102-113 — lastBusinessDayOfNextMonth recua apenas em sábado/domingo (getUTCDay 0/6); não há tabela de feriados. O comentário admite 'Sem feriados nacionais aqui'. Agravante: o próprio repo já possui um utilitário holiday-aware completo (lib/financial/business-days.ts: isBusinessDay com feriados fixos + móveis via Páscoa) que este módulo NÃO usa. O mesmo bug está copiado em 5 lugares (renda-variavel, carne-leao, sale-simulator, gcap-calculator, irpf-monthly-table).

BASE LEGAL (correta no essencial): DARF 6015 (renda variável PF) vence no último dia útil do mês subsequente à apuração (IN RFB 1.585/2015); 'dia útil' para recolhimento federal exclui feriados nacionais; atraso gera multa de mora 0,33%/dia + juros Selic (Lei 9.430/96 art. 61). Citação de artigos OK no mérito.

DIVERGÊNCIA REAL E MATERIAL: simulei a função buggy vs. uma versão com feriados sobre 2020-2035 → 6 meses divergem. Caso concreto verificado: competência fev/2024 → o código retorna 2024-03-29, que é Sexta-feira Santa (feriado nacional, impossível pagar); correto = 2024-03-28. Também jan/2022 → 2022-02-28 (Carnaval) em vez de 25/02. É defeito real, não interpretação: a data devolvida pode cair em dia sem expediente bancário, induzindo pagamento em atraso.

REFUTAÇÕES PARCIAIS (rebaixam severidade): (1) O EXEMPLO-TÍTULO do achado está ERRADO: dez/2025 NÃO vence 31/01/2026 — o código retorna 2026-01-30 (sexta), pois 31/01 é sábado e a lógica de fim de semana já recua corretamente; logo esse exemplo é inofensivo. (2) Frequência baixa (~3% dos meses). (3) Carnaval é ponto facultativo, não feriado estrito (embora bancos/RFB tratem como não-útil). (4) É erro de RÓTULO de data, não de cálculo: todos os valores de imposto/base/IRRF estão corretos; só a string dueDate fica deslocada em 1 dia em meses específicos, e o usuário pode antecipar manualmente.

VEREDITO: bug genuíno e legítimo de corrigir (idealmente reusando isBusinessDay já existente), mas de impacto limitado — rótulo de data, math correta, workaround manual, poucos meses afetados — e com exemplo-título factualmente incorreto. Confirmado, severidade rebaixada para low.

### RV-05 — BDR e ouro-ativo financeiro inexistentes no enum/roteamento — risco de cair indevidamente na isenção de R$20k se cadastrados como 'stock'
- **Severidade:** medium · **Status:** confirmed · **Confiança:** medium
- **Arquivo:linha:** `services/ir/renda-variavel.ts:195, 314-320`
- **Base legal:** IN RFB 1.585/2015 art. 59, §1º (isenção de R$20k restrita a ações negociadas no mercado à vista de bolsa); ADI/Solução de Consulta RFB excluindo BDR, ETF e ouro da isenção.
- **Esperado vs atual:** Esperado: ganho com BDR e com ouro-ativo financeiro NÃO goza da isenção de R$20.000/mês (que é exclusiva de ações no mercado à vista). BDR/ETF de ações também não. O código concede isenção quando `sales.every(s => s.assetType === 'stock')`. Como o enum AssetType não tem 'bdr' nem 'gold' (types/database.ts:30-39), um usuário tende a cadastrar BDR como 'stock' (ticker tipo AAPL34/ROXO34), e aí o código aplicaria a isenção de R$20k indevidamente. Não há salvaguarda por ticker (sufixos 34/35/39 de BDR) nem campo dedicado.
- **Impacto:** Se BDR cadastrado como 'stock', isenção de R$20k aplicada indevidamente → imposto a menor (15% sobre o ganho não recolhido). Depende do cadastro do usuário, por isso medium/medium.
- **Razão do verificador:** CONFIRMADO em parte (o eixo BDR), com uma correção importante: a parte sobre OURO está REFUTADA.

CÓDIGO (verificado direto em services/ir/renda-variavel.ts):
- Linha 195: o motor só processa asset_type em ["stock","etf","fii","option"]. Um BDR cadastrado como 'stock' ENTRA no fluxo.
- Linhas 314-320: a isenção R$20k é concedida exatamente quando `kind==="swing"` e `sales.every(s => s.assetType === "stock")` e grossSales ≤ 20000. Não há salvaguarda por sufixo de ticker (34/35/39) nem campo dedicado. O ETF já é corretamente excluído (porque assetType seria 'etf', não 'stock').
- types/database.ts:30-39: AssetType NÃO tem 'bdr' nem 'gold'. Confirmado.
- O dropdown da UI (components/investments/investment-sheet.tsx:33-42) oferece apenas FII/ETF/Ação/Cripto/PGBL/VGBL/Renda fixa — sem BDR. Logo um holder de BDR (AAPL34, ROXO34) plausivelmente escolhe "Ação" (stock). grep em todo o código não achou nenhum tratamento de "bdr".

BASE LEGAL (verificada): A isenção de R$20k/mês (IN RFB 1.585/2015, art. 59) é restrita a ações no mercado à vista de bolsa. BDR NÃO goza dessa isenção — todo ganho é tributado a 15% (swing)/20% (day trade), DARF 6015. Confirmado por B3, InfoMoney, XP, Empiricus, Suno. Portanto, BDR-como-stock com vendas ≤ R$20k/mês e lucro seria INDEVIDAMENTE isentado → subrecolhimento de imposto (direção pior, gera autuação). Esse eixo é uma divergência REAL.

REFUTAÇÃO PARCIAL — OURO: O achado afirma que "ganho com ouro-ativo financeiro NÃO goza da isenção de R$20.000/mês". Isso está ERRADO. A própria página da Receita Federal e a IN 1.585/2015 (art. 59) dizem o oposto: "Os ganhos líquidos em operações efetuadas com ações E COM OURO (ativo financeiro)" são isentos até R$20k/mês, com limites de R$20k aplicados separadamente a cada espécie. Ou seja, ouro-ativo financeiro é justamente UMA das duas classes que TÊM a isenção. Além disso, ouro nem é um caminho de código alcançável: não existe asset_type para ouro no fluxo de renda variável (o "Ouro / ativo financeiro" código 46 em services/ir/codes.ts é só para a ficha de Bens, não para o motor de trading). Logo a parte "ouro" do achado é duplamente improcedente (legalmente incorreta e código inexistente).

NUANCE DE MATERIALIDADE: O app NÃO auto-classifica BDR como stock — a heurística inferFromTicker (lib/financial/asset-catalog.ts:212, regex /^[A-Z]{4}[34568]$/) exige sufixo de 1 dígito, então AAPL34/ROXO34 (sufixo de 2 dígitos) caem em `return null` e pedem classificação manual. O risco depende de o usuário escolher manualmente "Ação". O impacto só ocorre abaixo de R$20k/mês de vendas E com lucro, e BDR é holding relativamente nichado. 

CONCLUSÃO: divergência REAL e material no eixo BDR (subrecolhimento), severidade medium mantida — o risco BDR sozinho a justifica. A premissa do achado é parcialmente imprecisa (cita §1º como base direta do BDR quando a exclusão decorre da restrição de "ações no mercado à vista" do art. 59 combinada com o art. 56; e erra ao incluir ouro). Como o núcleo do achado (BDR cai indevidamente na isenção por falta de enum/roteamento e salvaguarda por ticker) é verdadeiro e tem impacto fiscal real, marco como confirmed/medium, registrando que a metade "ouro" deve ser descartada.

Arquivos relevantes:
- /Users/marcelocaliman/Projects/financas/services/ir/renda-variavel.ts:195 e 314-320
- /Users/marcelocaliman/Projects/financas/types/database.ts:30-39
- /Users/marcelocaliman/Projects/financas/components/investments/investment-sheet.tsx:33-42 (dropdown sem BDR)
- /Users/marcelocaliman/Projects/financas/lib/financial/asset-catalog.ts:190-221 (heurística não auto-classifica BDR como stock)
- /Users/marcelocaliman/Projects/financas/services/ir/codes.ts:67 (código 46 Ouro é só para Bens, não para o motor de renda variável)

### RV-06 — Lucro mensal exatamente zero é classificado como prejuízo (grossProfit <= 0) — inofensivo, mas borda lógica
- **Severidade:** low · **Status:** confirmed · **Confiança:** high
- **Arquivo:linha:** `services/ir/renda-variavel.ts:328-331`
- **Base legal:** IN RFB 1.585/2015 art. 64 (apuração de resultado mensal). N/A material.
- **Esperado vs atual:** Esperado: resultado mensal = 0 não gera imposto nem prejuízo a compensar. O código usa `grossProfit <= 0` para o ramo de prejuízo, então com grossProfit === 0 ele computa monthlyLoss = -0 = 0 e soma 0 ao carryforward — efeito numérico nulo, mas a classificação semântica (registra como mês de prejuízo) é imprecisa. Sem impacto material no imposto.
- **Impacto:** Nenhum impacto no imposto; apenas semântica de relatório. Listado por completude.
- **Razão do verificador:** Code check (renda-variavel.ts:328-331): CONFIRMED. The branch is `else if (grossProfit <= 0)` (line 328), labeled "Prejuízo: vai pro carryforward". When grossProfit === 0 and the month is not exempt, control enters this loss branch, computing `monthlyLoss = -grossProfit` (= -0, which rounds/serializes to 0 at line 364) and `carry[kind] += monthlyLoss` (+= 0). So the description is mechanically accurate: a zero-profit month is routed through the loss code path.

Legal base check: CORRECT. IN RFB 1.585/2015 governs IRPF on renda variável and a monthly net result of exactly zero generates neither tax nor a loss to carry forward. The finding correctly states this and correctly labels it non-material ("N/A material").

Materiality: NOT material — and the finding itself says so. The numeric effect is strictly null: carry[kind] += 0 (no change), taxDue = 0, taxableBase = 0, and the output `monthlyLoss` field equals 0 — identical to what a neutral classification would yield. There is no output-visible flag (e.g., isLossMonth) that distinguishes a zero-profit month routed through the loss branch from a neutral month, so NO downstream value (DARF, carryforward, annual aggregates at lines 384-398) differs. The "imprecise semantic classification" is purely internal control-flow with zero observable consequence.

Verdict: confirmed because the code behaves exactly as described AND the description correctly characterizes it as harmless/non-material. This is a cosmetic edge-case observation, not a tax-correctness defect. Severity stays low (arguably info, since there is literally no output-visible effect); I keep it at low as the finding self-rated.

### RV-07 — R73 do DEC omite a modalidade 'options' — opções somem da exportação para o contador
- **Severidade:** medium · **Status:** confirmed · **Confiança:** high
- **Arquivo:linha:** `services/ir/dec-export.ts:168-185, 323-347`
- **Base legal:** IN RFB 1.585/2015 art. 47 (mercado de opções compõe a apuração de renda variável a declarar). Consistência de exportação.
- **Esperado vs atual:** Esperado: a apuração de opções (rv.options) deveria constar tanto no registro R73 quanto no humanReadable de renda variável. Em dec-export.ts o array allMonths para R73 é `[...rv.swing, ...rv.dayTrade, ...rv.fii]` (linha 168) e o humanReadable itera apenas `['swing','day_trade','fii']` (linha 323) — rv.options nunca é exportado. Logo todo imposto/lucro de opções calculado em renda-variavel.ts é silenciosamente descartado na exportação, subdeclarando renda variável.
- **Impacto:** Operações com opções não aparecem no relatório entregue ao contador/usuário → omissão de renda variável tributável na declaração.
- **Razão do verificador:** Verified against services/ir/dec-export.ts and services/ir/renda-variavel.ts. All three premises hold.

(1) The code does exactly what's claimed. dec-export.ts:168 builds the R73 source as `[...rv.swing, ...rv.dayTrade, ...rv.fii]` — no `...rv.options`. The humanReadable section iterates `["swing","day_trade","fii"] as const` (line 323), and the carryforward block (lines 342-347) omits options too. So options never reach either export channel.

(2) `rv.options` is a real, fully-computed modality, not dead/empty data. RendaVariavelReport.options is typed (renda-variavel.ts:74); the engine runs buildMonths("options") (line 381) with its own OPTIONS_RATE=0.15 (line 93), dedicated IRRF logic (line 355), and carryforward (line 399). Options are part of `totals` (line 383), are persisted to ir_darfs and to ir_loss_carryforward in persistDarfs (lines 421, 452), and are surfaced in the UI (page.tsx:391 renders finalCarryforward.options; renda-variavel-table.tsx:18 renders a dedicated "Opções" section). The export is the only place options are dropped — a genuine inconsistency, not a design choice.

(3) Legal base is sound in substance. IN RFB 1.585/2015 governs IR on financial/capital markets and explicitly covers the mercado de opções as part of renda variável apuração (15% swing / 20% day trade), matching the engine. Options gains/tax/loss-carryforward are therefore declarable components that should appear in the accountant-facing export.

Material impact: the file's own header (lines 9-31) states the .DEC is not importable into the official IRPF program and that the humanReadable TXT is the path that "SEMPRE funciona" and is what accountants receive (app/api/ir/export/route.ts, export-wizard.tsx:112, export-actions.tsx:49). Since the humanReadable also omits options (line 323), an investor with options profit/tax sees it in the UI and has DARFs in the DB, but the export to the accountant silently drops the entire modality — leading to under-declared renda variável (omitted profit, tax due, and options loss carryforward).

Severity: medium is correct and justified. It's a silent, real tax/consistency defect with under-declaration consequences, but scoped to a single, less-common modality, it doesn't corrupt other modalities' numbers, and the primary .DEC channel is non-functional by design anyway. Not high (limited blast radius), not low (genuine compliance/financial impact for options traders).

### RV-08 — Day-trade negativo no mês perde o IRRF de 1% efetivamente retido (não vira crédito compensável)
- **Severidade:** low · **Status:** confirmed · **Confiança:** medium
- **Arquivo:linha:** `services/ir/renda-variavel.ts:328-358`
- **Base legal:** IN RFB 1.585/2015 art. 65, §6º e art. 53 (IRRF retido compensável com o devido nos meses subsequentes/anuais, ainda que o mês seja deficitário).
- **Esperado vs atual:** Esperado: o IRRF de 1% retido em dias positivos de day-trade é compensável mesmo que o RESULTADO MENSAL seja prejuízo — vira IR-fonte a compensar em meses seguintes do mesmo ano ou declarável. No código, quando grossProfit mensal <= 0 (ramo do prejuízo, linha 328), irrfRetained permanece 0 e nenhum IRRF é registrado/acumulado, descartando a retenção real dos dias ganhadores. O irrfRetained só é calculado no ramo de lucro (linha 349). Não há acumulação de IRRF-fonte a compensar.
- **Impacto:** Perda de crédito de IRRF retido em meses de day-trade deficitários → imposto futuro maior que o devido.
- **Razão do verificador:** CODE BEHAVIOR CONFIRMED. In /Users/marcelocaliman/Projects/financas/services/ir/renda-variavel.ts:328-358, the day-trade loss branch (grossProfit <= 0, line 328-331) only adds monthlyLoss to carryforward and leaves irrfRetained = 0. IRRF is computed exclusively in the profit branch (line 349-353: grossProfit * DAY_TRADE_IRRF_RATE = 1%). There is no accumulation of retained IRRF as a compensable credit; totalIRRF (line 387) merely sums profit-month IRRF and is informational, never offsetting taxDue across months. So in a month that ends in net day-trade loss but contained winning days, the 1% IRRF that brokers really retained on those days is silently dropped instead of becoming IR-fonte a compensar.

LEGAL BASIS MOSTLY CORRECT. IN RFB 1.585/2015 art. 65 §6º is the right anchor: day-trade IRRF may be (I) deducted from the monthly day-trade tax due, (II) carried to deduct in subsequent months of the same year, or (III) compensated in the annual return — i.e. it is NOT forfeited just because the month is deficitário. The 1% is retained on the daily positive net result (art. 65 §1º) regardless of the monthly outcome. The 'art. 53' part of the citation is mis-applied — art. 53 governs the general/swing 0,005% IRRF, not day-trade; the controlling rule is art. 65 §§1º/6º. So the legal direction is sound even though one cited article is wrong.

REAL BUT BOUNDED DIVERGENCE → SEVERITY LOWERED TO LOW. The gap is genuine and legally grounded: the engine loses a legitimate compensable IRRF credit and consequently over-states future taxDue. However materiality is limited: (1) the engine already models day-trade IRRF as monthly grossProfit * 1%, NOT the legally-correct per-settlement-day positive result — it has no per-day data, so in a loss month the 'missing' credit (sum of winning-day results * 1%) is not even computable with the current data model; a correct fix requires per-day modeling that does not exist here. (2) The day-trade 1% is the deliberately tiny 'dedo-duro' withholding (a cross-check/reporting mechanism), so the lost credit is usually small, becoming non-trivial only on very high-volume day-trade months. Given the bounded financial impact and that the whole IRRF computation is already an approximation, this is a real defect but closer to low than medium.


---

## 9. Status das correções (pós-auditoria)

Todos os **bugs confirmados** (que produziam número de imposto errado) foram
corrigidos com teste — ver o histórico de commits `fix(ir): …`:

| # | Correção | Severidade origem |
|---|----------|---|
| 1 | FR1/FR2 + redução Lei 7.713/88 do ganho de capital de imóveis | critical |
| 2 | Renda variável: day-trade de opção 20%, roteamento por modalidade, IRRF por dia | high/medium |
| 3 | Vencimento de DARF recua feriados (carnê-leão, mensal, GCAP, renda variável) | medium |
| 4 | Export .DEC: CNPJ, R73 opções/sinal, R72 IRRF, R99, dívidas, gate D8 do contador | high/medium |
| 5 | Grupos de Bens do leiaute 2024+ (03/04/05/07/99) + labels 10/11 | high/medium |
| 6 | Redutor anual Lei 15.270/25 como valor fixo em reais (não fração do imposto) | high |
| 7 | Comparador separado inclui carnê-leão por filer | high |
| 8 | 13º e JCP exclusivos; dividendos com aviso 2026; isenção 65+ por mês | high/medium |
| 9 | Câmbio de ativos no exterior (cron→BRL) + cripto por data da operação | high/medium |
| — | Multa/juros de mora de DARF (`computeLateFee`) | medium (M3) |

⚠️ Marcados no código como **CONFERIR com contador/MIR** (fonte secundária): os
coeficientes do redutor anual (8.429,73 / 0,095575) e os números de grupo de
Bens (poupança 04 vs 06, ETF 04 vs 07, PGBL→Pagamentos).

### 9.1 Gaps de FEATURE pendentes (precisam de migration + UI — não são bugs)

Estes itens da auditoria/crítico de cobertura **não são cálculos errados** — são
recursos ausentes. Ficam como roadmap priorizado:

| Prioridade | Item | O que falta | Origem |
|---|---|---|---|
| Alta | **JCP em investimentos** | enum `investment_movements.kind` ganhar `jcp` + UI + roteamento pra exclusivo cód.10 (o caminho de categoria manual já trata) | M1 / crítico #3 |
| Alta | **Composição de custo de imóvel** | colunas pra benfeitorias/ITBI/corretagem de compra e despesas de venda + UI; hoje custo é número único | M6 |
| Alta | **Trava de 5 anos + natureza residencial** na reaplicação 180d | checar `physical_asset_sales` (última isenção <5 anos) e exigir residencial | M5/M7/M19 |
| Média | **ETF de renda fixa / BDR / ouro** | subtipo no schema de `investments` pra separar do ETF de ações (regime distinto) | RV-03/RV-05 |
| Média | **RRA** (rendimentos recebidos acumuladamente) | campo nº de meses + regime próprio (tabela /N ou exclusivo) | crítico #2 |
| Média | **Dependente 21–24 estudante** | flag `is_student` + validação de idade no checklist | crítico #6 |
| Média | **Obrigatoriedade de declarar / multi-fonte** | checks no checklist (limites de renda/bens, 2+ fontes com IRRF) | crítico #7 |
| Média | **DARF 4600 de ganho de capital** | gerar DARF + prazo pra venda de bens (hoje só renda variável tem) | crítico #8 |
| Baixa | **VGBL na ficha de pagamentos** | bloquear VGBL como dedutível (não deduz) | crítico #5 |
| Baixa | **Pensão alimentícia recebida** | bucket próprio (tributável carnê-leão) separado de aposentadoria | crítico #4 |
| Baixa | **Distribuição de lucros > presumido** | cálculo do teto presumido (MEI/Simples) + split isento/tributável | crítico #9 |
| Baixa | **Multa/juros na UI** | `computeLateFee` existe (puro+testado); falta exibir no carnê-leão em atraso + série SELIC | M3 |

Wire-up de cada um exige migration aplicada + UI + teste — fora do escopo das
correções de bug desta rodada.
