-- ============================================================================
-- Performance: envolve funções SECURITY DEFINER em (select ...) nas RLS
-- policies (ROADMAP Performance). Sem o wrapper, current_household_id()/
-- auth.uid()/is_platform_admin()/is_accountant_with_access() reavaliam POR
-- LINHA; com (select ...) o planner avalia UMA vez por query (initplan).
-- Gerado de pg_policies; idempotente (lookbehind evita duplo-wrap).
-- ============================================================================

set search_path = public;

alter policy "account_snapshots: accountant read" on public.account_snapshots
  using ((select is_accountant_with_access(household_id)));
alter policy "account_snapshots: household members" on public.account_snapshots
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "accountant_audit: accountant self reads" on public.accountant_audit_log
  using ((accountant_id = (select auth.uid())));
alter policy "accountant_audit: titular reads" on public.accountant_audit_log
  using ((household_id = (select current_household_id())));
alter policy "documents: accountant manages" on public.accountant_documents
  using ((accountant_id = (select auth.uid())))
  with check ((accountant_id = (select auth.uid())));
alter policy "documents: titular reads" on public.accountant_documents
  using ((household_id = (select current_household_id())));
alter policy "accountant_access: accountant self reads" on public.accountant_household_access
  using ((accountant_id = (select auth.uid())));
alter policy "accountant_access: titular deletes" on public.accountant_household_access
  using ((household_id = (select current_household_id())));
alter policy "accountant_access: titular reads" on public.accountant_household_access
  using ((household_id = (select current_household_id())));
alter policy "accountant_access: titular updates" on public.accountant_household_access
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "accountant_invites: household members manage" on public.accountant_invites
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "notes: accountant self manage" on public.accountant_notes
  using ((accountant_id = (select auth.uid())))
  with check ((accountant_id = (select auth.uid())));
alter policy "notes: titular reads" on public.accountant_notes
  using ((household_id = (select current_household_id())));
alter policy "notes: titular resolves" on public.accountant_notes
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "accountant_profiles: self insert" on public.accountant_profiles
  with check ((id = (select auth.uid())));
alter policy "accountant_profiles: self read" on public.accountant_profiles
  using ((id = (select auth.uid())));
alter policy "accountant_profiles: self update" on public.accountant_profiles
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));
alter policy "accounts: accountant read" on public.accounts
  using ((select is_accountant_with_access(household_id)));
alter policy "accounts: full access within household" on public.accounts
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "admin_audit_log: superadmin read" on public.admin_audit_log
  using ((select is_platform_admin()));
alter policy "announcement_dismissals: own" on public.announcement_dismissals
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
alter policy "announcements: write admin only" on public.announcements
  using ((select is_platform_admin()))
  with check ((select is_platform_admin()));
alter policy "aport_dismissals: rw para membros do household" on public.aport_suggestion_dismissals
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "carne_leao: accountant read" on public.carne_leao_mensal
  using ((select is_accountant_with_access(household_id, year)));
alter policy "carne_leao: household members" on public.carne_leao_mensal
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "categories: accountant read" on public.categories
  using ((select is_accountant_with_access(household_id)));
alter policy "categories: full access within household" on public.categories
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "category_budgets: full access within household" on public.category_budgets
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "category_rules: full access within household" on public.category_rules
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "data_access_requests: own insert" on public.data_access_requests
  with check ((user_id = (select auth.uid())));
alter policy "data_access_requests: own read" on public.data_access_requests
  using (((user_id = (select auth.uid())) OR (select is_platform_admin())));
alter policy "debts: full access within household" on public.debts
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "document_uploads: full access within household" on public.document_uploads
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "email_log: own household reads" on public.email_notifications_log
  using ((related_household_id = (select current_household_id())));
alter policy "feature_flags: write admin only" on public.feature_flags
  using ((select is_platform_admin()))
  with check ((select is_platform_admin()));
alter policy "fontes_pagadoras: accountant read" on public.fontes_pagadoras
  using ((select is_accountant_with_access(household_id)));
alter policy "fontes_pagadoras: household members" on public.fontes_pagadoras
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "goal_contributions: full access via goal household" on public.goal_contributions
  using ((EXISTS ( SELECT 1    FROM goals g   WHERE ((g.id = goal_contributions.goal_id) AND (g.household_id = (select current_household_id()))))))
  with check ((EXISTS ( SELECT 1    FROM goals g   WHERE ((g.id = goal_contributions.goal_id) AND (g.household_id = (select current_household_id()))))));
alter policy "goal_sources: full access via goal household" on public.goal_sources
  using ((EXISTS ( SELECT 1    FROM goals g   WHERE ((g.id = goal_sources.goal_id) AND (g.household_id = (select current_household_id()))))))
  with check ((EXISTS ( SELECT 1    FROM goals g   WHERE ((g.id = goal_sources.goal_id) AND (g.household_id = (select current_household_id()))))));
alter policy "goals: full access within household" on public.goals
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "household_invites: admin manages" on public.household_invites
  using (((household_id = (select current_household_id())) AND (EXISTS ( SELECT 1    FROM users   WHERE ((users.id = (select auth.uid())) AND (users.role = 'admin'::text))))))
  with check (((household_id = (select current_household_id())) AND (EXISTS ( SELECT 1    FROM users   WHERE ((users.id = (select auth.uid())) AND (users.role = 'admin'::text))))));
