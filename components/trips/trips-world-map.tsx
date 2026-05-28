"use client";

import dynamic from "next/dynamic";

const TripMap = dynamic(
  () => import("./trip-map").then((m) => ({ default: m.TripMap })),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

function MapPlaceholder() {
  return (
    <div className="h-[320px] rounded-[8px] bg-surface-muted/40 border border-border animate-pulse" />
  );
}

type Pin = {
  id: string;
  name: string;
  destination: string;
  latitude: number;
  longitude: number;
  href?: string;
};

export function TripsWorldMap({ pins }: { pins: Pin[] }) {
  if (pins.length === 0) return null;
  return <TripMap pins={pins} height={360} />;
}
