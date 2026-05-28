"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/services/auth";

const STATUSES = [
  "planning",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
const CURRENCIES = ["BRL", "EUR", "USD", "GBP"] as const;

const baseSchema = z.object({
  name: z.string().min(1, "Nome obrigatório.").max(80),
  destination: z.string().min(1, "Destino obrigatório.").max(120),
  countryCode: z
    .string()
    .length(2)
    .toUpperCase()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: z.enum(STATUSES).default("planning"),
  defaultCurrency: z.enum(CURRENCIES).default("BRL"),
  notes: z.string().optional().or(z.literal("").transform(() => undefined)),
});

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export type TripFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  createdId?: string;
};

function parseErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const p = issue.path.join(".");
    if (p && !out[p]) out[p] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return v == null ? undefined : String(v);
  };
  return {
    name: get("name") ?? "",
    destination: get("destination") ?? "",
    countryCode: get("countryCode") || undefined,
    latitude: get("latitude") || undefined,
    longitude: get("longitude") || undefined,
    startDate: get("startDate") || undefined,
    endDate: get("endDate") || undefined,
    status: get("status") || "planning",
    defaultCurrency: get("defaultCurrency") || "BRL",
    notes: get("notes") || undefined,
  };
}

function validateDates(start: string | undefined, end: string | undefined): string | null {
  if (!start || !end) return null;
  if (end < start) return "Data de fim antes da data de início.";
  return null;
}

type TripInsert = {
  household_id: string;
  name: string;
  destination: string;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  default_currency: string;
  notes: string | null;
  created_by: string;
};

function buildPayload(
  d: z.output<typeof baseSchema>,
  householdId: string,
  userId: string,
): TripInsert {
  return {
    household_id: householdId,
    name: d.name.trim(),
    destination: d.destination.trim(),
    country_code: d.countryCode ?? null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    start_date: d.startDate ?? null,
    end_date: d.endDate ?? null,
    status: d.status,
    default_currency: d.defaultCurrency,
    notes: d.notes?.trim() ?? null,
    created_by: userId,
  };
}

function pathsToInvalidate(tripId?: string) {
  const paths = ["/viagens", "/dashboard"];
  if (tripId) paths.push(`/viagens/${tripId}`);
  return paths;
}

// ----------------------------------------------------------------------
// CRUD
// ----------------------------------------------------------------------

export async function createTrip(
  _prev: TripFormState | undefined,
  formData: FormData,
): Promise<TripFormState> {
  const parsed = baseSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const dateErr = validateDates(parsed.data.startDate, parsed.data.endDate);
  if (dateErr) return { error: dateErr };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const payload = buildPayload(parsed.data, ctx.household.id, ctx.profile.id);
  const { data, error } = await (
    supabase.from as unknown as (t: string) => {
      insert: (rows: TripInsert[]) => {
        select: (s: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    }
  )("trips")
    .insert([payload])
    .select("id")
    .single();

  if (error) return { error: error.message };
  for (const p of pathsToInvalidate()) revalidatePath(p);
  return { ok: true, createdId: data!.id };
}

export async function updateTrip(
  _prev: TripFormState | undefined,
  formData: FormData,
): Promise<TripFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    ...readForm(formData),
  });
  if (!parsed.success) return { fieldErrors: parseErrors(parsed.error) };

  const dateErr = validateDates(parsed.data.startDate, parsed.data.endDate);
  if (dateErr) return { error: dateErr };

  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const payload = buildPayload(parsed.data, ctx.household.id, ctx.profile.id);

  const { error } = await (
    supabase.from as unknown as (t: string) => {
      update: (row: Partial<TripInsert>) => {
        eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )("trips")
    .update(payload)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };
  for (const p of pathsToInvalidate(parsed.data.id)) revalidatePath(p);
  return { ok: true };
}

export async function deleteTrip(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await (
    supabase.from as unknown as (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    }
  )("trips")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  for (const p of pathsToInvalidate(id)) revalidatePath(p);
  return { ok: true };
}

// ----------------------------------------------------------------------
// Budget items
// ----------------------------------------------------------------------

const budgetItemSchema = z.object({
  tripId: z.string().uuid(),
  category: z.string().min(1).max(40),
  plannedAmount: z.coerce.number().nonnegative(),
  notes: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function upsertBudgetItem(input: {
  tripId: string;
  category: string;
  plannedAmount: number;
  notes?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const parsed = budgetItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Inválido." };

  const supabase = await createClient();
  const { error } = await (
    supabase.from as unknown as (t: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  )("trip_budget_items")
    .upsert(
      {
        trip_id: parsed.data.tripId,
        category: parsed.data.category,
        planned_amount: parsed.data.plannedAmount,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: "trip_id,category" },
    );

  if (error) return { error: error.message };
  revalidatePath(`/viagens/${parsed.data.tripId}`);
  return { ok: true };
}

export async function deleteBudgetItem(
  id: string,
  tripId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await (
    supabase.from as unknown as (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    }
  )("trip_budget_items")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/viagens/${tripId}`);
  return { ok: true };
}

// ----------------------------------------------------------------------
// Photos
// ----------------------------------------------------------------------

export async function addTripPhoto(input: {
  tripId: string;
  storagePath: string;
  caption?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}): Promise<{ ok?: boolean; error?: string; photoId?: string }> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data, error } = await (
    supabase.from as unknown as (t: string) => {
      insert: (rows: Record<string, unknown>[]) => {
        select: (s: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )("trip_photos")
    .insert([
      {
        trip_id: input.tripId,
        storage_path: input.storagePath,
        caption: input.caption ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        size_bytes: input.sizeBytes ?? null,
        uploaded_by: ctx.profile.id,
      },
    ])
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/viagens/${input.tripId}`);
  return { ok: true, photoId: data!.id };
}

export async function deleteTripPhoto(
  photoId: string,
  tripId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  // Lê storage_path antes de deletar
  const { data: photo } = await (
    supabase.from as unknown as (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: { storage_path: string } | null }>;
        };
      };
    }
  )("trip_photos")
    .select("storage_path")
    .eq("id", photoId)
    .maybeSingle();

  if (photo?.storage_path) {
    await supabase.storage.from("trip-photos").remove([photo.storage_path]);
  }

  const { error } = await (
    supabase.from as unknown as (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    }
  )("trip_photos")
    .delete()
    .eq("id", photoId);

  if (error) return { error: error.message };
  revalidatePath(`/viagens/${tripId}`);
  return { ok: true };
}

export async function setTripCoverPhoto(
  tripId: string,
  photoId: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await (
    supabase.from as unknown as (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )("trips")
    .update({ cover_photo_id: photoId })
    .eq("id", tripId);
  if (error) return { error: error.message };
  revalidatePath(`/viagens/${tripId}`);
  revalidatePath("/viagens");
  return { ok: true };
}
