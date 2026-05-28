import type { Currency } from "./database";

export type TripStatus =
  | "planning"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Trip = {
  id: string;
  household_id: string;
  name: string;
  destination: string;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  default_currency: Currency;
  cover_photo_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TripBudgetItem = {
  id: string;
  trip_id: string;
  category: string;
  planned_amount: number;
  notes: string | null;
  position: number;
  created_at: string;
};

export type TripPhoto = {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  taken_at: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  position: number;
  uploaded_by: string | null;
  created_at: string;
};

/** Categorias padrão pro orçamento. Usuário pode customizar. */
export const DEFAULT_TRIP_CATEGORIES = [
  "Passagem",
  "Hospedagem",
  "Comida",
  "Transporte",
  "Atrações",
  "Presentes",
  "Seguro",
  "Outros",
] as const;

export type TripCategory = (typeof DEFAULT_TRIP_CATEGORIES)[number];

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planning: "Planejando",
  confirmed: "Confirmada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const TRIP_STATUS_TONES: Record<
  TripStatus,
  "neutral" | "navy" | "olive" | "gold" | "rust"
> = {
  planning: "neutral",
  confirmed: "navy",
  in_progress: "gold",
  completed: "olive",
  cancelled: "rust",
};
