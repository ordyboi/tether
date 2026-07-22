"use client";

import { X, Eye, EyeOff, MapPin, CircleDashed } from "lucide-react";
import clsx from "clsx";
import type { SharingState } from "@/lib/mock-data";

const PRECISION_OPTIONS: { label: string; blurRadiusM: number }[] = [
  { label: "Neighborhood (~1km)", blurRadiusM: 1000 },
  { label: "Nearby (~250m)", blurRadiusM: 250 },
  { label: "Exact street (~50m)", blurRadiusM: 50 },
];

export default function GhostControls({
  sharingState,
  blurRadiusM,
  onChange,
  onClose,
}: {
  sharingState: SharingState;
  blurRadiusM: number | null;
  onChange: (next: { sharingState: SharingState; blurRadiusM: number | null }) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl border-[3px] border-b-0 border-[#4a3420] bg-[#2a1d10] p-5 shadow-[0_-8px_0_0_rgba(0,0,0,0.3)] sm:rounded-3xl sm:border-b-[3px]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border-2 border-[#4a3420] p-1.5 text-amber-200/70 hover:text-amber-100"
        >
          <X size={16} strokeWidth={3} />
        </button>

        <h2 className="text-lg font-extrabold text-amber-50">Your visibility</h2>
        <p className="mb-4 text-sm text-amber-200/60">
          Control how precisely — or whether — the room can see you.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() =>
              onChange({
                sharingState: "exact",
                blurRadiusM: null,
              })
            }
            className={clsx(
              "flex flex-col items-center gap-2 rounded-2xl border-[3px] px-3 py-4 text-sm font-bold transition",
              sharingState === "exact"
                ? "border-green-500 bg-green-500/15 text-green-300"
                : "border-[#4a3420] text-amber-200/60 hover:border-[#5c4326]",
            )}
          >
            <Eye size={22} strokeWidth={2.5} />
            Exact
          </button>
          <button
            onClick={() =>
              onChange({ sharingState: "ghost", blurRadiusM: null })
            }
            className={clsx(
              "flex flex-col items-center gap-2 rounded-2xl border-[3px] px-3 py-4 text-sm font-bold transition",
              sharingState === "ghost"
                ? "border-stone-400 bg-stone-500/15 text-stone-200"
                : "border-[#4a3420] text-amber-200/60 hover:border-[#5c4326]",
            )}
          >
            <EyeOff size={22} strokeWidth={2.5} />
            Ghost mode
          </button>
        </div>

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-amber-200/50">
          Blur precision
        </p>
        <div className="flex flex-col gap-2">
          {PRECISION_OPTIONS.map((opt) => (
            <button
              key={opt.blurRadiusM}
              onClick={() =>
                onChange({ sharingState: "approx", blurRadiusM: opt.blurRadiusM })
              }
              className={clsx(
                "flex items-center gap-3 rounded-2xl border-[3px] px-4 py-3 text-left text-sm font-bold transition",
                sharingState === "approx" && blurRadiusM === opt.blurRadiusM
                  ? "border-amber-400 bg-amber-400/15 text-amber-200"
                  : "border-[#4a3420] text-amber-200/60 hover:border-[#5c4326]",
              )}
            >
              <CircleDashed size={18} strokeWidth={2.5} />
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#4a3420] px-3 py-2.5 text-xs text-amber-200/50">
          <MapPin size={14} />
          Changes apply to your marker immediately — everyone else keeps
          their own settings.
        </div>
      </div>
    </div>
  );
}
