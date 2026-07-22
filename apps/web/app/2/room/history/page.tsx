"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, ShieldCheck, Trash2 } from "lucide-react";
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
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
      <Link
        href="/2/room"
        className="mb-5 flex w-fit items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300"
      >
        <ArrowLeft size={14} />
        Back to room
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-neutral-50">History</h1>

      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-3">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-sky-400" />
        <p className="text-xs leading-relaxed text-neutral-400">
          History is kept for 30 days, then permanently deleted. Only
          members of this room can see it.
        </p>
      </div>

      {deleted ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-600">
          History cleared.
        </div>
      ) : (
        <div className="mb-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
          {mockHistorySegments.map((seg, i) => (
            <div
              key={seg.timestamp}
              className="flex gap-3 border-b border-neutral-800/80 px-4 py-3.5 last:border-b-0"
            >
              <div className="flex flex-col items-center pt-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                  <MapPin size={12} />
                </div>
                {i < mockHistorySegments.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-neutral-800" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="text-sm text-neutral-200">{seg.label}</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {formatTimestamp(seg.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={deleted}
        onClick={() => setDeleted(true)}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/50 bg-red-500/10 py-3.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/15 disabled:opacity-40"
      >
        <Trash2 size={15} />
        Delete my history
      </button>
    </div>
  );
}
