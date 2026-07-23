"use client";

import { useRef } from "react";
import L from "leaflet";
import type { MockMember } from "@/lib/mock-data";
import { staleness } from "@/lib/mock-data";
import { useLeafletMap } from "@/app/_lib/use-leaflet-map";
import { useFlyTo } from "@/app/_lib/use-fly-to";
import { useMapMarkers } from "@/app/_lib/use-map-markers";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useLeafletMap(containerRef, center, 15);

  useFlyTo(mapRef, focusTarget);
  useMapMarkers(mapRef, members, selectedId, onSelectMember, buildDivIcon);

  return (
    <div className="relative isolate h-full w-full overflow-hidden">
      <style>{`
        @keyframes trailhead-pulse {
          0% { transform: scale(0.9); opacity: 0.45; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .leaflet-container { background: #241a0f; font-family: inherit; }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
