"use client";

import { X, Navigation, Bell, MapPin, EyeOff } from "lucide-react";
import type { MockMember } from "@/lib/mock-data";
import { staleness } from "@/lib/mock-data";

function formatAgo(seconds: number | null) {
  if (seconds === null) return "unknown";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

interface MemberDetailCardProps {
  member: MockMember;
  onClose: () => void;
}

export default function MemberDetailCard({
  member,
  onClose,
}: MemberDetailCardProps) {
  const bucket = staleness(member.lastUpdateSecondsAgo);
  const isGhost = member.sharingState === "ghost";

  return (
    <div className="fixed inset-x-3 bottom-[19vh] z-[950] mx-auto max-w-sm rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900/8 text-neutral-500 transition hover:bg-neutral-900/15"
        aria-label="Close"
      >
        <X size={14} />
      </button>

      <div className="flex items-center gap-3 pr-8">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
          style={{
            border: `2px solid ${isGhost ? "#d4d4d4" : member.color}`,
            filter: isGhost ? "grayscale(100%)" : "none",
          }}
        >
          {isGhost ? <EyeOff size={18} className="text-neutral-400" /> : member.emoji}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-neutral-900">
            {member.name}
            {member.isSelf ? " (you)" : ""}
          </h3>
          <p className="truncate text-xs text-neutral-400">
            {isGhost
              ? "Not sharing right now"
              : member.sharingState === "approx"
                ? `Approximate location · ±${member.blurRadiusM}m`
                : "Sharing exact location"}
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex gap-2">
        <button className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-neutral-800">
          <Navigation size={13} /> Center
        </button>
        <button className="flex items-center gap-1.5 rounded-full bg-neutral-900/6 px-3.5 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-900/10">
          <Bell size={13} /> Notify
        </button>
        <button className="flex items-center gap-1.5 rounded-full bg-neutral-900/6 px-3.5 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-900/10">
          <MapPin size={13} /> Directions
        </button>
      </div>

      <div className="mt-3.5 rounded-2xl bg-neutral-900/[0.035] px-3.5 py-2.5 text-xs text-neutral-500">
        {isGhost ? (
          <p>This member has hidden their location. You'll see them again once they resume sharing.</p>
        ) : (
          <div className="flex items-center justify-between">
            <span>Last updated</span>
            <span
              className={
                bucket === "stale" ? "font-medium text-neutral-400" : "font-medium text-neutral-700"
              }
            >
              {formatAgo(member.lastUpdateSecondsAgo)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
