"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { mockRoom, staleness, type MockMember } from "@/lib/mock-data";

function markerIcon(member: MockMember) {
  const bucket = staleness(member.lastUpdateSecondsAgo);
  const opacity = member.sharingState === "ghost" ? 0.35 : bucket === "stale" ? 0.55 : 1;
  const ringStyle =
    member.sharingState === "approx" ? "dashed" : "solid";

  const html = `
    <div style="
      position: relative;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: ${opacity};
    ">
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        background: ${member.color}33;
        border: 2px ${ringStyle} ${member.color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      ">${member.emoji}</div>
      ${
        member.sharingState !== "ghost"
          ? `<div style="
              position: absolute;
              bottom: -1px;
              right: -1px;
              width: 12px;
              height: 12px;
              border-radius: 9999px;
              border: 2px solid #0a0a0a;
              background: ${
                bucket === "live"
                  ? "#10b981"
                  : bucket === "recent"
                    ? "#f59e0b"
                    : "#737373"
              };
            "></div>`
          : ""
      }
    </div>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function FlyToMember({
  member,
}: {
  member: MockMember | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (member) {
      map.flyTo([member.lat, member.lng], 16, { duration: 0.6 });
    }
  }, [member, map]);
  return null;
}

export default function RoomMap({
  members,
  focusedMember,
}: {
  members: MockMember[];
  focusedMember: MockMember | null;
}) {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <MapContainer
      center={[mockRoom.center.lat, mockRoom.center.lng]}
      zoom={15}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full bg-neutral-900"
      ref={mapRef}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

      {members
        .filter((m) => m.sharingState !== "ghost")
        .map(
          (m) =>
            m.sharingState === "approx" &&
            m.blurRadiusM && (
              <Circle
                key={`${m.id}-blur`}
                center={[m.lat, m.lng]}
                radius={m.blurRadiusM}
                pathOptions={{
                  color: m.color,
                  fillColor: m.color,
                  fillOpacity: 0.12,
                  opacity: 0.4,
                  weight: 1,
                }}
              />
            ),
        )}

      {members.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={markerIcon(m)} />
      ))}

      <FlyToMember member={focusedMember} />
    </MapContainer>
  );
}
