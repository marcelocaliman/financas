"use client";

import { useState, useTransition } from "react";
import { Trash2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { deleteTripPhoto, setTripCoverPhoto } from "@/services/trips.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Galeria grid com lightbox simples. Cada foto tem ações de "definir capa"
 * e "apagar". Click abre lightbox em fullscreen.
 */
export function TripGallery({
  tripId,
  photos,
  coverPhotoId,
}: {
  tripId: string;
  photos: Photo[];
  coverPhotoId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const confirm = useConfirm();

  if (photos.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-border px-6 py-10 text-center">
        <p className="text-[13px] text-muted-foreground">
          Nenhuma foto ainda. Use o botão acima pra adicionar.
        </p>
      </div>
    );
  }

  const handleDelete = async (id: string, idx: number) => {
    const ok = await confirm({
      title: "Apagar foto?",
      description: "Foto será removida do app e do storage.",
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteTripPhoto(id, tripId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Foto apagada.");
        if (lightboxIdx === idx) setLightboxIdx(null);
      }
    });
  };

  const handleSetCover = async (id: string) => {
    startTransition(async () => {
      const r = await setTripCoverPhoto(tripId, id);
      if (r.error) toast.error(r.error);
      else toast.success("Capa atualizada.");
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {photos.map((p, idx) => (
          <div
            key={p.id}
            className="group relative aspect-square rounded-[6px] overflow-hidden bg-surface-muted border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption ?? ""}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightboxIdx(idx)}
              loading="lazy"
            />
            {coverPhotoId === p.id ? (
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-[4px] bg-gold-600 text-white text-[9px] font-mono uppercase tracking-[0.08em] font-medium">
                CAPA
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
              {coverPhotoId !== p.id ? (
                <button
                  type="button"
                  onClick={() => handleSetCover(p.id)}
                  disabled={pending}
                  className="p-1.5 rounded-[4px] bg-white/90 text-foreground hover:bg-white"
                  aria-label="Definir como capa"
                  title="Definir como capa"
                >
                  <Star className="w-3 h-3" strokeWidth={2} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleDelete(p.id, idx)}
                disabled={pending}
                className="p-1.5 rounded-[4px] bg-white/90 text-rust-700 hover:bg-white"
                aria-label="Apagar"
                title="Apagar foto"
              >
                <Trash2 className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {lightboxIdx !== null && photos[lightboxIdx] ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightboxIdx(null)}
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIdx].url}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
