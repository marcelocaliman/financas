-- ============================================================================
-- patrimonio_snapshots.total → base cash (sem subtrair dívida de cartão)
-- ============================================================================
-- Bug (auditoria, contas-saldos#2): o snapshot gravava
--   total = liquid + fixed + variable + physical − credit_card_debt
-- enquanto a manchete do dashboard (portfolioState) e o fallback do histórico
-- NÃO subtraem cartão (modelo cash basis: o dinheiro pra pagar a fatura ainda
-- está no líquido). Isso criava um degrau artificial na sparkline entre meses
-- com snapshot e meses de fallback, e o último ponto não batia com a manchete.
--
-- O cron passou a gravar total sem subtrair cartão. Este backfill alinha os
-- snapshots históricos: total += credit_card_debt (desfaz a subtração antiga).
-- credit_card_debt continua na coluna própria.
-- ============================================================================

update public.patrimonio_snapshots
set total = round((total + coalesce(credit_card_debt, 0))::numeric, 2)
where coalesce(credit_card_debt, 0) > 0;
