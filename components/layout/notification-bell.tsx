import { listUserAlerts } from "@/services/system-alerts";
import { NotificationBellClient } from "./notification-bell-client";

/**
 * Server wrapper: busca os alerts user_facing do household atual e
 * passa pro client component renderizar o sino + dropdown.
 *
 * Aparece no rodapé do sidebar (desktop) e na mobile-nav. Quando há
 * alerta novo, mostra bolinha vermelha + count no badge. Click abre
 * lista pra acknowledge.
 */
export async function NotificationBell({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const alerts = await listUserAlerts();
  return <NotificationBellClient alerts={alerts} tone={tone} />;
}
