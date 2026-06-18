import { supabase } from "@/lib/supabase";
import type {
  AdminOverview, SignupsDay, UserRow, UserDetail, AuditEntry, AdminRow,
  AnalyticsOverview, EventsDay, TopEvent, UserSort,
} from "./types";

/** Wrappers tipados dos RPCs de admin. Cada um exige is_admin() no servidor. */

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const adminApi = {
  isAdmin: () => rpc<boolean>("is_admin"),
  overview: () => rpc<AdminOverview>("admin_overview"),
  signupsDaily: (days = 30) => rpc<SignupsDay[]>("admin_signups_daily", { p_days: days }),
  usersList: (search: string | null, limit: number, offset: number, sort: UserSort) =>
    rpc<UserRow[]>("admin_users_list", { p_search: search || null, p_limit: limit, p_offset: offset, p_sort: sort }),
  userDetail: (userId: string) => rpc<UserDetail>("admin_user_detail", { p_user_id: userId }),
  auditLog: (limit = 50, offset = 0) => rpc<AuditEntry[]>("admin_audit_log", { p_limit: limit, p_offset: offset }),
  deleteUser: (userId: string, confirmEmail: string) =>
    rpc<void>("admin_delete_user", { p_user_id: userId, p_confirm_email: confirmEmail }),
  adminsList: () => rpc<AdminRow[]>("admin_admins_list"),
  setRole: (email: string, makeAdmin: boolean) => rpc<boolean>("admin_set_role", { p_email: email, p_make_admin: makeAdmin }),
  analyticsOverview: (days = 30) => rpc<AnalyticsOverview>("admin_analytics_overview", { p_days: days }),
  eventsDaily: (days = 30) => rpc<EventsDay[]>("admin_events_daily", { p_days: days }),
  topEvents: (days = 30) => rpc<TopEvent[]>("admin_top_events", { p_days: days }),
};
