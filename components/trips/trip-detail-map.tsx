"use client";

import dynamic from "next/dynamic";

const TripMap = dynamic(
  () => import("./trip-map").then((m) => ({ default: m.TripMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] rounded-[8px] bg-surface-muted/40 border border-border animate-pulse" />
    ),
  },
);

export function TripDetailMap({
  latitude,
  longitude,
  name,
  destination,
}: {
  latitude: number;
  longitude: number;
  name: string;
  destination: string;
}) {
  return (
    <TripMap
      pins={[{ id: "this", name, destination, latitude, longitude }]}
      height={260}
      zoom={7}
    />
  );
}
