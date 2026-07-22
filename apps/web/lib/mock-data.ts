// Shared mock data for the three Phase 0 design-direction prototypes
// (app/1, app/2, app/3). Keeping this identical across all three is what
// makes them comparable — only the presentation should differ, not the
// content. See docs/DELIVERY_PLAN.md Phase 0.4 and docs/PRD.md §7.
//
// Coordinates are centred on a small patch of San Francisco so markers sit
// at readable, realistic map distances from each other.

export type SharingState = "exact" | "approx" | "ghost";

export interface MockMember {
  id: string;
  name: string;
  emoji: string;
  color: string; // used for marker/avatar tinting
  isSelf: boolean;
  isOwner: boolean;
  sharingState: SharingState;
  lat: number;
  lng: number;
  /** Blur radius in meters, only meaningful when sharingState === "approx" */
  blurRadiusM: number | null;
  /** Seconds since this member's position last updated. null when ghosted. */
  lastUpdateSecondsAgo: number | null;
}

export const mockRoom = {
  id: "room_9k2f",
  name: "Weekend Crew",
  emoji: "🏕️",
  createdAt: "2026-07-18T14:00:00Z",
  retentionDays: 30,
  center: { lat: 37.7694, lng: -122.4862 },
};

export const mockMembers: MockMember[] = [
  {
    id: "u_self",
    name: "You",
    emoji: "🦊",
    color: "#3b82f6",
    isSelf: true,
    isOwner: true,
    sharingState: "exact",
    lat: 37.7694,
    lng: -122.4862,
    blurRadiusM: null,
    lastUpdateSecondsAgo: 4,
  },
  {
    id: "u_mia",
    name: "Mia",
    emoji: "🐙",
    color: "#f97316",
    isSelf: false,
    isOwner: false,
    sharingState: "exact",
    lat: 37.7701,
    lng: -122.4835,
    blurRadiusM: null,
    lastUpdateSecondsAgo: 12,
  },
  {
    id: "u_theo",
    name: "Theo",
    emoji: "🐢",
    color: "#22c55e",
    isSelf: false,
    isOwner: false,
    sharingState: "approx",
    lat: 37.7665,
    lng: -122.4820,
    blurRadiusM: 250,
    lastUpdateSecondsAgo: 40,
  },
  {
    id: "u_priya",
    name: "Priya",
    emoji: "🦋",
    color: "#a855f7",
    isSelf: false,
    isOwner: false,
    sharingState: "exact",
    lat: 37.7715,
    lng: -122.4900,
    blurRadiusM: null,
    lastUpdateSecondsAgo: 620, // stale — > 5 min
  },
  {
    id: "u_sam",
    name: "Sam",
    emoji: "🦁",
    color: "#eab308",
    isSelf: false,
    isOwner: false,
    sharingState: "ghost",
    lat: 37.7680,
    lng: -122.4790,
    blurRadiusM: null,
    lastUpdateSecondsAgo: null,
  },
  {
    id: "u_noah",
    name: "Noah",
    emoji: "🐝",
    color: "#ec4899",
    isSelf: false,
    isOwner: false,
    sharingState: "exact",
    lat: 37.7650,
    lng: -122.4870,
    blurRadiusM: null,
    lastUpdateSecondsAgo: 3,
  },
];

export const mockInvite = {
  url: "https://tether.example/j/9k2f#a1c9",
  expiresInHours: 24,
  maxUses: 10,
  uses: 3,
};

export interface MockHistoryPoint {
  timestamp: string;
  label: string;
}

export const mockHistorySegments: MockHistoryPoint[] = [
  { timestamp: "2026-07-22T09:00:00Z", label: "Left the campsite" },
  { timestamp: "2026-07-22T10:30:00Z", label: "Stopped at the trailhead" },
  { timestamp: "2026-07-22T13:15:00Z", label: "Lunch near the lake" },
  { timestamp: "2026-07-22T16:45:00Z", label: "Back at camp" },
];

export function staleness(
  lastUpdateSecondsAgo: number | null,
): "live" | "recent" | "stale" | "hidden" {
  if (lastUpdateSecondsAgo === null) return "hidden";
  if (lastUpdateSecondsAgo <= 30) return "live";
  if (lastUpdateSecondsAgo <= 300) return "recent";
  return "stale";
}
