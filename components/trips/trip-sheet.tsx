"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTrip,
  updateTrip,
  type TripFormState,
} from "@/services/trips.actions";
import type { Trip, TripStatus } from "@/types/trips";
import { TRIP_STATUS_LABELS } from "@/types/trips";

type Currency = "BRL" | "EUR" | "USD" | "GBP";

const CURRENCIES: Array<{ value: Currency; label: string }> = [
  { value: "BRL", label: "R$ Real (BRL)" },
  { value: "EUR", label: "€ Euro (EUR)" },
  { value: "USD", label: "US$ Dólar (USD)" },
  { value: "GBP", label: "£ Libra (GBP)" },
];

function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 65,
    A + code.toUpperCase().charCodeAt(1) - 65,
  );
}

const STATUSES: TripStatus[] = [
  "planning",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export function TripSheet({
  open,
  onOpenChange,
  trip,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trip?: Trip | null;
}) {
  const isEdit = !!trip;
  const router = useRouter();

  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [countryCode, setCountryCode] = useState(trip?.country_code ?? "");
  const [latitude, setLatitude] = useState<string>(
    trip?.latitude?.toString() ?? "",
  );
  const [longitude, setLongitude] = useState<string>(
    trip?.longitude?.toString() ?? "",
  );
  const [resolvedLocation, setResolvedLocation] = useState<string>("");
  const [startDate, setStartDate] = useState(trip?.start_date ?? "");
  const [endDate, setEndDate] = useState(trip?.end_date ?? "");
  const [status, setStatus] = useState<TripStatus>(trip?.status ?? "planning");
  const [currency, setCurrency] = useState<Currency>(
    (trip?.default_currency as Currency) ?? "BRL",
  );
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [geocoding, startGeocode] = useTransition();

  const [state, action, pending] = useActionState<TripFormState | undefined, FormData>(
    isEdit ? updateTrip : createTrip,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? "Viagem atualizada." : "Viagem criada.");
      onOpenChange(false);
      if (state.createdId) {
        router.push(`/viagens/${state.createdId}`);
      } else {
        router.refresh();
      }
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, isEdit, onOpenChange, router]);

  const handleGeocode = () => {
    if (!destination.trim()) {
      toast.error("Preencha o destino primeiro.");
      return;
    }
    startGeocode(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(destination)}`,
        );
        if (!res.ok) {
          toast.error("Falha no geocoding.");
          return;
        }
        const data = (await res.json()) as {
          latitude?: number;
          longitude?: number;
          country_code?: string;
          display_name?: string;
        };
        if (data.latitude && data.longitude) {
          setLatitude(data.latitude.toString());
          setLongitude(data.longitude.toString());
          if (data.country_code) setCountryCode(data.country_code.toUpperCase());
          // display_name vem cheio (ex: "Londres, Greater London, Inglaterra,
          // SW1A 2BX, Reino Unido"). Reduz pras 2 primeiras partes — geralmente
          // cidade + região/estado — pra ficar legível.
          const parts = (data.display_name ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const short = parts.slice(0, 2).join(", ") + (parts.length > 2 ? `, ${parts[parts.length - 1]}` : "");
          setResolvedLocation(short || data.display_name || "");
          toast.success(`Localização: ${short.slice(0, 60)}`);
        } else {
          toast.error("Destino não encontrado no OpenStreetMap.");
        }
      } catch {
        toast.error("Erro ao buscar localização.");
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          eyebrow={isEdit ? "Editar" : "Nova"}
          title={isEdit ? "Editar viagem." : "Nova viagem."}
          description={
            isEdit
              ? "Atualize o que precisar e salve."
              : "Cadastre uma viagem nova com destino, datas e moeda padrão."
          }
        />

        <form action={action} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={trip!.id} /> : null}

          <Field label="Nome" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lisboa Set/2026"
            />
          </Field>

          <Field
            label="Destino"
            htmlFor="destination"
            required
            hint='Ex: "Lisboa, Portugal" ou "Rio de Janeiro, Brasil"'
          >
            <div className="flex gap-2">
              <Input
                id="destination"
                name="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Lisboa, Portugal"
              />
              <Button
                variant="secondary"
                type="button"
                onClick={handleGeocode}
                disabled={geocoding}
                size="sm"
              >
                {geocoding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
                ) : (
                  <MapPin className="w-3.5 h-3.5" strokeWidth={1.8} />
                )}
                Localizar
              </Button>
            </div>
            {latitude && longitude ? (
              <div className="mt-1.5 inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-olive-100/40 dark:bg-olive-900/15 border border-olive-200/60 dark:border-olive-800/40">
                <MapPin
                  className="w-3 h-3 mt-[1px] text-olive-700 dark:text-olive-300 shrink-0"
                  strokeWidth={2}
                />
                <div className="text-[11.5px] leading-tight">
                  <div className="text-foreground font-medium">
                    {countryCode ? flagEmoji(countryCode) + " " : ""}
                    {resolvedLocation || destination}
                  </div>
                  <div className="font-mono text-[10px] text-faint-foreground mt-0.5 tracking-[0.02em]">
                    {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
                  </div>
                </div>
              </div>
            ) : null}
          </Field>

          <input type="hidden" name="countryCode" value={countryCode} />
          <input type="hidden" name="latitude" value={latitude} />
          <input type="hidden" name="longitude" value={longitude} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data ida" htmlFor="startDate">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Data volta" htmlFor="endDate">
              <Input
                id="endDate"
                name="endDate"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TripStatus)}
                name="status"
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TRIP_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Moeda padrão" htmlFor="defaultCurrency">
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
                name="defaultCurrency"
              >
                <SelectTrigger id="defaultCurrency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notas / itinerário" htmlFor="notes" hint="Opcional">
            <Textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Voo TAP 1234 às 22h, hotel Lumen Lisboa, museu Calouste Gulbenkian…"
            />
          </Field>

          {state?.error ? (
            <p className="text-[12.5px] text-rust-600">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Criar viagem"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
