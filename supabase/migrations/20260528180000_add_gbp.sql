-- ============================================================================
-- Finanças — Adiciona GBP (Libra Esterlina) ao sistema de moedas
--
-- Estratégia: dropa todos os CHECK constraints de currency e recria com
-- o conjunto expandido. Sem necessidade de migração de dados (apenas amplia).
-- ============================================================================

set search_path = public;

-- Tabelas com coluna "currency"
alter table accounts drop constraint accounts_currency_check;
alter table accounts add constraint accounts_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table transactions drop constraint transactions_currency_check;
alter table transactions add constraint transactions_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table investments drop constraint investments_currency_check;
alter table investments add constraint investments_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table goals drop constraint goals_currency_check;
alter table goals add constraint goals_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table physical_assets drop constraint physical_assets_currency_check;
alter table physical_assets add constraint physical_assets_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table recurring_rules drop constraint recurring_rules_currency_check;
alter table recurring_rules add constraint recurring_rules_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table category_budgets drop constraint category_budgets_currency_check;
alter table category_budgets add constraint category_budgets_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table ir_deductible_payments drop constraint ir_deductible_payments_currency_check;
alter table ir_deductible_payments add constraint ir_deductible_payments_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table ir_other_incomes drop constraint ir_other_incomes_currency_check;
alter table ir_other_incomes add constraint ir_other_incomes_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table account_snapshots drop constraint account_snapshots_currency_check;
alter table account_snapshots add constraint account_snapshots_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table investment_snapshots drop constraint investment_snapshots_currency_check;
alter table investment_snapshots add constraint investment_snapshots_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

alter table debts drop constraint debts_currency_check;
alter table debts add constraint debts_currency_check check (currency in ('BRL', 'EUR', 'USD', 'GBP'));

-- currency_rates: base + quote
alter table currency_rates drop constraint currency_rates_base_check;
alter table currency_rates add constraint currency_rates_base_check check (base in ('BRL', 'EUR', 'USD', 'GBP'));

alter table currency_rates drop constraint currency_rates_quote_check;
alter table currency_rates add constraint currency_rates_quote_check check (quote in ('BRL', 'EUR', 'USD', 'GBP'));
