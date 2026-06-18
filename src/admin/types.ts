/** Tipos dos RPCs de admin (só metadados — nunca dado financeiro). */

export interface AdminOverview {
  total_users: number;
  confirmed_users: number;
  unconfirmed_users: number;
  active_1d: number;
  active_7d: number;
  active_30d: number;
  dormant_30d: number;
  dormant_60d: number;
  dormant_90d: number;
  new_7d: number;
  new_30d: number;
  vault_users: number;
  synced_users: number;
  optin_count: number;
  admins_count: number;
  total_ciphertext_bytes: number;
  avg_ciphertext_bytes: number;
}

export interface SignupsDay {
  day: string;
  signups: number;
  confirmed: number;
}

export interface UserRow {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  vault_version: number | null;
  vault_updated_at: string | null;
  ciphertext_bytes: number | null;
  opted_in: boolean;
  is_admin: boolean;
  total_count: number;
}

export interface UserDetail {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  vault_version: number | null;
  vault_updated_at: string | null;
  kdf: string | null;
  kdf_params: unknown;
  ciphertext_bytes: number | null;
  blob_updated_at: string | null;
  opted_in: boolean;
  consent_at: string | null;
  consent_text_version: string | null;
  is_admin: boolean;
}

export interface AuditEntry {
  id: string;
  created_at: string;
  action: string | null;
  actor_email: string | null;
  ip: string | null;
}

export interface AdminRow {
  user_id: string;
  email: string;
  created_at: string;
}

export interface AnalyticsOverview {
  events_total: number;
  landing_views: number;
  unique_visitors: number;
  cta_clicks: number;
  signups: number;
  logins: number;
  app_opens: number;
  conversion_pct: number;
}

export interface EventsDay {
  day: string;
  landing_views: number;
  cta_clicks: number;
  signups: number;
  app_opens: number;
}

export interface TopEvent {
  surface: string;
  name: string;
  count: number;
}

export type UserSort = "recent" | "active" | "email";

export interface RecentEvent {
  created_at: string;
  surface: string;
  name: string;
  country: string | null;
  device: string | null;
}

export interface CountryCount {
  country: string;
  count: number;
}

export interface DeviceCount {
  device: string;
  count: number;
}
