"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

type Snap = "peek" | "half" | "full";

const HEIGHTS: Record<Snap, string> = {
  peek: "22vh",
  half: "48vh",
  full: "82vh",
};

const ORDER: Snap[] = ["peek", "half", "full"];

export default function BottomSheet({
  title,
  subtitle,
  children,
  defaultSnap = "peek",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultSnap?: Snap;
}) {
  const [snap, setSnap] = useState<Snap>(defaultSnap);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStart = useRef<number | null>(null);

  const height = `calc(${HEIGHTS[snap]} - ${dragOffset}px)`;

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientY;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current === null) return;
    setDragOffset(dragStart.current - e.clientY);
  }

  function onPointerUp() {
    if (dragStart.current === null) return;
    const idx = ORDER.indexOf(snap);
    // Dragged up more than 60px -> expand a step, down -> collapse a step.
    if (dragOffset > 60 && idx < ORDER.length - 1) {
      setSnap(ORDER[idx + 1]);
    } else if (dragOffset < -60 && idx > 0) {
      setSnap(ORDER[idx - 1]);
    }
    dragStart.current = null;
    setDragOffset(0);
  }

  function cycleSnap() {
    const idx = ORDER.indexOf(snap);
    setSnap(ORDER[(idx + 1) % ORDER.length]);
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[500] flex flex-col rounded-t-2xl border-t border-neutral-800 bg-neutral-950/97 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-[height] duration-150 ease-out"
      style={{ height }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={cycleSnap}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-2 pb-2 pt-2.5 active:cursor-grabbing"
      >
        <div className="h-1.5 w-10 rounded-full bg-neutral-700" />
        <div className="flex w-full items-center justify-between px-4">
          <div>
            <div className="text-sm font-semibold text-neutral-100">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-neutral-500">{subtitle}</div>
            )}
          </div>
          <span
            className={clsx(
              "text-[10px] font-medium uppercase tracking-wide text-neutral-600",
            )}
          >
            drag / tap
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
