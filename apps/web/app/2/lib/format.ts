import { staleness, type MockMember } from "@/lib/mock-data";

export function formatRelativeTime(secondsAgo: number | null): string {
  if (secondsAgo === null) return "hidden";
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  return `${Math.floor(secondsAgo / 3600)}h ago`;
}

/** Dot colour purely reflects data freshness, independent of sharing state. */
export function stalenessDotClass(secondsAgo: number | null): string {
  const bucket = staleness(secondsAgo);
  switch (bucket) {
    case "live":
      return "bg-emerald-500";
    case "recent":
      return "bg-amber-500";
    case "stale":
      return "bg-neutral-500";
    case "hidden":
      return "bg-neutral-600";
  }
}

export type PillTone = "green" | "amber" | "sky" | "neutral";

export interface StatePillInfo {
  label: string;
  tone: PillTone;
}

export function getStatePill(member: MockMember): StatePillInfo {
  if (member.sharingState === "ghost") {
    return { label: "Hidden", tone: "neutral" };
  }
  if (member.sharingState === "approx") {
    return {
      label: `Approx · ${member.blurRadiusM}m`,
      tone: "amber",
    };
  }
  const bucket = staleness(member.lastUpdateSecondsAgo);
  if (bucket === "live") return { label: "Live", tone: "green" };
  if (bucket === "recent") return { label: "Recent", tone: "sky" };
  return { label: "Stale", tone: "neutral" };
}

export const pillToneClasses: Record<PillTone, string> = {
  green: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
  sky: "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30",
  neutral: "bg-neutral-500/15 text-neutral-400 ring-1 ring-neutral-500/30",
};
