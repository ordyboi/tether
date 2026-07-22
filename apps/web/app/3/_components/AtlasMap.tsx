"use client";

import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";
import type { MockMember } from "@/lib/mock-data";
import { staleness } from "@/lib/mock-data";

function opacityFor(bucket: ReturnType<typeof staleness>) {
  switch (bucket) {
    case "live":
      return 1;
    case "recent":
      return 0.8;
    case "stale":
      return 0.42;
    default:
      return 1;
  }
}

function buildIcon(member: MockMember, selected: boolean) {
  const bucket = staleness(member.lastUpdateSecondsAgo);
  const opacity = opacityFor(bucket);
  const grayscale = bucket === "stale" ? "60%" : "0%";
  const ringHtml =
    member.sharingState === "exact"
      ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${member.color};opacity:0.35;${
          bucket === "live" ? "animation:atlas-pulse 2.4s ease-in-out infinite;" : ""
        }"></span>`
      : "";
  const selectedRing = selected
    ? `<span style="position:absolute;inset:-11px;border-radius:9999px;border:2px solid rgba(23,23,23,0.5);"></span>`
    : "";

  const html = `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;filter:grayscale(${grayscale});opacity:${opacity};">
      ${selectedRing}
      ${ringHtml}
      <div style="position:relative;width:30px;height:30px;border-radius:9999px;background:rgba(255,255,255,0.9);box-shadow:0 4px 14px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid ${member.color};">
        ${member.emoji}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "atlas-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

interface AtlasMapProps {
  members: MockMember[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function AtlasMap({
  members,
  center,
  selectedId,
  onSelect,
}: AtlasMapProps) {
  const visible = useMemo(
    () => members.filter((m) => m.sharingState !== "ghost"),
    [members],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      zoomControl={true}
      attributionControl={true}
      className="atlas-map h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {visible.map((m) =>
        m.sharingState === "approx" && m.blurRadiusM ? (
          <Circle
            key={`${m.id}-blur`}
            center={[m.lat, m.lng]}
            radius={m.blurRadiusM}
            pathOptions={{
              color: m.color,
              weight: 1,
              opacity: 0.3,
              fillColor: m.color,
              fillOpacity: 0.14,
            }}
          />
        ) : null,
      )}

      {visible.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={buildIcon(m, m.id === selectedId)}
          eventHandlers={{ click: () => onSelect(m.id) }}
        />
      ))}
    </MapContainer>
  );
}