alter policy "household_invites: members read household invites" on public.household_invites
  using ((household_id = (select current_household_id())));
alter policy "household: admin can update" on public.households
  using ((id = (select current_household_id())))
  with check ((id = (select current_household_id())));
alter policy "household: members can read" on public.households
  using ((id = (select current_household_id())));
alter policy "households: accountant read" on public.households
  using ((select is_accountant_with_access(id)));
alter policy "investment_movements: accountant read" on public.investment_movements
  using ((select is_accountant_with_access(household_id)));
alter policy "movements: full access within household" on public.investment_movements
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "investment_snapshots: accountant read" on public.investment_snapshots
  using ((select is_accountant_with_access(household_id)));
alter policy "investment_snapshots: household members" on public.investment_snapshots
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "investment_yields: accountant read" on public.investment_yields
  using ((select is_accountant_with_access(household_id)));
alter policy "yields: full access within household" on public.investment_yields
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "investments: accountant read" on public.investments
  using ((select is_accountant_with_access(household_id)));
alter policy "investments: full access within household" on public.investments
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_darfs: accountant read" on public.ir_darfs
  using ((select is_accountant_with_access(household_id, year)));
alter policy "ir_darfs: full access within household" on public.ir_darfs
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_deductible_payments: accountant read" on public.ir_deductible_payments
  using ((select is_accountant_with_access(household_id, year)));
alter policy "ir_deductible_payments: full access within household" on public.ir_deductible_payments
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_dependents: accountant read" on public.ir_dependents
  using ((select is_accountant_with_access(household_id)));
alter policy "ir_dependents: full access within household" on public.ir_dependents
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_filers: full access within household" on public.ir_filers
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_income_classifications: full access within household" on public.ir_income_classifications
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_loss_carryforward: accountant read" on public.ir_loss_carryforward
  using ((select is_accountant_with_access(household_id)));
alter policy "ir_loss_carryforward: full access within household" on public.ir_loss_carryforward
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_other_incomes: accountant read" on public.ir_other_incomes
  using ((select is_accountant_with_access(household_id, year)));
alter policy "ir_other_incomes: full access within household" on public.ir_other_incomes
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_prior_year_balances: full access within household" on public.ir_prior_year_balances
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_settings: accountant read" on public.ir_settings
  using ((select is_accountant_with_access(household_id)));
alter policy "ir_settings: full access within household" on public.ir_settings
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_year_metadata: full access within household" on public.ir_year_metadata
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "ir_year_snapshots: accountant read" on public.ir_year_snapshots
  using ((select is_accountant_with_access(household_id, year)));
alter policy "ir_year_snapshots: full access within household" on public.ir_year_snapshots
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "notification_prefs: insert own household" on public.notification_preferences
  with check ((household_id = (select current_household_id())));
alter policy "notification_prefs: read own household" on public.notification_preferences
  using ((household_id = (select current_household_id())));
alter policy "notification_prefs: update own household" on public.notification_preferences
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "patrimonio_snapshots: full access within household" on public.patrimonio_snapshots
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "physical_asset_revaluations: full access within household" on public.physical_asset_revaluations
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "physical_asset_sales: full access within household" on public.physical_asset_sales
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "physical_assets: accountant read" on public.physical_assets
  using ((select is_accountant_with_access(household_id)));
alter policy "physical_assets: full access within household" on public.physical_assets
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "platform_admins: superadmin only" on public.platform_admins
  using ((select is_platform_admin()))
  with check ((select is_platform_admin()));
alter policy "recurring_rules: full access within household" on public.recurring_rules
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "redemption_intents: full access within household" on public.redemption_intents
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "system_alerts: ack own household" on public.system_alerts
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "system_alerts: read own household" on public.system_alerts
  using ((household_id = (select current_household_id())));
alter policy "system_settings: admin read" on public.system_settings
  using ((select is_platform_admin()));
alter policy "system_settings: admin write" on public.system_settings
  using ((select is_platform_admin()))
  with check ((select is_platform_admin()));
alter policy "transaction_splits: full access within household" on public.transaction_splits
  using ((transaction_id IN ( SELECT transactions.id    FROM transactions   WHERE (transactions.household_id = (select current_household_id())))))
  with check ((transaction_id IN ( SELECT transactions.id    FROM transactions   WHERE (transactions.household_id = (select current_household_id())))));
alter policy "transactions: accountant read" on public.transactions
  using ((select is_accountant_with_access(household_id)));
alter policy "transactions: full access within household" on public.transactions
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
alter policy "user_consents: own insert" on public.user_consents
  with check ((user_id = (select auth.uid())));
alter policy "user_consents: own read" on public.user_consents
  using (((user_id = (select auth.uid())) OR (select is_platform_admin())));
alter policy "users: edit self" on public.users
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));
alter policy "users: see household members" on public.users
  using ((household_id = (select current_household_id())));
alter policy "yield_rules: full access within household" on public.yield_rules
  using ((household_id = (select current_household_id())))
  with check ((household_id = (select current_household_id())));
