"use client";

import Link from "next/link";
import { X, Share2, History, Ghost, MapPinned, LocateFixed } from "lucide-react";
import clsx from "clsx";
import type { SharingState } from "@/lib/mock-data";

const PRECISION_OPTIONS: { label: string; value: SharingState; blur: number | null }[] = [
  { label: "Exact", value: "exact", blur: null },
  { label: "Approx · 100m", value: "approx", blur: 100 },
  { label: "Approx · 250m", value: "approx", blur: 250 },
  { label: "Approx · 500m", value: "approx", blur: 500 },
];

export default function RoomSettingsSheet({
  open,
  onClose,
  sharingState,
  blurRadiusM,
  onChangePrecision,
  onToggleGhost,
}: {
  open: boolean;
  onClose: () => void;
  sharingState: SharingState;
  blurRadiusM: number | null;
  onChangePrecision: (state: SharingState, blur: number | null) => void;
  onToggleGhost: () => void;
}) {
  if (!open) return null;

  const isGhost = sharingState === "ghost";

  return (
    <div
      className="absolute inset-0 z-[600] flex items-end bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl border-t border-neutral-800 bg-neutral-950 pb-6"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3.5">
          <span className="text-sm font-semibold text-neutral-100">
            Room settings
          </span>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-neutral-800">
          <Link
            href="/2/room/share"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-900"
          >
            <Share2 size={16} className="text-sky-400" />
            <span className="flex-1 text-sm text-neutral-200">Invite &amp; share</span>
          </Link>
          <Link
            href="/2/room/history"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-900"
          >
            <History size={16} className="text-sky-400" />
            <span className="flex-1 text-sm text-neutral-200">Location history</span>
          </Link>
        </div>

        <div className="px-4 pt-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ghost size={16} className="text-neutral-400" />
              <span className="text-sm font-medium text-neutral-200">
                Ghost mode
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleGhost}
              className={clsx(
                "relative h-6 w-11 rounded-full transition-colors",
                isGhost ? "bg-sky-500" : "bg-neutral-700",
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  isGhost ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
          <p className="mb-4 text-xs text-neutral-500">
            Hide your position from everyone in this room. Your marker
            disappears until you turn this off.
          </p>

          <div className={clsx("mb-1", isGhost && "pointer-events-none opacity-40")}>
            <div className="mb-2 flex items-center gap-2">
              <MapPinned size={16} className="text-neutral-400" />
              <span className="text-sm font-medium text-neutral-200">
                Precision
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRECISION_OPTIONS.map((opt) => {
                const active =
                  !isGhost &&
                  sharingState === opt.value &&
                  blurRadiusM === opt.blur;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onChangePrecision(opt.value, opt.blur)}
                    className={clsx(
                      "flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition",
                      active
                        ? "border-sky-500 bg-sky-500/15 text-sky-300"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700",
                    )}
                  >
                    {opt.value === "exact" ? (
                      <LocateFixed size={13} />
                    ) : (
                      <MapPinned size={13} />
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
