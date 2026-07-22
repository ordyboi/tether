"use client";

import Link from "next/link";
import { Share2, History, SlidersHorizontal } from "lucide-react";

interface RoomTopBarProps {
  emoji: string;
  name: string;
  memberCount: number;
  onOpenPrecision: () => void;
}

export default function RoomTopBar({
  emoji,
  name,
  memberCount,
  onOpenPrecision,
}: RoomTopBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[900] flex items-start justify-between gap-2 p-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/60 bg-white/70 py-1.5 pl-1.5 pr-4 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900/5 text-base">
          {emoji}
        </div>
        <div className="leading-tight">
          <p className="text-xs font-semibold text-neutral-900">{name}</p>
          <p className="text-[10px] text-neutral-400">{memberCount} members</p>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          onClick={onOpenPrecision}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-neutral-600 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl transition hover:bg-white/90"
          title="Ghost & precision controls"
          aria-label="Ghost & precision controls"
        >
          <SlidersHorizontal size={16} />
        </button>
        <Link
          href="/3/room/history"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-neutral-600 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl transition hover:bg-white/90"
          title="History"
          aria-label="History"
        >
          <History size={16} />
        </Link>
        <Link
          href="/3/room/share"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-neutral-600 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl transition hover:bg-white/90"
          title="Share"
          aria-label="Share"
        >
          <Share2 size={16} />
        </Link>
      </div>
    </div>
  );
}
