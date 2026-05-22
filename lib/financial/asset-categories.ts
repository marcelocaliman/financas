import type { PhysicalAssetCategory } from "@/types/database";

export const CATEGORY_LABELS: Record<PhysicalAssetCategory, string> = {
  real_estate: "Imóvel",
  vehicle: "Veículo",
  electronics: "Eletrônico",
  furniture: "Móvel",
  jewelry: "Joia",
  art: "Arte",
  tools: "Ferramenta",
  other: "Outro",
};

export const CATEGORY_ICONS: Record<PhysicalAssetCategory, string> = {
  real_estate: "home",
  vehicle: "car",
  electronics: "monitor",
  furniture: "armchair",
  jewelry: "gem",
  art: "palette",
  tools: "wrench",
  other: "package",
};
