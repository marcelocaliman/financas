"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa interativo via Leaflet + OSM (gratuito, sem chave).
 *
 * Importante: Leaflet precisa do DOM, então este é um Client Component.
 * Carregado dinamicamente no parent via next/dynamic com ssr:false pra
 * evitar erros de hidratação.
 */

type TripPin = {
  id: string;
  name: string;
  destination: string;
  latitude: number;
  longitude: number;
  href?: string;
};

export function TripMap({
  pins,
  height = 320,
  zoom,
  centerOverride,
}: {
  pins: TripPin[];
  height?: number;
  /** Default: auto-fit pra mostrar todos os pins */
  zoom?: number;
  centerOverride?: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Ícone custom (Leaflet padrão tem caminho hardcoded pra imagens)
    const icon = L.divIcon({
      html: `<div style="
        width: 24px; height: 24px;
        background: #1d3866;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    if (pins.length === 0) {
      map.setView([0, 0], zoom ?? 2);
    } else if (pins.length === 1) {
      const p = pins[0];
      map.setView(
        centerOverride ?? [p.latitude, p.longitude],
        zoom ?? 6,
      );
    } else {
      const bounds = L.latLngBounds(pins.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }

    for (const p of pins) {
      const marker = L.marker([p.latitude, p.longitude], { icon }).addTo(map);
      const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;line-height:1.4;min-width:140px;">
        <div style="font-weight:600;margin-bottom:2px;">${escapeHtml(p.name)}</div>
        <div style="color:#6a6a6a;font-size:12px;margin-bottom:6px;">${escapeHtml(p.destination)}</div>
        ${p.href ? `<a href="${escapeHtml(p.href)}" style="color:#1d3866;text-decoration:underline;font-size:12px;">Abrir →</a>` : ""}
      </div>`;
      marker.bindPopup(html);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pins, zoom, centerOverride]);

  return (
    <div
      ref={containerRef}
      className="rounded-[8px] overflow-hidden border border-border relative"
      // isolation: isolate cria um novo stacking context — sem isso, os
      // z-index internos do Leaflet (até 800) atravessam overlays/sheets
      // do app (z-50). z-index:0 garante que o container fique abaixo de
      // qualquer overlay com z >= 1.
      style={{ height: `${height}px`, width: "100%", isolation: "isolate", zIndex: 0 }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
