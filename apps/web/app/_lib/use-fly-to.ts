import { useEffect, type RefObject } from "react";
import type L from "leaflet";

export function useFlyTo(
  mapRef: RefObject<L.Map | null>,
  target: { lat: number; lng: number; zoom?: number } | null,
) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 16, { duration: 0.75 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, target?.zoom]);
}
