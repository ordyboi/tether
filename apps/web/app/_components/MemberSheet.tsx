"use client";

import type { MockMember } from "@/lib/mock-data";
import { X, Crosshair } from "lucide-react";
import MemberAvatar from "./MemberAvatar";
import { sharingStateLabel, stalenessLabel } from "../_lib/visuals";

export default function MemberSheet({
  member,
  onClose,
  onFocus,
}: {
  member: MockMember;
  onClose: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl border-[3px] border-b-0 border-[#4a3420] bg-[#2a1d10] p-5 shadow-[0_-8px_0_0_rgba(0,0,0,0.3)] sm:rounded-3xl sm:border-b-[3px]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border-2 border-[#4a3420] p-1.5 text-amber-200/70 hover:text-amber-100"
        >
          <X size={16} strokeWidth={3} />
        </button>

        <div className="flex items-center gap-4">
          <MemberAvatar member={member} size="lg" ring />
          <div>
            <h2 className="text-xl font-extrabold text-amber-50">
              {member.name}
              {member.isSelf && (
                <span className="ml-2 text-xs font-bold text-orange-400">
                  (you)
                </span>
              )}
            </h2>
            {member.isOwner && (
              <span className="text-xs font-bold text-yellow-400">
                Room owner
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-[#4a3420] bg-[#1b140c] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/50">
              Sharing
            </p>
            <p className="text-sm font-bold text-amber-50">
              {sharingStateLabel(member)}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#4a3420] bg-[#1b140c] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/50">
              Status
            </p>
            <p className="text-sm font-bold text-amber-50">
              {stalenessLabel(member)}
            </p>
          </div>
        </div>

        <button
          onClick={onFocus}
          disabled={member.sharingState === "ghost"}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border-[3px] border-orange-600 bg-orange-500 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_0_#9a3412] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-stone-600 disabled:bg-stone-700 disabled:text-stone-400 disabled:shadow-none"
        >
          <Crosshair size={18} strokeWidth={3} />
          {member.sharingState === "ghost" ? "Location hidden" : "Focus on map"}
        </button>
      </div>
    </div>
  );
}
