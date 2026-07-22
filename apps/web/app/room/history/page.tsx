"use client";

import { useState } from "react";
import { Trash2, ShieldCheck, MapPinned } from "lucide-react";
import { mockHistorySegments } from "@/lib/mock-data";

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-orange-400">
        Trail log
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-amber-50">
        Your history
      </h1>

      <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-dashed border-[#4a3420] bg-[#1b140c] px-4 py-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-green-400" size={20} />
        <p className="text-xs leading-relaxed text-amber-200/60">
          Location history is kept for <strong className="text-amber-100">30 days</strong> and
          then automatically deleted. You can also wipe it early below.
        </p>
      </div>

      {deleted ? (
        <div className="rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10] p-8 text-center">
          <p className="text-sm font-bold text-amber-200/60">
            History cleared. New waypoints will start showing up here.
          </p>
        </div>
      ) : (
        <ol className="relative mb-6 space-y-4 border-l-[3px] border-[#4a3420] pl-6">
          {mockHistorySegments.map((point, i) => (
            <li key={point.timestamp} className="relative">
              <span
                className="absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-[#1b140c] bg-orange-500"
                aria-hidden
              >
                <MapPinned size={10} className="text-white" />
              </span>
              <div className="rounded-2xl border-2 border-[#4a3420] bg-[#2a1d10] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-200/40">
                  {formatTimestamp(point.timestamp)}
                </p>
                <p className="text-sm font-bold text-amber-50">{point.label}</p>
              </div>
              {i === mockHistorySegments.length - 1 && (
                <span className="absolute -left-[9px] top-8 text-[10px] font-bold text-amber-200/30">
                  now
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={() => setDeleted(true)}
        disabled={deleted}
        className="flex w-full items-center justify-center gap-2 rounded-full border-[3px] border-red-600 bg-red-600/20 py-3.5 text-sm font-extrabold text-red-300 transition active:translate-y-0.5 disabled:cursor-not-allowed disabled:border-stone-600 disabled:bg-transparent disabled:text-stone-500"
      >
        <Trash2 size={16} strokeWidth={2.5} />
        Delete my history
      </button>
    </div>
  );
}
