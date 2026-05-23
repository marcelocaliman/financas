-- ============================================================================
-- Finanças — tracking_starts_at em goals
-- ============================================================================
-- Permite ao usuário dizer "comece a cobrar lembretes de aporte a partir
-- desta data". Sem isso, o sistema usa goals.created_at como referência
-- implícita (vide getGoalReminders em services/goal-reminders.ts).
--
-- Resolve o problema: meta criada dia 22 com contribution_day=5 marcava
-- "atrasada há 18 dias" pra um mês onde a meta nem existia.
-- ============================================================================

alter table public.goals
  add column if not exists tracking_starts_at date;

comment on column public.goals.tracking_starts_at is
  'Data a partir da qual os lembretes de aporte começam a contar. Se NULL, usa created_at como referência. Útil pra pausar/retomar tracking ou cadastrar metas backdatadas.';
