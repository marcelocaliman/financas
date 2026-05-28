"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { addTripPhoto } from "@/services/trips.actions";

/**
 * Upload de fotos da viagem.
 *
 * Pipeline:
 *  1. Comprime client-side (max 1.6 MB, 1920px) — preserva qualidade visual
 *     mas economiza storage e banda
 *  2. Upload pro bucket trip-photos via Supabase Storage
 *  3. Cria registro em trip_photos via server action
 *
 * Suporta múltiplos arquivos de uma vez (queue sequencial pra não saturar).
 */
export function TripPhotoUploader({
  tripId,
  householdId,
}: {
  tripId: string;
  householdId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const handleFiles = async (files: FileList) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setProgress({ current: 0, total: list.length });
    const supabase = createClient();

    let okCount = 0;
    let failCount = 0;

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setProgress({ current: i + 1, total: list.length });

      try {
        // Compressão
        const compressed = await imageCompression(file, {
          maxSizeMB: 1.6,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: "image/jpeg",
        });

        // Upload com path único: {household}/{trip}/{timestamp-random}.jpg
        const ext = "jpg";
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `${householdId}/${tripId}/${filename}`;

        const { error: upErr } = await supabase.storage
          .from("trip-photos")
          .upload(path, compressed, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) {
          console.error("upload error", upErr);
          failCount++;
          continue;
        }

        // Pega dimensões
        const dims = await getImageDimensions(compressed);

        // Registra no DB
        const r = await addTripPhoto({
          tripId,
          storagePath: path,
          width: dims.width,
          height: dims.height,
          sizeBytes: compressed.size,
        });
        if (r.error) {
          // Rollback do upload
          await supabase.storage.from("trip-photos").remove([path]);
          failCount++;
          continue;
        }
        okCount++;
      } catch (e) {
        console.error(e);
        failCount++;
      }
    }

    setProgress(null);
    if (okCount > 0)
      toast.success(`${okCount} foto${okCount !== 1 ? "s" : ""} enviada${okCount !== 1 ? "s" : ""}.`);
    if (failCount > 0)
      toast.error(`${failCount} falha${failCount !== 1 ? "s" : ""} no upload.`);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            startTransition(() => handleFiles(e.target.files!));
            e.target.value = "";
          }
        }}
      />
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={pending || progress !== null}
      >
        {progress ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
            {progress.current}/{progress.total}
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" strokeWidth={1.8} />
            Adicionar fotos
          </>
        )}
      </Button>
    </>
  );
}

async function getImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(blob);
  });
}
