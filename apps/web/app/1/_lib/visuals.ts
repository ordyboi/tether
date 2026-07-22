import type { MockMember } from "@/lib/mock-data";
import { staleness } from "@/lib/mock-data";

export function formatSecondsAgo(seconds: number | null): string {
  if (seconds === null) return "hidden";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

export function stalenessLabel(member: MockMember): string {
  const s = staleness(member.lastUpdateSecondsAgo);
  switch (s) {
    case "live":
      return "Live";
    case "recent":
      return "Recent";
    case "stale":
      return `Stale · ${formatSecondsAgo(member.lastUpdateSecondsAgo)}`;
    case "hidden":
      return "Hidden";
  }
}

export function sharingStateLabel(member: MockMember): string {
  switch (member.sharingState) {
    case "exact":
      return "Exact location";
    case "approx":
      return `Approximate · ~${member.blurRadiusM ?? "?"}m blur`;
    case "ghost":
      return "Ghost mode";
  }
}
