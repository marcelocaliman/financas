# Motor de IRPF — regras e base legal

> **Disclaimer.** O cálculo do IRPF neste app é uma **estimativa** automatizada a
> partir do que você lança. Não substitui o programa oficial da Receita Federal
> nem a orientação de um contador. Antes de transmitir a declaração, **confira os
> valores com seus informes de rendimento** e, em caso de dúvida, consulte um
> profissional. As alíquotas/limites podem mudar; anos sem tabela oficial são
> calculados por estimativa (rollforward) e claramente marcados.

Este documento registra **o que** o motor calcula e **com que base legal**, pra
auditoria e pra revisão tributária externa (decisão D16 do ROADMAP).

## Princípio: fail-loud

O motor **nunca descarta renda em silêncio**. Toda renda cai explicitamente em um
bucket; o que não dá pra classificar com segurança vira `naoClassificado`, fica
**fora** da base de cálculo e dispara um aviso visível. Isso elimina a
subtributação invisível. Ver `services/ir/classify-income.ts`.

## Classificação de rendimentos

| Situação | Bucket | Código | Base legal / observação |
|----------|--------|:------:|-------------------------|
| Salário, pró-labore, honorários, 13º | Tributável (progressivo) | — | RIR/2018; 13º é exclusivo na fonte, fora da base progressiva |
| Aposentadoria/pensão | ver isenções abaixo | 10/11 | Lei 7.713/88 |
| Aluguel/locação recebido (PF) | Tributável (carnê-leão) | — | Carnê-leão; deduz condomínio/IPTU. Aviso pra não duplicar |
| Distribuição de lucros (PJ própria) | Isento | 09 | Isento p/ sócio; **MEI/Simples sem contabilidade: limitado ao lucro presumido** |
| Dividendos de ações/FII (rendimento) | Isento | 09/26 | Isenção vigente até 2025 |
| LCI/LCA/CRI/CRA | Isento | 12 | Lei 11.033/04 e correlatas |
| CDB/Tesouro/RF tributada | Exclusivo na fonte | 06 | Tributação definitiva na fonte |
| Categoria desconhecida | **Não classificado** | — | Fora da base + aviso crítico (fail-loud) |

## Isenções por perfil (aposentadoria/pensão)

Implementadas em `services/ir/exencoes.ts`.

- **Maiores de 65 anos** — parcela mensal isenta de aposentadoria/pensão
  (parametrizada por ano em `ir_tax_table_annual.elderly_monthly_exemption`,
  default **R$ 1.903,98**, valor vigente desde 2015). Isenção anual = parcela
  **× 13** (12 competências + 13º) = **R$ 24.751,74**. O excedente é tributável.
  Base: Lei 7.713/88, art. 6º, XV. Idade aferida em 31/12 do ano-base.
- **Moléstia grave** — proventos de aposentadoria/reforma/pensão **100% isentos**;
  prevalece sobre a isenção por idade. Base: Lei 7.713/88, art. 6º, XIV.
  Auto-declarado (flag por declarante); o contribuinte deve guardar o laudo.
- IRRF retido sobre renda que ficou isenta é tratado como **restituível** (não
  some), com aviso.

## Tabelas progressivas

Vivem em `ir_tax_table_annual` / `ir_tax_table_monthly` (faixas, parcela a
deduzir, limite do simplificado, dedução por dependente, limite de educação,
parcela isenta 65+). Cada ano-base tem sua linha; adicionar ano = INSERT, sem
código. Anos sem linha própria usam **rollforward** da tabela mais próxima,
marcado como estimativa.

## Redutor da Lei 15.270/2025

A partir do ano-calendário 2026: zera o imposto pra renda anual ≤ R$ 60.000 e
decai linearmente até R$ 88.200 (= 12× os limites mensais R$ 5.000 / R$ 7.350).
Implementado em `computeImposto` (`computeRedutorAnual`).

## Modelos Simples vs Completo

`computeImposto` calcula os dois e recomenda o menor imposto. Deduções do
completo: INSS, dependentes, educação (com limite por pessoa), saúde (sem
limite), PGBL (12% da renda), pensão alimentícia, doações (até 6% do imposto).

## Pendência conhecida

A **revisão tributária por profissional habilitado** (decisão D16) é o passo que
fecha o risco jurídico pra uso público. Até lá, trate os valores como estimativa.
