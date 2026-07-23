"use client";

import type { MockMember } from "@/lib/mock-data";
import { staleness } from "@/lib/mock-data";
import { EyeOff } from "lucide-react";
import clsx from "clsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatSecondsAgo } from "../_lib/visuals";

const SIZES = {
  sm: { box: 40, emoji: "text-lg", badge: 14 },
  md: { box: 56, emoji: "text-2xl", badge: 18 },
  lg: { box: 84, emoji: "text-4xl", badge: 24 },
} as const;

export default function MemberAvatar({
  member,
  size = "md",
  onClick,
  showTimeLabel = false,
  ring = true,
}: {
  member: MockMember;
  size?: keyof typeof SIZES;
  onClick?: () => void;
  showTimeLabel?: boolean;
  ring?: boolean;
}) {
  const stale = staleness(member.lastUpdateSecondsAgo);
  const dims = SIZES[size];
  const isGhost = member.sharingState === "ghost" || stale === "hidden";

  return (
    <div className="flex flex-col items-center gap-1">
      <Avatar
        render={onClick ? <button type="button" onClick={onClick} /> : <div />}
        aria-label={member.name}
        className={clsx(
          "relative flex shrink-0 items-center justify-center rounded-full border-[3px] shadow-none transition after:hidden",
          onClick && "active:scale-95",
          isGhost
            ? "border-dashed border-stone-500 bg-stone-800/70 grayscale"
            : "bg-card",
          stale === "stale" && !isGhost && "opacity-50 saturate-50",
        )}
        style={{
          width: dims.box,
          height: dims.box,
          borderColor: ring ? (isGhost ? undefined : member.color) : "transparent",
        }}
      >
        {stale === "live" && !isGhost && (
          <span
            className="absolute inset-0 -z-10 animate-ping rounded-full opacity-40"
            style={{ backgroundColor: member.color }}
          />
        )}
        <AvatarFallback
          className={clsx("bg-transparent", dims.emoji, isGhost && "opacity-60")}
        >
          {member.emoji}
        </AvatarFallback>

        {/* sharing-state badge */}
        <span
          className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full border-2 border-background"
          style={{ width: dims.badge, height: dims.badge }}
        >
          {member.sharingState === "exact" && (
            <span
              className="h-full w-full rounded-full"
              style={{ backgroundColor: member.color }}
            />
          )}
          {member.sharingState === "approx" && (
            <span className="relative h-full w-full rounded-full bg-amber-400">
              <span className="absolute -inset-1 rounded-full border-2 border-dashed border-amber-300/80" />
            </span>
          )}
          {member.sharingState === "ghost" && (
            <span className="flex h-full w-full items-center justify-center rounded-full bg-stone-600">
              <EyeOff size={dims.badge * 0.6} strokeWidth={3} className="text-stone-200" />
            </span>
          )}
        </span>
      </Avatar>
      {showTimeLabel && (
        <span
          className={clsx(
            "text-[10px] font-bold",
            isGhost ? "text-stone-500" : "text-amber-200/70",
          )}
        >
          {isGhost ? "hidden" : formatSecondsAgo(member.lastUpdateSecondsAgo)}
        </span>
      )}
    </div>
  );
}
