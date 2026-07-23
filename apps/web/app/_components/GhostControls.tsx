"use client";

import { X, Eye, EyeOff, MapPin, CircleDashed } from "lucide-react";
import clsx from "clsx";
import type { SharingState } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

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
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-sm border-[3px] border-border bg-card p-5 sm:mx-auto">
        <DrawerClose
          render={
            <Button
              variant="tether-outline"
              size="tether-icon-sm"
              className="absolute top-4 right-4 border-2"
            />
          }
        >
          <X size={16} strokeWidth={3} />
        </DrawerClose>

        <DrawerHeader className="p-0 text-left! md:text-left">
          <DrawerTitle className="text-lg font-extrabold">
            Your visibility
          </DrawerTitle>
          <DrawerDescription className="mb-4">
            Control how precisely — or whether — the room can see you.
          </DrawerDescription>
        </DrawerHeader>

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
                : "border-border text-muted-foreground hover:border-[#5c4326]",
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
                : "border-border text-muted-foreground hover:border-[#5c4326]",
            )}
          >
            <EyeOff size={22} strokeWidth={2.5} />
            Ghost mode
          </button>
        </div>

        <p className="mt-5 mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
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
                  : "border-border text-muted-foreground hover:border-[#5c4326]",
              )}
            >
              <CircleDashed size={18} strokeWidth={2.5} />
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-2xl border-2 border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
          <MapPin size={14} />
          Changes apply to your marker immediately — everyone else keeps
          their own settings.
        </div>
      </DrawerContent>
    </Drawer>
  );
}
