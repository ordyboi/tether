"use client";

import { Fragment, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import type { MockMember } from "@/lib/mock-data";
import { staleness } from "@/lib/mock-data";

function buildDivIcon(member: MockMember, isSelected: boolean) {
  const stale = staleness(member.lastUpdateSecondsAgo);
  const isGhost = member.sharingState === "ghost" || stale === "hidden";
  const size = isSelected ? 64 : 52;
  const filter = isGhost
    ? "grayscale(1)"
    : stale === "stale"
      ? "grayscale(0.5) opacity(0.6)"
      : "none";

  const pulse =
    stale === "live" && !isGhost
      ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${member.color};opacity:0.35;animation:trailhead-pulse 1.8s ease-out infinite;"></span>`
      : "";

  const badge =
    member.sharingState === "exact"
      ? `<span style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:9999px;background:${member.color};border:2px solid #1b140c;"></span>`
      : member.sharingState === "approx"
        ? `<span style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:9999px;background:#fbbf24;border:2px solid #1b140c;box-shadow:0 0 0 3px rgba(251,191,36,0.35);"></span>`
        : `<span style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:9999px;background:#78716c;border:2px solid #1b140c;display:flex;align-items:center;justify-content:center;color:#e7e5e4;font-size:9px;">–</span>`;

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;filter:${filter};">
      ${pulse}
      <div style="position:relative;width:100%;height:100%;border-radius:9999px;background:#2a1d10;border:3px ${isGhost ? "dashed #78716c" : `solid ${member.color}`};display:flex;align-items:center;justify-content:center;font-size:${size * 0.45}px;box-shadow:0 3px 0 rgba(0,0,0,0.35);">
        ${member.emoji}
      </div>
      ${badge}
    </div>
  `;

  return L.divIcon({
    html,
    className: "trailhead-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function RoomMap({
  members,
  center,
  selectedId,
  onSelectMember,
  focusTarget,
}: {
  members: MockMember[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  onSelectMember: (id: string) => void;
  focusTarget: { lat: number; lng: number; zoom?: number } | null;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <style>{`
        @keyframes trailhead-pulse {
          0% { transform: scale(0.9); opacity: 0.45; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .leaflet-container { background: #241a0f; font-family: inherit; }
      `}</style>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyTo target={focusTarget} />
        {members.map((m) => {
          if (m.sharingState === "ghost") return null;
          return (
            <Fragment key={m.id}>
              {m.sharingState === "approx" && m.blurRadiusM && (
                <Circle
                  center={[m.lat, m.lng]}
                  radius={m.blurRadiusM}
                  pathOptions={{
                    color: m.color,
                    fillColor: m.color,
                    fillOpacity: 0.12,
                    weight: 2,
                    dashArray: "6 6",
                  }}
                />
              )}
              <Marker
                position={[m.lat, m.lng]}
                icon={buildDivIcon(m, m.id === selectedId)}
                eventHandlers={{ click: () => onSelectMember(m.id) }}
              />
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

function FlyTo({
  target,
}: {
  target: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 16, { duration: 0.75 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, target?.zoom]);

  return null;
}
