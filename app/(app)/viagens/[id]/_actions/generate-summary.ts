"use server";

import { generateTripNarrative, type TripNarrative } from "@/services/ai/trip-summary";

export type TripSummaryState =
  | { ok: true; result: TripNarrative; costCents: number }
  | { ok: false; error: string };

export async function generateSummary(tripId: string): Promise<TripSummaryState> {
  const r = await generateTripNarrative(tripId);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, result: r.result, costCents: r.usage.costCents };
}
