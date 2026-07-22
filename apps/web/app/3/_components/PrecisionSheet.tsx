"use client";

import { X, EyeOff, Eye, Crosshair } from "lucide-react";
import clsx from "clsx";

const RADIUS_OPTIONS = [100, 250, 500, 1000];

interface PrecisionSheetProps {
  ghost: boolean;
  onGhostChange: (v: boolean) => void;
  blurRadiusM: number | null;
  onBlurChange: (v: number | null) => void;
  onClose: () => void;
}

export default function PrecisionSheet({
  ghost,
  onGhostChange,
  blurRadiusM,
  onBlurChange,
  onClose,
}: PrecisionSheetProps) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-neutral-900/20 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl border border-white/60 bg-white/85 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">
            Your visibility
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900/8 text-neutral-500 hover:bg-neutral-900/15"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <button
          onClick={() => onGhostChange(!ghost)}
          className="mb-4 flex w-full items-center justify-between rounded-2xl bg-neutral-900/[0.035] px-4 py-3.5 text-left transition hover:bg-neutral-900/[0.06]"
        >
          <div className="flex items-center gap-3">
            {ghost ? (
              <EyeOff size={17} className="text-neutral-400" />
            ) : (
              <Eye size={17} className="text-neutral-700" />
            )}
            <div>
              <p className="text-sm font-medium text-neutral-900">
                Ghost mode
              </p>
              <p className="text-xs text-neutral-400">
                {ghost ? "You're hidden from the room" : "Others can see you're here"}
              </p>
            </div>
          </div>
          <span
            className={clsx(
              "relative h-6 w-10 shrink-0 rounded-full transition",
              ghost ? "bg-neutral-900" : "bg-neutral-300",
            )}
          >
            <span
              className={clsx(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                ghost ? "translate-x-[18px]" : "translate-x-0.5",
              )}
            />
          </span>
        </button>

        <div className={clsx(ghost && "pointer-events-none opacity-40")}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Crosshair size={14} className="text-neutral-400" />
            <p className="text-xs font-medium text-neutral-500">
              Precision blur radius
            </p>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            <button
              onClick={() => onBlurChange(null)}
              className={clsx(
                "rounded-xl px-2 py-2.5 text-[11px] font-medium transition",
                blurRadiusM === null
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-900/6 text-neutral-600 hover:bg-neutral-900/10",
              )}
            >
              Exact
            </button>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => onBlurChange(r)}
                className={clsx(
                  "rounded-xl px-2 py-2.5 text-[11px] font-medium transition",
                  blurRadiusM === r
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-900/6 text-neutral-600 hover:bg-neutral-900/10",
                )}
              >
                ±{r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
