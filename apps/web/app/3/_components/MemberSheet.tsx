"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { EyeOff } from "lucide-react";
import type { MockMember } from "@/lib/mock-data";
import { staleness } from "@/lib/mock-data";

export type SnapPoint = "peek" | "half" | "full";

const SNAP_VH: Record<SnapPoint, number> = {
  peek: 16,
  half: 46,
  full: 82,
};

interface MemberSheetProps {
  members: MockMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  snap: SnapPoint;
  onSnapChange: (s: SnapPoint) => void;
}

export default function MemberSheet({
  members,
  selectedId,
  onSelect,
  snap,
  onSnapChange,
}: MemberSheetProps) {
  const dragRef = useRef<{
    startY: number;
    startVh: number;
    dragging: boolean;
  } | null>(null);
  const [liveVh, setLiveVh] = useState<number | null>(null);

  const currentVh = liveVh ?? SNAP_VH[snap];

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startVh: SNAP_VH[snap],
      dragging: true,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current?.dragging) return;
    const deltaPx = dragRef.current.startY - e.clientY;
    const deltaVh = (deltaPx / window.innerHeight) * 100;
    const next = Math.min(
      92,
      Math.max(8, dragRef.current.startVh + deltaVh),
    );
    setLiveVh(next);
  }

  function handlePointerUp() {
    if (!dragRef.current) return;
    const value = liveVh ?? SNAP_VH[snap];
    const entries = Object.entries(SNAP_VH) as [SnapPoint, number][];
    let closest: SnapPoint = "peek";
    let bestDist = Infinity;
    for (const [key, vh] of entries) {
      const d = Math.abs(vh - value);
      if (d < bestDist) {
        bestDist = d;
        closest = key;
      }
    }
    dragRef.current = null;
    setLiveVh(null);
    onSnapChange(closest);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[900] flex flex-col rounded-t-3xl border-t border-white/60 bg-white/75 shadow-[0_-12px_40px_rgba(0,0,0,0.14)] backdrop-blur-2xl transition-[height] duration-200 ease-out"
      style={{ height: `${currentVh}vh` }}
    >
      <div
        className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-2 pt-2.5 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() =>
          onSnapChange(snap === "peek" ? "half" : snap === "half" ? "full" : "peek")
        }
      >
        <div className="h-1.5 w-10 rounded-full bg-neutral-300" />
      </div>

      <div className="flex items-center justify-between px-5 pb-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          {members.length} in room
        </h2>
        <span className="text-[11px] text-neutral-400">
          {snap === "peek" ? "Drag up for list" : "Drag down to collapse"}
        </span>
      </div>

      {/* Peek row — small avatar circles */}
      <div className="flex gap-3 overflow-x-auto px-5 pb-3">
        {members.map((m) => {
          const bucket = staleness(m.lastUpdateSecondsAgo);
          const isGhost = m.sharingState === "ghost";
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <div
                className={clsx(
                  "flex h-11 w-11 items-center justify-center rounded-full text-lg transition",
                  selectedId === m.id ? "ring-2 ring-neutral-900" : "",
                )}
                style={{
                  border: `2px solid ${isGhost ? "#d4d4d4" : m.color}`,
                  background: "rgba(255,255,255,0.9)",
                  opacity: bucket === "stale" ? 0.5 : 1,
                  filter: isGhost ? "grayscale(100%)" : "none",
                }}
              >
                {isGhost ? <EyeOff size={16} className="text-neutral-400" /> : m.emoji}
              </div>
              <span className="max-w-[44px] truncate text-[10px] text-neutral-500">
                {m.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Full list — only meaningfully visible once expanded, but keep in DOM for smooth reveal */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <ul className="space-y-1">
          {members.map((m) => {
            const bucket = staleness(m.lastUpdateSecondsAgo);
            const isGhost = m.sharingState === "ghost";
            return (
              <li key={m.id}>
                <button
                  onClick={() => onSelect(m.id)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                    selectedId === m.id ? "bg-neutral-900/5" : "hover:bg-neutral-900/5",
                  )}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                    style={{
                      border: `2px solid ${isGhost ? "#d4d4d4" : m.color}`,
                      opacity: bucket === "stale" ? 0.5 : 1,
                      filter: isGhost ? "grayscale(100%)" : "none",
                    }}
                  >
                    {isGhost ? <EyeOff size={14} className="text-neutral-400" /> : m.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {m.name}
                      {m.isSelf ? " (you)" : ""}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      {isGhost
                        ? "Hidden from the map"
                        : m.sharingState === "approx"
                          ? `Approximate · ±${m.blurRadiusM}m`
                          : "Exact location"}
                    </p>
                  </div>
                  {!isGhost && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: m.color, opacity: bucket === "stale" ? 0.4 : 1 }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
