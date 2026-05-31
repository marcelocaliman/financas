/**
 * Manifesto único das tabelas de dados pessoais — fonte da verdade consumida
 * tanto pela exportação (LGPD art. 18) quanto pela exclusão. Mantém os dois em
 * sincronia: tabela nova aqui = entra no export E no delete automaticamente.
 *
 * Derivado do schema real (todas as tabelas public com household_id/user_id).
 * Atualizar quando adicionar tabela de dados de usuário (há teste anti-regressão
 * que compara este manifesto com o schema do banco).
 */

/** Tabelas escopadas por household_id. */
export const HOUSEHOLD_DATA_TABLES = [
  "account_snapshots",
  "accountant_audit_log",
  "accountant_documents",
  "accountant_household_access",
  "accountant_invites",
  "accountant_notes",
  "accounts",
  "aport_suggestion_dismissals",
  "carne_leao_mensal",
  "categories",
  "category_budgets",
  "category_rules",
  "debts",
  "document_uploads",
  "fontes_pagadoras",
  "goals",
  "household_invites",
  "investment_movements",
  "investment_snapshots",
  "investment_yields",
  "investments",
  "ir_darfs",
  "ir_deductible_payments",
  "ir_dependents",
  "ir_filers",
  "ir_income_classifications",
  "ir_loss_carryforward",
  "ir_other_incomes",
  "ir_prior_year_balances",
  "ir_settings",
  "ir_year_metadata",
  "ir_year_snapshots",
  "notification_preferences",
  "patrimonio_snapshots",
  "physical_asset_revaluations",
  "physical_asset_sales",
  "physical_assets",
  "recurring_rules",
  "redemption_intents",
  "system_alerts",
  "transactions",
  "users",
  "yield_rules",
] as const;

/** Tabelas escopadas por user_id (do usuário, não do household). */
export const USER_DATA_TABLES = [
  "announcement_dismissals",
  "user_consents",
  "data_access_requests",
] as const;

/**
 * VIEW (não é tabela de dados): document_uploads_current_month_count.
 * NÃO exportar/excluir — é agregação derivada.
 */
export const EXCLUDED_FROM_MANIFEST = [
  "document_uploads_current_month_count",
  "platform_admins", // papel de plataforma, não dado pessoal do titular
] as const;

export type HouseholdDataTable = (typeof HOUSEHOLD_DATA_TABLES)[number];
export type UserDataTable = (typeof USER_DATA_TABLES)[number];
