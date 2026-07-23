"use client";

import { useState } from "react";
import { Copy, Check, Clock, Users2 } from "lucide-react";
import { mockInvite } from "@/lib/mock-data";

export default function SharePage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mockInvite.url);
    } catch {
      // clipboard may be unavailable in this sandbox — still flip the UI
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-orange-400">
        Invite
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-amber-50">
        Bring in the crew
      </h1>

      {/* QR placeholder */}
      <div className="mb-6 flex flex-col items-center rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10] p-6 shadow-[0_4px_0_0_#150d06]">
        <div
          className="mb-3 grid grid-cols-8 grid-rows-8 gap-[3px] rounded-xl bg-amber-50 p-3"
          aria-hidden
        >
          {Array.from({ length: 64 }).map((_, i) => {
            // deterministic pseudo-random pattern, purely decorative
            const on = (i * 17 + Math.floor(i / 8) * 5) % 7 < 3;
            const isCorner =
              (i < 8 && (i % 8) < 3) ||
              (i >= 40 && i < 48 && (i % 8) < 3) ||
              (i < 24 && i % 8 >= 5);
            return (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-[2px] ${
                  isCorner || on ? "bg-[#1b140c]" : "bg-transparent"
                }`}
              />
            );
          })}
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200/40">
          QR placeholder — not a real code
        </p>
      </div>

      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-amber-200/50">
        Invite link
      </label>
      <div className="mb-6 flex items-center gap-2 rounded-2xl border-[3px] border-[#4a3420] bg-[#1b140c] p-2 pl-4">
        <span className="flex-1 truncate font-mono text-sm text-amber-100">
          {mockInvite.url}
        </span>
        <button
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border-[3px] border-orange-600 bg-orange-500 px-3 py-2 text-xs font-extrabold text-white shadow-[0_3px_0_0_#9a3412] transition active:translate-y-0.5 active:shadow-none"
        >
          {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={3} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-[#4a3420] bg-[#2a1d10] px-4 py-3">
          <Clock className="text-amber-300" size={20} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/40">
              Expires
            </p>
            <p className="text-sm font-extrabold text-amber-50">
              {mockInvite.expiresInHours}h from now
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border-2 border-[#4a3420] bg-[#2a1d10] px-4 py-3">
          <Users2 className="text-amber-300" size={20} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/40">
              Uses
            </p>
            <p className="text-sm font-extrabold text-amber-50">
              {mockInvite.uses} / {mockInvite.maxUses}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
