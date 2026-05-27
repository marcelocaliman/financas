# 🔍 Auditoria do Sistema — 2026-05-27 18:04:09 UTC

## Sumário

- 🔴 **Críticos**: 0
- 🟠 **Maiores**: 2
- 🟡 **Menores**: 9
- ℹ️ **Informativos**: 3

---

## 🟠 Maiores (2)

### [investments] Todos os 6 investimentos têm a MESMA purchase_date (2025-05-26)
> Padrão típico de placeholder. As datas reais são necessárias pra IR (custo médio, ganho de capital) e pra projeção correta.

### [sync] tesouro_quotes: SEM DADOS
> Cron correspondente nunca rodou ou tabela vazia.

## 🟡 Menores (9)

### [investments] TREND INB FIC FIRF SIMPLES: indexer cdi sem multiplier
> Default = 1.0 (100%); valide se é correto.

### [ir-rendimentos] ir_other_incomes vazio pra 2026
> Se você recebeu JCP, dividendos, alugueis, isentos, deveria cadastrar aqui.

### [ir-rendimentos] Tesouro Selic 2027 (vendido) liquidado mas sem lançamento de rendimento exclusivo fonte em ir_other_incomes
> Quando RF vence/é vendida, o broker retém 15% sobre rendimento. Esse valor precisa aparecer em "Rendimentos sujeitos a tributação exclusiva".

### [ir-rendimentos] LFT 210100 2028 (vendido) liquidado mas sem lançamento de rendimento exclusivo fonte em ir_other_incomes
> Quando RF vence/é vendida, o broker retém 15% sobre rendimento. Esse valor precisa aparecer em "Rendimentos sujeitos a tributação exclusiva".

### [ir-rendimentos] Tesouro Prefixado 2032 (vendido) liquidado mas sem lançamento de rendimento exclusivo fonte em ir_other_incomes
> Quando RF vence/é vendida, o broker retém 15% sobre rendimento. Esse valor precisa aparecer em "Rendimentos sujeitos a tributação exclusiva".

### [ir-rendimentos] Tesouro Prefixado 2028 (vendido) liquidado mas sem lançamento de rendimento exclusivo fonte em ir_other_incomes
> Quando RF vence/é vendida, o broker retém 15% sobre rendimento. Esse valor precisa aparecer em "Rendimentos sujeitos a tributação exclusiva".

### [ir-rendimentos] Tesouro IPCA+ 2040 (vendido) liquidado mas sem lançamento de rendimento exclusivo fonte em ir_other_incomes
> Quando RF vence/é vendida, o broker retém 15% sobre rendimento. Esse valor precisa aparecer em "Rendimentos sujeitos a tributação exclusiva".

### [ir-rendimentos] Tesouro IPCA+ 2050 (vendido) liquidado mas sem lançamento de rendimento exclusivo fonte em ir_other_incomes
> Quando RF vence/é vendida, o broker retém 15% sobre rendimento. Esse valor precisa aparecer em "Rendimentos sujeitos a tributação exclusiva".

### [ir-prior-year] 5 investimento(s) com purchase_date <= 31/12/2025 sem saldo registrado em ir_prior_year_balances
> Tesouro Selic 2028, Tesouro Selic 2031, BBAS3, KLBN11, WEGE3. UI esconde a coluna 31/12/2025 por isso, mas se quiser comparação ano-a-ano, cadastre manualmente.

## ℹ️ Informativos (3)

### [ir-tables] Tabela 2026 é estimativa
> Atualizar quando Receita publicar MP/Lei oficial.

### [ir-rendimentos] 8 transações de income em 2026, total R$ 37.184,75

### [ir-rendimentos] 6 ativo(s) liquidados em 2026
> Tesouro Selic 2027 (vendido) em 2026-04-14 por R$ 25.480,00 (IR retido R$ 596,00) · LFT 210100 2028 (vendido) em 2026-04-14 por R$ 268.000,00 (IR retido R$ 2.433,00) · Tesouro Prefixado 2032 (vendido) em 2026-04-14 por R$ 44.226,44 (IR retido R$ 1.044,38) · Tesouro Prefixado 2028 (vendido) em 2026-04-14 por R$ 38.711,64 (IR retido R$ 68,86) · Tesouro IPCA+ 2040 (vendido) em 2026-04-14 por R$ 44.368,02 (IR retido R$ 634,16) · Tesouro IPCA+ 2050 (vendido) em 2026-04-14 por R$ 47.851,97 (IR retido R$ 1.966,90)

