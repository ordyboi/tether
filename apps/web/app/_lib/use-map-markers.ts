import { useEffect, useRef, type RefObject } from "react";
import L from "leaflet";
import type { MockMember } from "@/lib/mock-data";

export function useMapMarkers(
  mapRef: RefObject<L.Map | null>,
  members: MockMember[],
  selectedId: string | null,
  onSelectMember: (id: string) => void,
  buildDivIcon: (member: MockMember, isSelected: boolean) => L.DivIcon,
) {
  const markersRef = useRef(new Map<string, L.Marker>());
  const circlesRef = useRef(new Map<string, L.Circle>());

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const circles = circlesRef.current;
    const visibleIds = new Set(
      members.filter((m) => m.sharingState !== "ghost").map((m) => m.id),
    );

    for (const [id, marker] of markers) {
      if (!visibleIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    for (const [id, circle] of circles) {
      if (!visibleIds.has(id)) {
        circle.remove();
        circles.delete(id);
      }
    }

    for (const m of members) {
      if (m.sharingState === "ghost") continue;

      const isSelected = m.id === selectedId;
      const icon = buildDivIcon(m, isSelected);
      let marker = markers.get(m.id);
      if (!marker) {
        marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        marker.on("click", () => onSelectMember(m.id));
        markers.set(m.id, marker);
      } else {
        marker.setLatLng([m.lat, m.lng]);
        marker.setIcon(icon);
      }

      const showCircle = m.sharingState === "approx" && !!m.blurRadiusM;
      let circle = circles.get(m.id);
      if (showCircle) {
        if (!circle) {
          circle = L.circle([m.lat, m.lng], {
            radius: m.blurRadiusM!,
            color: m.color,
            fillColor: m.color,
            fillOpacity: 0.12,
            weight: 2,
            dashArray: "6 6",
          }).addTo(map);
          circles.set(m.id, circle);
        } else {
          circle.setLatLng([m.lat, m.lng]);
          circle.setRadius(m.blurRadiusM!);
          circle.setStyle({ color: m.color, fillColor: m.color });
        }
      } else if (circle) {
        circle.remove();
        circles.delete(m.id);
      }
    }
  }, [mapRef, members, selectedId, onSelectMember, buildDivIcon]);

  useEffect(() => {
    const markers = markersRef.current;
    const circles = circlesRef.current;
    return () => {
      for (const marker of markers.values()) marker.remove();
      for (const circle of circles.values()) circle.remove();
      markers.clear();
      circles.clear();
    };
  }, []);
}
